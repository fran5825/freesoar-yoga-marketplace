// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// suspendApprovedTeacherProfile／restoreSuspendedTeacherProfile）與 (2) Playwright
// 決定性測試直接呼叫。抽出這個 pure-core 不是因為需要 SELECT ... FOR UPDATE 鎖序列
// （暫停/恢復沒有多方競爭同一資源的併發場景，見 plan D5），而是因為
// suspendApprovedTeacherProfile／restoreSuspendedTeacherProfile 頂層都呼叫
// requireAdmin()（依賴真正的 HTTP session），沒有這層拆分的話，D5 修正版要求的
// notifyOverride／onBeforeNotifyCheck 決定性測試就無法在 Node context 直接呼叫。

import type { NotificationType } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

import { validateTeacherProfileRestoreTransition, validateTeacherProfileSuspendTransition } from "../state";

export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

export type TeacherProfileNotifyHooks = {
  onBeforeNotifyCheck?: () => void | Promise<void>;
};

export type SuspendApprovedTeacherProfileCoreErrorCode =
  | "teacher_profile_not_found"
  | "teacher_profile_not_approved"
  | "teacher_profile_suspend_failed";

export type SuspendApprovedTeacherProfileCoreResult =
  | { ok: true }
  | { ok: false; code: SuspendApprovedTeacherProfileCoreErrorCode };

// D1/D5 修正版：只能從 approved 觸發。用帶 RETURNING 的原子 UPDATE 直接從這次成功的
// 寫入本身取回通知所需欄位，不再另外用 findUnique 組裝——避免另一位 Admin 的 restore
// 呼叫搶先跑完，讀到被覆蓋過的資料。發通知前重新確認狀態仍是 suspended，是
// best-effort 的過期抑制，不是強一致性保證（同一先例：class-session-cancellation
// D7、demand-request-cancellation D11 item 1）。
export async function suspendApprovedTeacherProfileForAdmin(
  teacherProfileId: string,
  normalizedSuspensionReason: string,
  hooks?: TeacherProfileNotifyHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<SuspendApprovedTeacherProfileCoreResult> {
  try {
    const now = new Date();
    const suspendedRows = await prisma.$queryRaw<
      { userId: string; suspensionReason: string | null }[]
    >`
      UPDATE "TeacherProfile"
      SET "status" = 'suspended'::"TeacherProfileStatus",
          "suspensionReason" = ${normalizedSuspensionReason},
          "updatedAt" = ${now}
      WHERE "id" = ${teacherProfileId} AND "status" = 'approved'::"TeacherProfileStatus"
      RETURNING "userId", "suspensionReason"
    `;

    if (suspendedRows.length === 0) {
      const existingProfile = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: { status: true },
      });

      if (!existingProfile) {
        return { ok: false, code: "teacher_profile_not_found" };
      }

      const transition = validateTeacherProfileSuspendTransition(existingProfile.status);

      if (!transition.allowed) {
        return { ok: false, code: "teacher_profile_not_approved" };
      }

      // 理論上不會發生：suspendedRows 為空代表 UPDATE 當下 status 確實不是
      // approved，跟這裡 transition.allowed 為 true 矛盾；防禦性地保留，
      // 避免萬一未來狀態機變動時靜默回報成功卻沒有真的寫入。
      return { ok: false, code: "teacher_profile_suspend_failed" };
    }

    const { userId, suspensionReason: persistedReason } = suspendedRows[0];

    try {
      await hooks?.onBeforeNotifyCheck?.();

      const current = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: { status: true },
      });

      if (current?.status !== "suspended") {
        console.log(
          "[notification] skip stale teacher_profile_suspended notification, status changed since suspend",
          { teacherProfileId },
        );
      } else {
        await notifyOverride(
          "teacher_profile_suspended",
          [{ userId, role: "self" }],
          { reason: persistedReason ?? undefined },
        );
      }
    } catch (notifyError) {
      console.error("[notification] teacher_profile_suspended trigger failed", notifyError);
    }

    return { ok: true };
  } catch {
    return { ok: false, code: "teacher_profile_suspend_failed" };
  }
}

export type RestoreSuspendedTeacherProfileCoreErrorCode =
  | "teacher_profile_not_found"
  | "teacher_profile_not_suspended"
  | "teacher_profile_restore_failed";

export type RestoreSuspendedTeacherProfileCoreResult =
  | { ok: true }
  | { ok: false; code: RestoreSuspendedTeacherProfileCoreErrorCode };

// D2/D5 修正版：只能從 suspended 觸發，同一個 RETURNING 手法與 staleness check，
// 理由與 suspendApprovedTeacherProfileForAdmin 相同。
export async function restoreSuspendedTeacherProfileForAdmin(
  teacherProfileId: string,
  hooks?: TeacherProfileNotifyHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<RestoreSuspendedTeacherProfileCoreResult> {
  try {
    const now = new Date();
    const restoredRows = await prisma.$queryRaw<{ userId: string }[]>`
      UPDATE "TeacherProfile"
      SET "status" = 'approved'::"TeacherProfileStatus",
          "suspensionReason" = NULL,
          "updatedAt" = ${now}
      WHERE "id" = ${teacherProfileId} AND "status" = 'suspended'::"TeacherProfileStatus"
      RETURNING "userId"
    `;

    if (restoredRows.length === 0) {
      const existingProfile = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: { status: true },
      });

      if (!existingProfile) {
        return { ok: false, code: "teacher_profile_not_found" };
      }

      const transition = validateTeacherProfileRestoreTransition(existingProfile.status);

      if (!transition.allowed) {
        return { ok: false, code: "teacher_profile_not_suspended" };
      }

      // 理論上不會發生：restoredRows 為空代表 UPDATE 當下 status 確實不是
      // suspended，跟這裡 transition.allowed 為 true 矛盾；防禦性地保留。
      return { ok: false, code: "teacher_profile_restore_failed" };
    }

    const { userId } = restoredRows[0];

    try {
      await hooks?.onBeforeNotifyCheck?.();

      const current = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: { status: true },
      });

      if (current?.status !== "approved") {
        console.log(
          "[notification] skip stale teacher_profile_restored notification, status changed since restore",
          { teacherProfileId },
        );
      } else {
        await notifyOverride("teacher_profile_restored", [{ userId, role: "self" }], {});
      }
    } catch (notifyError) {
      console.error("[notification] teacher_profile_restored trigger failed", notifyError);
    }

    return { ok: true };
  } catch {
    return { ok: false, code: "teacher_profile_restore_failed" };
  }
}
