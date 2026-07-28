// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// cancelOwnClassSession）與 (2) Playwright 併發測試直接呼叫——取消動作會跟
// createEnrollmentForUser 搶同一個 ClassSession 資源，是本輪唯一有多方併發的場景
// （見 plan D3），比照 enrollment/__internal__/create-enrollment-core.ts 的同一套架構。

import type { NotificationType } from "@prisma/client";

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

// D1/D2/D3/D4：own-scoped，整段包在 prisma.$transaction 內：
// (a) 鎖住 ClassSession 並驗證擁有權（WHERE 子句本身就同時驗證 organizerProfileId）；
// (b) 檢查尚未是 cancelled；
// (c) 檢查狀態在可取消集合內（目前只有 draft/open_for_enrollment 會實際出現）；
// (d) 檢查 startAt > now（D2，比照 enrollment D14）；
// (e) 轉成 cancelled；
// (f) 連帶把所有 confirmed Enrollment 轉成 cancelled，RETURNING userId 供通知使用（D4）。
export async function cancelClassSessionForOrganizer(
  organizerProfileId: string,
  classSessionId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelClassSessionForOrganizerResult> {
  try {
    const { teacherProfileId, title, affectedMemberUserIds } = await prisma.$transaction(
      async (tx) => {
        await hooks?.onBeforeLock?.();

        const lockedClassSession = await tx.$queryRaw<
          { id: string; status: string; startAt: Date; teacherProfileId: string; title: string }[]
        >`
          SELECT "id", "status", "startAt", "teacherProfileId", "title"
          FROM "ClassSession"
          WHERE "id" = ${classSessionId} AND "organizerProfileId" = ${organizerProfileId}
          FOR UPDATE
        `;

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
        const cancelledEnrollments = await tx.$queryRaw<{ userId: string }[]>`
          UPDATE "Enrollment"
          SET "status" = 'cancelled'::"EnrollmentStatus", "updatedAt" = ${now}
          WHERE "classSessionId" = ${classSessionId} AND "status" = 'confirmed'::"EnrollmentStatus"
          RETURNING "userId"
        `;

        return {
          teacherProfileId: classSession.teacherProfileId,
          title: classSession.title,
          affectedMemberUserIds: cancelledEnrollments.map((row) => row.userId),
        };
      },
    );

    // D4/D7 修正版：resolver query + notify 一律在 tx commit 之後才執行，不進 tx；
    // 例外在這裡被吞掉，不影響回傳給呼叫端的結果。
    try {
      const [organizerProfile, teacherProfile] = await Promise.all([
        prisma.organizerProfile.findUnique({
          where: { id: organizerProfileId },
          select: { userId: true },
        }),
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
