// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// cancelOwnClassSession、admin-service.ts 的 cancelClassSessionForAdmin）與 (2) Playwright
// 併發測試直接呼叫——取消動作會跟 createEnrollmentForUser 搶同一個 ClassSession 資源，是
// 唯一有多方併發的場景（見 class-session-cancellation D3），比照
// enrollment/__internal__/create-enrollment-core.ts 的同一套架構。
//
// admin-class-enrollment-management 一輪（D5）：cancelClassSessionForOrganizer 與
// cancelClassSessionForAdmin 共用同一段鎖 + 連帶取消 + 通知的交易邏輯（private
// cancelClassSessionCore），差別只在鎖查詢的 WHERE 要不要帶 organizerProfileId 擁有權過濾。
// 兩者都不呼叫 requireUser()/requireAdmin()，權限檢查一律交給呼叫端解析。

import type { NotificationType } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

// 供 D10 端到端失敗隔離測試注入；預設值就是「解析收件人 + 呼叫 notifyUsers」的真正邏輯。
export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

export type DemandLockHooks = {
  onBeforeLock?: () => void | Promise<void>;
  onLockAcquired?: () => void | Promise<void>;
};

export type CancelClassSessionForOrganizerErrorCode =
  | "class_session_not_found"
  | "class_session_already_cancelled"
  | "class_session_already_started"
  | "class_session_not_cancellable"
  | "cancel_failed";

export type CancelClassSessionForOrganizerResult =
  | { ok: true }
  | { ok: false; code: CancelClassSessionForOrganizerErrorCode };

class ClassSessionNotFoundError extends Error {
  constructor() {
    super("Class session not found or not owned by this organizer");
    this.name = "ClassSessionNotFoundError";
  }
}

class ClassSessionAlreadyCancelledError extends Error {
  constructor() {
    super("Class session is already cancelled");
    this.name = "ClassSessionAlreadyCancelledError";
  }
}

class ClassSessionAlreadyStartedError extends Error {
  constructor() {
    super("Class session has already started");
    this.name = "ClassSessionAlreadyStartedError";
  }
}

class ClassSessionNotCancellableError extends Error {
  constructor() {
    super("Class session is not in a cancellable state");
    this.name = "ClassSessionNotCancellableError";
  }
}

const CANCELLABLE_STATUSES = new Set(["draft", "open_for_enrollment"]);

// D1/D2/D3/D4（class-session-cancellation）+ D5（admin-class-enrollment-management）：
// organizerProfileId 為 null 代表 Admin-scoped，鎖查詢不過濾擁有權。整段包在
// prisma.$transaction 內：
// (a) 鎖住 ClassSession（Organizer 路徑同時驗證擁有權，Admin 路徑鎖任何一筆）；
// (b) 檢查尚未是 cancelled；
// (c) 檢查狀態在可取消集合內（目前只有 draft/open_for_enrollment 會實際出現）；
// (d) 檢查 startAt > now（D2，比照 enrollment D14）；
// (e) 轉成 cancelled；
// (f) 連帶把所有 confirmed Enrollment 轉成 cancelled，RETURNING userId 供通知使用（D4）。
// 鎖查詢額外帶出這筆 ClassSession 實際的 organizerProfileId，tx commit 之後的通知收件人
// 解析一律使用這個從資料庫讀出來的值，不是函式參數——Admin 路徑呼叫時函式參數是 null，
// 用參數解析 Organizer 收件人會查不到人，讓 Organizer 完全收不到通知（admin-class-
// enrollment-management D5，codex round 2 指出的問題）。
async function cancelClassSessionCore(
  organizerProfileId: string | null,
  classSessionId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelClassSessionForOrganizerResult> {
  try {
    const {
      organizerProfileId: resolvedOrganizerProfileId,
      teacherProfileId,
      title,
      affectedMemberUserIds,
    } = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      const ownershipFilter =
        organizerProfileId !== null
          ? Prisma.sql`AND "organizerProfileId" = ${organizerProfileId}`
          : Prisma.empty;

      const lockedClassSession = await tx.$queryRaw<
        {
          id: string;
          status: string;
          startAt: Date;
          // teacher-initiated-open-classes：nullable 化之後，老師自建課程這裡讀回來就是
          // 真正的 null（不只是型別上允許），下面的通知解析必須改成條件式查詢。
          organizerProfileId: string | null;
          teacherProfileId: string;
          title: string;
        }[]
      >(Prisma.sql`
          SELECT "id", "status", "startAt", "organizerProfileId", "teacherProfileId", "title"
          FROM "ClassSession"
          WHERE "id" = ${classSessionId} ${ownershipFilter}
          FOR UPDATE
        `);

      if (lockedClassSession.length === 0) {
        throw new ClassSessionNotFoundError();
      }

      await hooks?.onLockAcquired?.();

      const classSession = lockedClassSession[0];

      if (classSession.status === "cancelled") {
        throw new ClassSessionAlreadyCancelledError();
      }

      if (!CANCELLABLE_STATUSES.has(classSession.status)) {
        throw new ClassSessionNotCancellableError();
      }

      if (classSession.startAt.getTime() <= Date.now()) {
        throw new ClassSessionAlreadyStartedError();
      }

      await tx.classSession.update({
        where: { id: classSessionId },
        data: { status: "cancelled" },
      });

      const now = new Date();
      // teacher-initiated-open-classes 第 8 節：連帶取消同步涵蓋 pending——課程被取消時，
      // 等待老師審核中的報名不該被遺留成孤兒資料，必須跟 confirmed 一起轉為 cancelled。
      const cancelledEnrollments = await tx.$queryRaw<{ userId: string }[]>`
          UPDATE "Enrollment"
          SET "status" = 'cancelled'::"EnrollmentStatus", "updatedAt" = ${now}
          WHERE "classSessionId" = ${classSessionId}
            AND "status" = ANY(ARRAY['confirmed', 'pending']::"EnrollmentStatus"[])
          RETURNING "userId"
        `;

      return {
        organizerProfileId: classSession.organizerProfileId,
        teacherProfileId: classSession.teacherProfileId,
        title: classSession.title,
        affectedMemberUserIds: cancelledEnrollments.map((row) => row.userId),
      };
    });

    // D4/D7 修正版：resolver query + notify 一律在 tx commit 之後才執行，不進 tx；
    // 例外在這裡被吞掉，不影響回傳給呼叫端的結果。
    try {
      // teacher-initiated-open-classes 第 7 節 Codex round 2 修正：resolvedOrganizerProfileId
      // 現在可能是 null（老師自建課程），Prisma 的 findUnique({where:{id: null}}) 會拋驗證
      // 例外——這段包在下面的 try/catch 裡，例外會被整批悄悄吞掉，結果是 Admin 取消一堂老師
      // 自建課程時，取消本身成功，但老師與所有受影響會員的通知會無聲消失。改成條件式查詢。
      const [organizerProfile, teacherProfile] = await Promise.all([
        resolvedOrganizerProfileId
          ? prisma.organizerProfile.findUnique({
              where: { id: resolvedOrganizerProfileId },
              select: { userId: true },
            })
          : Promise.resolve(null),
        prisma.teacherProfile.findUnique({
          where: { id: teacherProfileId },
          select: { userId: true },
        }),
      ]);

      const recipients: NotificationRecipient[] = [];

      if (organizerProfile) {
        recipients.push({ userId: organizerProfile.userId, role: "self" });
      }

      if (teacherProfile) {
        recipients.push({ userId: teacherProfile.userId, role: "counterpart" });
      }

      for (const memberUserId of affectedMemberUserIds) {
        recipients.push({ userId: memberUserId, role: "affected_member" });
      }

      await notifyOverride("class_session_cancelled", recipients, { classSessionTitle: title });
    } catch (notifyError) {
      console.error("[notification] class_session_cancelled trigger failed", notifyError);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof ClassSessionNotFoundError) {
      return { ok: false, code: "class_session_not_found" };
    }

    if (error instanceof ClassSessionAlreadyCancelledError) {
      return { ok: false, code: "class_session_already_cancelled" };
    }

    if (error instanceof ClassSessionAlreadyStartedError) {
      return { ok: false, code: "class_session_already_started" };
    }

    if (error instanceof ClassSessionNotCancellableError) {
      return { ok: false, code: "class_session_not_cancellable" };
    }

    return { ok: false, code: "cancel_failed" };
  }
}

export async function cancelClassSessionForOrganizer(
  organizerProfileId: string,
  classSessionId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelClassSessionForOrganizerResult> {
  return cancelClassSessionCore(organizerProfileId, classSessionId, hooks, notifyOverride);
}

// D5（admin-class-enrollment-management）：Admin-scoped，鎖任何一筆 ClassSession，不檢查
// 擁有權。呼叫端（admin-service.ts）負責 requireAdmin() 把關。
export async function cancelClassSessionForAdmin(
  classSessionId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelClassSessionForOrganizerResult> {
  return cancelClassSessionCore(null, classSessionId, hooks, notifyOverride);
}
