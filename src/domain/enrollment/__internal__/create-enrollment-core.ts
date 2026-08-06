// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// createOwnEnrollment）與 (2) Playwright 併發測試直接呼叫——這是本輪唯一有多個不同
// 使用者競爭同一個有限資源（capacity）的 concurrency-sensitive 場景，比照
// class-session/__internal__/create-class-session-core.ts 已驗證過的同一套架構。

import type { NotificationType } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

// 供 D4 端到端失敗隔離測試注入：預設值就是「解析收件人 + 呼叫 notifyUsers」的真正邏輯
// （見下方呼叫處），測試可傳入一個保證丟出例外的假函式，驗證 trigger 呼叫端外層的
// try/catch 確實吞掉例外、不影響本函式的回傳結果。
export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

export type DemandLockHooks = {
  onBeforeLock?: () => void | Promise<void>;
  onLockAcquired?: () => void | Promise<void>;
  // 第 8 節 Codex round 3 修正：onLockAcquired 只對應 ClassSession 的鎖，這裡另外開一個同步
  // 點對應 TeacherProfile 的鎖——供 Playwright 測試證明「跟 Admin 執行 suspend 的獨立
  // UPDATE 正確序列化」，不是機率性的 Promise.all。
  onTeacherLockAcquired?: () => void | Promise<void>;
};

export type CreateEnrollmentInput = {
  notes: string | null;
};

export type CreateEnrollmentForUserErrorCode =
  | "class_session_not_found"
  | "class_session_not_open"
  | "class_session_already_started"
  | "class_session_full"
  | "already_enrolled"
  | "teacher_not_approved"
  | "create_failed";

export type CreateEnrollmentForUserResult =
  | { ok: true; enrollmentId: string; status: "confirmed" | "pending" }
  | { ok: false; code: CreateEnrollmentForUserErrorCode };

class ClassSessionNotFoundError extends Error {
  constructor() {
    super("Class session not found");
    this.name = "ClassSessionNotFoundError";
  }
}

class ClassSessionNotOpenError extends Error {
  constructor() {
    super("Class session is not open for enrollment");
    this.name = "ClassSessionNotOpenError";
  }
}

class ClassSessionAlreadyStartedError extends Error {
  constructor() {
    super("Class session has already started");
    this.name = "ClassSessionAlreadyStartedError";
  }
}

class ClassSessionFullError extends Error {
  constructor() {
    super("Class session has no remaining capacity");
    this.name = "ClassSessionFullError";
  }
}

class AlreadyEnrolledError extends Error {
  constructor() {
    super("User already has an enrollment for this class session");
    this.name = "AlreadyEnrolledError";
  }
}

class TeacherNotApprovedError extends Error {
  constructor() {
    super("Teacher profile is not approved");
    this.name = "TeacherNotApprovedError";
  }
}

// D5/D14 + teacher-initiated-open-classes 第 8 節（Gate G2/G3）：整段包在 prisma.$transaction 內：
// (a) 鎖住 ClassSession 並取回 status/capacity/startAt/requiresApproval/teacherProfileId；
// (b) 檢查 status === open_for_enrollment；
// (c) 檢查 startAt > now（D14）；
// (d) 鎖住這位老師的 TeacherProfile row 並讀出 status——鎖必須先於讀取，否則跟 Admin 執行
//     suspend 的獨立 UPDATE 不會互相序列化，會有 TOCTOU 窗口（見 conflict-check.ts 同一套
//     手法，這是本計畫第三次用「鎖 TeacherProfile 列」解決同一類問題）；非 approved 一律拒絕
//     新報名，不論報名者是透過公開瀏覽還是已登入直連——但這個檢查只在「新建立報名」這個時間
//     點生效，不回溯撤銷 suspend 生效前已經合法建立的報名；
// (e) pending + confirmed 合計數量 < capacity（Gate G3 = A，pending 佔用名額）；
// (f) 尚無 (classSessionId, userId) 的既有 enrollment（任何狀態，D8）；
// (g) 建立 enrollment，依 requiresApproval 決定初始狀態是 confirmed 或 pending，寫入
//     consentedAt（D6）。
// 檢查順序刻意如此（open_for_enrollment → 時間 → 資格 → capacity → 重複報名），比照
// class-session-creation D5 已驗證過的「檢查順序決定哪個錯誤碼可達」教訓。
export async function createEnrollmentForUser(
  userId: string,
  classSessionId: string,
  input: CreateEnrollmentInput,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CreateEnrollmentForUserResult> {
  try {
    const { enrollmentId, status } = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      const lockedClassSession = await tx.$queryRaw<
        {
          id: string;
          status: string;
          capacity: number;
          startAt: Date;
          requiresApproval: boolean;
          teacherProfileId: string;
        }[]
      >`
        SELECT "id", "status", "capacity", "startAt", "requiresApproval", "teacherProfileId"
        FROM "ClassSession"
        WHERE "id" = ${classSessionId}
        FOR UPDATE
      `;

      if (lockedClassSession.length === 0) {
        throw new ClassSessionNotFoundError();
      }

      await hooks?.onLockAcquired?.();

      const classSession = lockedClassSession[0];

      if (classSession.status !== "open_for_enrollment") {
        throw new ClassSessionNotOpenError();
      }

      if (classSession.startAt.getTime() <= Date.now()) {
        throw new ClassSessionAlreadyStartedError();
      }

      const lockedTeacherProfile = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "TeacherProfile"
        WHERE "id" = ${classSession.teacherProfileId}
        FOR UPDATE
      `;

      await hooks?.onTeacherLockAcquired?.();

      if (lockedTeacherProfile.length === 0 || lockedTeacherProfile[0].status !== "approved") {
        throw new TeacherNotApprovedError();
      }

      const activeCount = await tx.enrollment.count({
        where: { classSessionId, status: { in: ["confirmed", "pending"] } },
      });

      if (activeCount >= classSession.capacity) {
        throw new ClassSessionFullError();
      }

      const existingEnrollment = await tx.enrollment.findUnique({
        where: { classSessionId_userId: { classSessionId, userId } },
        select: { id: true },
      });

      if (existingEnrollment) {
        throw new AlreadyEnrolledError();
      }

      const resolvedStatus: "pending" | "confirmed" = classSession.requiresApproval
        ? "pending"
        : "confirmed";

      const enrollment = await tx.enrollment.create({
        data: {
          classSessionId,
          userId,
          status: resolvedStatus,
          notes: input.notes,
          consentedAt: new Date(),
        },
        select: { id: true },
      });

      return { enrollmentId: enrollment.id, status: resolvedStatus };
    });

    // D4/D7 修正版：resolver query + notify 一律在 tx commit 之後才執行，不進 tx；
    // 例外（不論來自 resolver query 或 notifyOverride 本身）在這裡被吞掉，trigger
    // 外層的這層 try/catch 是 D9 端到端失敗隔離測試實際要驗證的邊界。
    try {
      const classSession = await prisma.classSession.findUnique({
        where: { id: classSessionId },
        select: { title: true, teacherProfile: { select: { userId: true } } },
      });

      if (status === "pending") {
        // 老師也要收到通知才知道有新的 pending 報名需要審核，否則審核機制永遠不會被觸發。
        await notifyOverride(
          "enrollment_pending_review",
          [
            { userId, role: "self" },
            ...(classSession
              ? [{ userId: classSession.teacherProfile.userId, role: "counterpart" as const }]
              : []),
          ],
          { classSessionTitle: classSession?.title },
        );
      } else {
        await notifyOverride(
          "enrollment_confirmed",
          [{ userId, role: "self" }],
          { classSessionTitle: classSession?.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] enrollment created trigger failed", notifyError);
    }

    return { ok: true, enrollmentId, status };
  } catch (error) {
    if (error instanceof ClassSessionNotFoundError) {
      return { ok: false, code: "class_session_not_found" };
    }

    if (error instanceof ClassSessionNotOpenError) {
      return { ok: false, code: "class_session_not_open" };
    }

    if (error instanceof ClassSessionAlreadyStartedError) {
      return { ok: false, code: "class_session_already_started" };
    }

    if (error instanceof TeacherNotApprovedError) {
      return { ok: false, code: "teacher_not_approved" };
    }

    if (error instanceof ClassSessionFullError) {
      return { ok: false, code: "class_session_full" };
    }

    if (error instanceof AlreadyEnrolledError) {
      return { ok: false, code: "already_enrolled" };
    }

    if (isUniqueConstraintViolation(error)) {
      // Defense-in-depth：正常路徑下 (f) 已經先擋掉重複，這裡只處理理論上的極端競態。
      return { ok: false, code: "already_enrolled" };
    }

    return { ok: false, code: "create_failed" };
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
