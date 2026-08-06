// __internal__：不是通用 API。只給 (1) admin-service.ts 的 cancelEnrollmentForAdmin 與
// (2) Playwright 測試直接呼叫。這裡不呼叫 requireAdmin()——跟既有 cancelOwnEnrollment 一樣
// 是單一列的 updateMany，不需要 SELECT ... FOR UPDATE（沒有跨列連帶效果、沒有 capacity
// 併發風險）；拆出這個檔案純粹是為了可測試性（admin-service.ts 一旦呼叫 requireAdmin()，
// 就無法在 Node/Playwright 的 throwaway script context 直接呼叫，也就沒有地方可以注入
// notifyOverride 驗證通知正確性），比照 admin-class-enrollment-management D5 的既有理由。

import type { NotificationType } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

export type CancelEnrollmentForAdminErrorCode =
  | "enrollment_not_found"
  | "class_session_already_started"
  | "enrollment_cancel_failed";

export type CancelEnrollmentForAdminResult =
  | { ok: true }
  | { ok: false; code: CancelEnrollmentForAdminErrorCode };

// D4（admin-class-enrollment-management）+ teacher-initiated-open-classes 第 8 節：
// Admin-scoped，資格條件跟既有 cancelOwnEnrollment 完全相同（status 為
// confirmed／pending 且 classSession.startAt 尚未到達），只是拿掉 userId 過濾——Admin
// 也可以取消任何人還在等待老師審核中的報名。
export async function cancelEnrollmentForAdminCore(
  enrollmentId: string,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelEnrollmentForAdminResult> {
  const updateResult = await prisma.enrollment.updateMany({
    where: {
      id: enrollmentId,
      status: { in: ["confirmed", "pending"] },
      classSession: { startAt: { gt: new Date() } },
    },
    data: { status: "cancelled" },
  });

  if (updateResult.count > 0) {
    try {
      const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { userId: true, classSession: { select: { title: true } } },
      });

      if (enrollment) {
        await notifyOverride(
          "enrollment_cancelled",
          [{ userId: enrollment.userId, role: "self" }],
          { classSessionTitle: enrollment.classSession.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] enrollment_cancelled trigger failed", notifyError);
    }

    return { ok: true };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { status: true, classSession: { select: { startAt: true } } },
  });

  if (!enrollment) {
    return { ok: false, code: "enrollment_not_found" };
  }

  if (enrollment.classSession.startAt.getTime() <= Date.now()) {
    return { ok: false, code: "class_session_already_started" };
  }

  return { ok: false, code: "enrollment_cancel_failed" };
}
