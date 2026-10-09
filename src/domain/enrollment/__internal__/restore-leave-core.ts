// __internal__：不是通用 API。給 term-service.ts 的 restoreOwnLeave（auth 外層）與 Playwright 併發測試直接呼叫。
//
// enrollment-re-enrollment 票 03（ADR 0006、spec 4.3）：整期學員對某一堂請假之後，開課前可以取消請假，
// 回到原本的整期報名。鎖定順序與整期報名一致：RecurringClassSeries → ClassSession → TeacherProfile → 這一筆報名，
// 所以和整期報名、退出整期、單堂報名搶名額時不會 deadlock，也不會讀到過期的名額。

import { prisma } from "@/lib/prisma";

import { occupyingEnrollmentWhere } from "../seat-occupancy";

export type RestoreLeaveErrorCode =
  | "enrollment_not_found"
  | "leave_not_restorable"
  | "series_enrollment_not_active"
  | "class_session_not_open"
  | "class_session_already_started"
  | "teacher_not_approved"
  | "leave_restore_session_full"
  | "restore_failed";

export type RestoreLeaveResult =
  | { ok: true; status: "pending" | "confirmed" }
  | { ok: false; code: RestoreLeaveErrorCode };

export type RestoreLeaveHooks = {
  onSeriesLockAcquired?: () => void | Promise<void>;
  onSessionLockAcquired?: () => void | Promise<void>;
};

class Rejected extends Error {
  constructor(public readonly code: RestoreLeaveErrorCode) {
    super(code);
  }
}

export async function restoreLeaveForUser(
  userId: string,
  enrollmentId: string,
  hooks?: RestoreLeaveHooks,
): Promise<RestoreLeaveResult> {
  // 這一筆屬於哪個系列與場次不會變，先讀出來決定要鎖誰；本人與狀態檢查在鎖內重做。
  const target = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, userId },
    select: { classSessionId: true, seriesEnrollment: { select: { recurringClassSeriesId: true } } },
  });

  if (!target) {
    return { ok: false, code: "enrollment_not_found" };
  }

  if (!target.seriesEnrollment) {
    return { ok: false, code: "leave_not_restorable" };
  }

  const recurringClassSeriesId = target.seriesEnrollment.recurringClassSeriesId;

  try {
    return await prisma.$transaction(async (tx): Promise<RestoreLeaveResult> => {
      const lockedSeries = await tx.$queryRaw<{ teacherProfileId: string; termEnrollmentMode: string | null }[]>`
        SELECT "teacherProfileId", "termEnrollmentMode" FROM "RecurringClassSeries"
        WHERE "id" = ${recurringClassSeriesId}
        FOR UPDATE
      `;

      if (lockedSeries.length === 0) {
        throw new Rejected("enrollment_not_found");
      }

      await hooks?.onSeriesLockAcquired?.();

      const lockedSession = await tx.$queryRaw<{ status: string; capacity: number; startAt: Date }[]>`
        SELECT "status", "capacity", "startAt" FROM "ClassSession"
        WHERE "id" = ${target.classSessionId}
        FOR UPDATE
      `;

      if (lockedSession.length === 0) {
        throw new Rejected("enrollment_not_found");
      }

      await hooks?.onSessionLockAcquired?.();

      const lockedTeacher = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "TeacherProfile"
        WHERE "id" = ${lockedSeries[0].teacherProfileId}
        FOR UPDATE
      `;

      const lockedEnrollment = await tx.$queryRaw<
        { status: string; cancelledBy: string | null; seriesEnrollmentId: string | null }[]
      >`
        SELECT "status", "cancelledBy", "seriesEnrollmentId" FROM "Enrollment"
        WHERE "id" = ${enrollmentId} AND "userId" = ${userId}
        FOR UPDATE
      `;

      if (lockedEnrollment.length === 0) {
        throw new Rejected("enrollment_not_found");
      }

      const own = lockedEnrollment[0];

      if (own.status !== "cancelled" || own.cancelledBy !== "member" || own.seriesEnrollmentId === null) {
        throw new Rejected("leave_not_restorable");
      }

      const seriesEnrollment = await tx.seriesEnrollment.findUnique({
        where: { id: own.seriesEnrollmentId },
        select: { status: true },
      });

      // R8：整期退出或被婉拒之後，沒有地方可以「回到」。
      if (!seriesEnrollment || (seriesEnrollment.status !== "pending" && seriesEnrollment.status !== "confirmed")) {
        throw new Rejected("series_enrollment_not_active");
      }

      const session = lockedSession[0];

      if (session.startAt.getTime() <= Date.now()) {
        throw new Rejected("class_session_already_started");
      }

      if (session.status !== "open_for_enrollment") {
        throw new Rejected("class_session_not_open");
      }

      if (lockedTeacher[0]?.status !== "approved") {
        throw new Rejected("teacher_not_approved");
      }

      // term_only：請假名額一直保留給請假的人（占用名額規則），不需要名額檢查。
      // term_and_single：請假名額已釋出，被單堂買滿就不能取消請假。
      if (lockedSeries[0].termEnrollmentMode !== "term_only") {
        const occupied = await tx.enrollment.count({
          where: { classSessionId: target.classSessionId, ...occupyingEnrollmentWhere },
        });

        if (occupied >= session.capacity) {
          throw new Rejected("leave_restore_session_full");
        }
      }

      // 狀態跟著整期報名目前的狀態（整期已確認回 confirmed，整期還在 pending 回 pending）；保留整期關聯與同意時間。
      const restored = await tx.enrollment.updateMany({
        where: { id: enrollmentId, userId, status: "cancelled", cancelledBy: "member" },
        data: { status: seriesEnrollment.status, cancelledBy: null },
      });

      if (restored.count === 0) {
        throw new Rejected("leave_not_restorable");
      }

      return { ok: true, status: seriesEnrollment.status };
    });
  } catch (error) {
    if (error instanceof Rejected) {
      return { ok: false, code: error.code };
    }

    console.error("[restore-leave] failed", error);
    return { ok: false, code: "restore_failed" };
  }
}
