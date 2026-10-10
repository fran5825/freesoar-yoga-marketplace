// teacher-class-scheduling 票 11：期班追加補課日期（規格 4.4、第 6 節；Q16、Q22；推導規則 2、3）。
// __internal__：只給 term-service.ts 的 auth-resolving 外層與 Playwright 測試直接呼叫。
//
// 同一個 transaction：
//   1. `FOR UPDATE` 鎖本人系列列（own-scope 寫在 WHERE），鎖內重讀設定；只限期班。
//   2. 鎖內重算尚未開始、未取消的場次：追加後合計不得超過 26。
//   3. 鎖內重讀有效（pending／confirmed）整期學員：人數超過名額上限就不能追加（推導規則 3）。
//   4. 撞課檢查（鎖 TeacherProfile；系列 → 老師），撞到就不建立並回傳撞到的那堂課名。
//   5. 建立場次，沿用系列目前設定（含公開設定與學員資訊）；剩下的場次都已開放時直接開放報名（推導規則 2）。
//   6. 有效整期學員自動報上：沿用各自整期報名的狀態（confirmed → confirmed，pending → pending），來源 term_created。
// commit 之後才發通知（老師「課程已建立」、每位自動報上的學員一則）；rollback 不發。

import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/domain/notification/create";

import { readTermPaymentSnapshot } from "@/domain/enrollment/payment-snapshot";

import { lockTeacherScheduleAndCheckConflict } from "../conflict-check";
import { FIXED_DATES_COUNT_MAX } from "../recurring-series-validation";
import { formatTaipeiShortDatetime, parseTaipeiDatetimeLocal } from "../timezone";
import {
  createClassSessionForTeacherInTransaction,
  notifyClassSessionsCreated,
  type CreatedClassSessionNotice,
} from "./create-teacher-class-session-core";

export type AddMakeupSessionErrorCode =
  | "series_not_found"
  | "series_not_term"
  | "date_invalid"
  | "date_not_future"
  | "too_many_sessions"
  | "capacity_below_term_members"
  | "teacher_schedule_conflict"
  | "teacher_not_approved";

export type AddMakeupSessionResult =
  | { ok: true; classSessionId: string; autoEnrolledCount: number; openedForEnrollment: boolean }
  | {
      ok: false;
      code: AddMakeupSessionErrorCode;
      // teacher_schedule_conflict：撞到的那堂課名；capacity_below_term_members：整期學員人數。
      conflictTitle?: string;
      termMemberCount?: number;
    };

export type AddMakeupSessionHooks = {
  onSeriesLockAcquired?: () => void | Promise<void>;
  // 場次與自動報名都寫入、transaction 尚未 commit 時（測試用來驗證 rollback 不發通知）。
  onWritten?: () => void | Promise<void>;
};

export type NotifyFn = typeof notifyUsers;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class Rejected extends Error {
  constructor(public readonly result: Extract<AddMakeupSessionResult, { ok: false }>) {
    super(result.code);
  }
}

export async function addMakeupSessionForTeacher(
  teacherProfileId: string,
  recurringClassSeriesId: string,
  date: string,
  hooks?: AddMakeupSessionHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<AddMakeupSessionResult> {
  if (!DATE_PATTERN.test(date)) {
    return { ok: false, code: "date_invalid" };
  }

  let outcome: {
    created: CreatedClassSessionNotice;
    openedForEnrollment: boolean;
    autoEnrolled: { userId: string; status: "pending" | "confirmed" }[];
    noticeTitle: string;
  };

  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "RecurringClassSeries"
          WHERE "id" = ${recurringClassSeriesId} AND "teacherProfileId" = ${teacherProfileId}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new Rejected({ ok: false, code: "series_not_found" });
        }

        await hooks?.onSeriesLockAcquired?.();

        const series = await tx.recurringClassSeries.findUniqueOrThrow({ where: { id: recurringClassSeriesId } });

        if (series.kind !== "term") {
          throw new Rejected({ ok: false, code: "series_not_term" });
        }

        const startAt = parseTaipeiDatetimeLocal(`${date}T${series.startTime}`);
        const endAt = parseTaipeiDatetimeLocal(`${date}T${series.endTime}`);

        if (!startAt || !endAt) {
          throw new Rejected({ ok: false, code: "date_invalid" });
        }

        const now = new Date();

        if (startAt.getTime() <= now.getTime()) {
          throw new Rejected({ ok: false, code: "date_not_future" });
        }

        const remaining = await tx.classSession.findMany({
          where: { recurringClassSeriesId, status: { not: "cancelled" }, startAt: { gt: now } },
          select: { status: true },
        });

        if (remaining.length + 1 > FIXED_DATES_COUNT_MAX) {
          throw new Rejected({ ok: false, code: "too_many_sessions" });
        }

        const termMembers = await tx.seriesEnrollment.findMany({
          where: { recurringClassSeriesId, status: { in: ["pending", "confirmed"] } },
          select: { id: true, userId: true, status: true, notes: true, consentedAt: true },
        });

        if (termMembers.length > series.capacity) {
          throw new Rejected({
            ok: false,
            code: "capacity_below_term_members",
            termMemberCount: termMembers.length,
          });
        }

        const conflict = await lockTeacherScheduleAndCheckConflict(tx, teacherProfileId, startAt, endAt);

        if (conflict) {
          throw new Rejected({ ok: false, code: "teacher_schedule_conflict", conflictTitle: conflict.title });
        }

        const openedForEnrollment = remaining.every((session) => session.status === "open_for_enrollment");
        const result = await createClassSessionForTeacherInTransaction(tx, teacherProfileId, {
          title: series.title,
          description: series.description,
          suitableFor: series.suitableFor,
          preparationNotes: series.preparationNotes,
          priceNote: series.priceNote,
          serviceType: series.serviceType as string,
          serviceTypes: series.serviceTypes,
          yogaStyles: series.yogaStyles,
          startAt,
          endAt,
          location: series.location,
          capacity: series.capacity,
          isPublic: series.isPublic,
          requiresApproval: series.requiresApproval,
          recurringClassSeriesId,
          openForEnrollment: openedForEnrollment,
        });

        if (!result.ok) {
          throw new Rejected({
            ok: false,
            code: result.code === "teacher_not_approved" ? "teacher_not_approved" : "teacher_schedule_conflict",
          });
        }

        const autoEnrolled = termMembers.map((member) => ({
          userId: member.userId,
          status: member.status === "confirmed" ? ("confirmed" as const) : ("pending" as const),
        }));

        // lightweight-payment-v0（付款計畫 §6）：補課沿用每位整期學員「整期報名建立當下」的快照，不重新讀老師現在的資料。
        const snapshotByMember = new Map<string, Awaited<ReturnType<typeof readTermPaymentSnapshot>>>();

        for (const member of termMembers) {
          snapshotByMember.set(member.id, await readTermPaymentSnapshot(tx, member.id));
        }

        if (termMembers.length > 0) {
          await tx.enrollment.createMany({
            data: termMembers.map((member) => ({
              classSessionId: result.created.classSessionId,
              userId: member.userId,
              status: member.status === "confirmed" ? ("confirmed" as const) : ("pending" as const),
              notes: member.notes,
              consentedAt: member.consentedAt,
              seriesEnrollmentId: member.id,
              seriesEnrollmentSource: "term_created" as const,
              ...snapshotByMember.get(member.id)!,
            })),
          });
        }

        await hooks?.onWritten?.();

        return {
          created: result.created,
          openedForEnrollment,
          autoEnrolled,
          noticeTitle: `${series.title}（補課 ${formatTaipeiShortDatetime(startAt)}）`,
        };
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof Rejected) {
      return error.result;
    }

    throw error;
  }

  await notifyClassSessionsCreated([outcome.created]);

  for (const member of outcome.autoEnrolled) {
    try {
      await notifyOverride(
        member.status === "confirmed" ? "enrollment_confirmed" : "enrollment_pending_review",
        [{ userId: member.userId, role: "self" }],
        { classSessionTitle: outcome.noticeTitle },
      );
    } catch (notifyError) {
      console.error("[notification] makeup auto-enrollment trigger failed", notifyError);
    }
  }

  return {
    ok: true,
    classSessionId: outcome.created.classSessionId,
    autoEnrolledCount: outcome.autoEnrolled.length,
    openedForEnrollment: outcome.openedForEnrollment,
  };
}
