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
  | "create_failed";

export type CreateEnrollmentForUserResult =
  | { ok: true; enrollmentId: string }
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

// D5/D14：整段包在 prisma.$transaction 內：
// (a) 鎖住 ClassSession 並取回 status/capacity/startAt；
// (b) 檢查 status === open_for_enrollment；
// (c) 檢查 startAt > now（D14）；
// (d) confirmed enrollment 數量 < capacity；
// (e) 尚無 (classSessionId, userId) 的既有 enrollment（任何狀態，D8）；
// (f) 建立 enrollment，寫入 consentedAt（D6）。
// 檢查順序刻意如此（open_for_enrollment → 時間 → capacity → 重複報名），比照
// class-session-creation D5 已驗證過的「檢查順序決定哪個錯誤碼可達」教訓。
export async function createEnrollmentForUser(
  userId: string,
  classSessionId: string,
  input: CreateEnrollmentInput,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CreateEnrollmentForUserResult> {
  try {
    const enrollmentId = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      const lockedClassSession = await tx.$queryRaw<
        { id: string; status: string; capacity: number; startAt: Date }[]
      >`
        SELECT "id", "status", "capacity", "startAt"
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

      const confirmedCount = await tx.enrollment.count({
        where: { classSessionId, status: "confirmed" },
      });

      if (confirmedCount >= classSession.capacity) {
        throw new ClassSessionFullError();
      }

      const existingEnrollment = await tx.enrollment.findUnique({
        where: { classSessionId_userId: { classSessionId, userId } },
        select: { id: true },
      });

      if (existingEnrollment) {
        throw new AlreadyEnrolledError();
      }

      const enrollment = await tx.enrollment.create({
        data: {
          classSessionId,
          userId,
          status: "confirmed",
          notes: input.notes,
          consentedAt: new Date(),
        },
        select: { id: true },
      });

      return enrollment.id;
    });

    // D4/D7 修正版：resolver query + notify 一律在 tx commit 之後才執行，不進 tx；
    // 例外（不論來自 resolver query 或 notifyOverride 本身）在這裡被吞掉，trigger
    // 外層的這層 try/catch 是 D9 端到端失敗隔離測試實際要驗證的邊界。
    try {
      const classSession = await prisma.classSession.findUnique({
        where: { id: classSessionId },
        select: { title: true },
      });

      await notifyOverride(
        "enrollment_confirmed",
        [{ userId, role: "self" }],
        { classSessionTitle: classSession?.title },
      );
    } catch (notifyError) {
      console.error("[notification] enrollment_confirmed trigger failed", notifyError);
    }

    return { ok: true, enrollmentId };
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

    if (error instanceof ClassSessionFullError) {
      return { ok: false, code: "class_session_full" };
    }

    if (error instanceof AlreadyEnrolledError) {
      return { ok: false, code: "already_enrolled" };
    }

    if (isUniqueConstraintViolation(error)) {
      // Defense-in-depth：正常路徑下 (e) 已經先擋掉重複，這裡只處理理論上的極端競態。
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
