// teacher-class-scheduling 票 10：老師對整期報名確認或婉拒一次（規格 4.7、第 6 節；Q26；推導規則 9）。
// __internal__：只給 term-service.ts 的 auth-resolving 外層與 Playwright 測試直接呼叫。
//
// 同一個 transaction：
//   1. `FOR UPDATE` 鎖系列列，own-scope（系列的 teacherProfileId 必須是這位老師）寫在 WHERE；
//      與追加補課（票 11）、退出整期（票 09）序列化，鎖內重讀底下的逐場報名才不會漏掉剛追加的場次。
//   2. 鎖整期報名列，必須屬於這個系列且為 pending。
//   3. 確認：底下尚未開始的 pending 逐場改 confirmed；整期改 confirmed。
//      婉拒：整期改 declined；來源 term_created 的未開始逐場改 cancelled；來源 merged_single 的逐場
//      脫離整期（seriesEnrollmentId／來源清空）、保留原狀態，恢復為單堂。
// commit 後通知學員一則（Q27）；不檢查老師狀態，比照既有單場確認／婉拒。

import { notifyUsers } from "@/domain/notification/create";
import { prisma } from "@/lib/prisma";

import { termNotificationTitle } from "../term-enrollment-copy";
import type { NotifyFn } from "./create-series-enrollment-core";

export type DecideSeriesEnrollmentErrorCode = "series_enrollment_not_found" | "series_enrollment_not_pending";

export type DecideSeriesEnrollmentResult =
  | { ok: true; affectedCount: number; restoredSingleCount: number }
  | { ok: false; code: DecideSeriesEnrollmentErrorCode };

export type DecideSeriesEnrollmentHooks = {
  onSeriesLockAcquired?: () => void | Promise<void>;
};

class Rejected extends Error {
  constructor(public readonly code: DecideSeriesEnrollmentErrorCode) {
    super(code);
  }
}

type Decision = "confirm" | "decline";

export function confirmSeriesEnrollmentForTeacher(
  teacherProfileId: string,
  seriesEnrollmentId: string,
  hooks?: DecideSeriesEnrollmentHooks,
  notifyOverride?: NotifyFn,
) {
  return decide("confirm", teacherProfileId, seriesEnrollmentId, hooks, notifyOverride);
}

export function declineSeriesEnrollmentForTeacher(
  teacherProfileId: string,
  seriesEnrollmentId: string,
  hooks?: DecideSeriesEnrollmentHooks,
  notifyOverride?: NotifyFn,
) {
  return decide("decline", teacherProfileId, seriesEnrollmentId, hooks, notifyOverride);
}

async function decide(
  decision: Decision,
  teacherProfileId: string,
  seriesEnrollmentId: string,
  hooks?: DecideSeriesEnrollmentHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<DecideSeriesEnrollmentResult> {
  // 整期報名所屬的系列不會變，先讀出來決定要鎖哪一個系列；own-scope 在鎖內重做。
  const target = await prisma.seriesEnrollment.findFirst({
    where: { id: seriesEnrollmentId, recurringClassSeries: { teacherProfileId } },
    select: { recurringClassSeriesId: true },
  });

  if (!target) {
    return { ok: false, code: "series_enrollment_not_found" };
  }

  let outcome: { userId: string; title: string; affectedCount: number; restoredSingleCount: number; sessionCount: number };

  try {
    outcome = await prisma.$transaction(async (tx) => {
      const lockedSeries = await tx.$queryRaw<{ title: string }[]>`
        SELECT "title" FROM "RecurringClassSeries"
        WHERE "id" = ${target.recurringClassSeriesId} AND "teacherProfileId" = ${teacherProfileId}
        FOR UPDATE
      `;

      if (lockedSeries.length === 0) {
        throw new Rejected("series_enrollment_not_found");
      }

      await hooks?.onSeriesLockAcquired?.();

      const locked = await tx.$queryRaw<{ status: string; userId: string }[]>`
        SELECT "status", "userId" FROM "SeriesEnrollment"
        WHERE "id" = ${seriesEnrollmentId} AND "recurringClassSeriesId" = ${target.recurringClassSeriesId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new Rejected("series_enrollment_not_found");
      }

      if (locked[0].status !== "pending") {
        throw new Rejected("series_enrollment_not_pending");
      }

      const now = new Date();
      let affectedCount = 0;
      let restoredSingleCount = 0;

      if (decision === "confirm") {
        affectedCount = (
          await tx.enrollment.updateMany({
            where: { seriesEnrollmentId, status: "pending", classSession: { startAt: { gt: now } } },
            data: { status: "confirmed" },
          })
        ).count;
        await tx.seriesEnrollment.update({ where: { id: seriesEnrollmentId }, data: { status: "confirmed" } });
      } else {
        affectedCount = (
          await tx.enrollment.updateMany({
            where: {
              seriesEnrollmentId,
              seriesEnrollmentSource: "term_created",
              status: { in: ["pending", "confirmed"] },
              classSession: { startAt: { gt: now } },
            },
            data: { status: "cancelled" },
          })
        ).count;
        restoredSingleCount = (
          await tx.enrollment.updateMany({
            where: { seriesEnrollmentId, seriesEnrollmentSource: "merged_single" },
            data: { seriesEnrollmentId: null, seriesEnrollmentSource: null },
          })
        ).count;
        await tx.seriesEnrollment.update({ where: { id: seriesEnrollmentId }, data: { status: "declined" } });
      }

      const sessionCount = await tx.enrollment.count({ where: { seriesEnrollmentId } });

      return {
        userId: locked[0].userId,
        title: lockedSeries[0].title,
        affectedCount,
        restoredSingleCount,
        sessionCount,
      };
    });
  } catch (error) {
    if (error instanceof Rejected) {
      return { ok: false, code: error.code };
    }

    throw error;
  }

  try {
    await notifyOverride(
      decision === "confirm" ? "enrollment_confirmed" : "enrollment_cancelled",
      [{ userId: outcome.userId, role: "self" }],
      {
        classSessionTitle:
          decision === "confirm"
            ? termNotificationTitle(outcome.title, outcome.sessionCount)
            : termNotificationTitle(outcome.title, outcome.affectedCount + outcome.restoredSingleCount),
      },
    );
  } catch (notifyError) {
    console.error("[notification] series enrollment decision trigger failed", notifyError);
  }

  return { ok: true, affectedCount: outcome.affectedCount, restoredSingleCount: outcome.restoredSingleCount };
}
