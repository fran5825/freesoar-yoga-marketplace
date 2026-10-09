// teacher-class-scheduling 票 09：學員退出整期（規格 4.7、第 6 節；推導規則 5、10）。
// __internal__：只給 term-service.ts 的 auth-resolving 外層與 Playwright 測試直接呼叫。
//
// 同一個 transaction：
//   1. 用整期報名找到系列，`FOR UPDATE` 鎖系列列（own-scope：整期報名必須是這位學員的）。
//      與追加補課（票 11）、整期確認／婉拒（票 10）序列化，鎖內重讀才不會漏掉剛追加的場次。
//   2. 鎖整期報名列，確認狀態是 pending／confirmed。
//   3. 底下尚未開始、pending／confirmed 的逐場報名改 cancelled；已開始或已完成的紀錄不動。
//   4. 整期報名改 withdrawn（終態，之後不能再報整期）。
// commit 後只通知學員本人一則（推導規則 10：不另外通知老師）。

import { notifyUsers } from "@/domain/notification/create";
import { prisma } from "@/lib/prisma";

import { termNotificationTitle } from "../term-enrollment-copy";
import type { NotifyFn } from "./create-series-enrollment-core";

export type WithdrawSeriesEnrollmentErrorCode =
  | "series_enrollment_not_found"
  | "series_enrollment_not_active";

export type WithdrawSeriesEnrollmentResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; code: WithdrawSeriesEnrollmentErrorCode };

export type WithdrawSeriesEnrollmentHooks = {
  onSeriesLockAcquired?: () => void | Promise<void>;
};

class Rejected extends Error {
  constructor(public readonly code: WithdrawSeriesEnrollmentErrorCode) {
    super(code);
  }
}

export async function withdrawSeriesEnrollmentForUser(
  userId: string,
  seriesEnrollmentId: string,
  hooks?: WithdrawSeriesEnrollmentHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<WithdrawSeriesEnrollmentResult> {
  // 整期報名所屬的系列不會變，可以先讀出來決定要鎖哪一個系列；本人檢查在鎖內重做。
  const target = await prisma.seriesEnrollment.findFirst({
    where: { id: seriesEnrollmentId, userId },
    select: { recurringClassSeriesId: true },
  });

  if (!target) {
    return { ok: false, code: "series_enrollment_not_found" };
  }

  let outcome: { cancelledCount: number; title: string };

  try {
    outcome = await prisma.$transaction(async (tx) => {
      const lockedSeries = await tx.$queryRaw<{ title: string }[]>`
        SELECT "title" FROM "RecurringClassSeries"
        WHERE "id" = ${target.recurringClassSeriesId}
        FOR UPDATE
      `;

      await hooks?.onSeriesLockAcquired?.();

      const lockedEnrollment = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "SeriesEnrollment"
        WHERE "id" = ${seriesEnrollmentId} AND "userId" = ${userId}
        FOR UPDATE
      `;

      if (lockedEnrollment.length === 0 || lockedSeries.length === 0) {
        throw new Rejected("series_enrollment_not_found");
      }

      if (lockedEnrollment[0].status !== "pending" && lockedEnrollment[0].status !== "confirmed") {
        throw new Rejected("series_enrollment_not_active");
      }

      const cancelled = await tx.enrollment.updateMany({
        where: {
          seriesEnrollmentId,
          userId,
          status: { in: ["pending", "confirmed"] },
          classSession: { startAt: { gt: new Date() } },
        },
        data: { status: "cancelled" },
      });

      await tx.seriesEnrollment.update({
        where: { id: seriesEnrollmentId },
        data: { status: "withdrawn" },
      });

      return { cancelledCount: cancelled.count, title: lockedSeries[0].title };
    });
  } catch (error) {
    if (error instanceof Rejected) {
      return { ok: false, code: error.code };
    }

    throw error;
  }

  try {
    await notifyOverride("enrollment_cancelled", [{ userId, role: "self" }], {
      classSessionTitle: termNotificationTitle(outcome.title, outcome.cancelledCount),
    });
  } catch (notifyError) {
    console.error("[notification] series enrollment withdrawn trigger failed", notifyError);
  }

  return { ok: true, cancelledCount: outcome.cancelledCount };
}
