// teacher-class-scheduling 票 05：系列改課「改這場和之後所有場次」。
//
// 套用到選定的這一場與之後所有尚未開始、未取消（草稿／開放報名）的場次：每一場維持原本的日期，
// 只套用新的上課時段；內容、地點、人數上限每一場都改。成功後同步更新 RecurringClassSeries 的設定，
// 之後「生成更多」與追加的場次沿用。不能改日期與星期（產品主人決定），不能改公開設定與是否需要確認報名。
//
// 推導規則 4：任一場撞課，或新的人數上限低於任一場的 pending + confirmed，整批都不寫，並回報是哪一天。
//
// 鎖定（docs/specs/teacher-class-scheduling-spec.md 第 6 節）：一個 transaction 內
// `FOR UPDATE` 鎖本人系列列 → 鎖內重讀「這一場起」的場次集合 → 依 id 排序鎖住這些場次 →
// 鎖 TeacherProfile 並確認 approved → 驗證、逐場撞課與名額檢查 → 全部通過才寫入。
// 改了時間或地點時，commit 之後通知受影響場次中 pending／confirmed 的學員，每位學員只發一則（決定 A）。
//
// 不依賴登入狀態（呼叫端傳入 teacherProfileId），讓測試能直接驗證；登入檢查在 service.ts。

import { prisma } from "@/lib/prisma";
import { lockTeacherScheduleAndCheckConflict } from "@/domain/class-session/conflict-check";
import { notifyUsers } from "@/domain/notification/create";

import { formatTaipeiDatetimeLocal, formatTaipeiShortDatetime } from "../timezone";
import {
  validateClassSessionCreate,
  type ClassSessionValidationError,
} from "../validation";

export type EditSeriesFromOccurrenceInput = {
  title?: string | null;
  description?: string | null;
  serviceTypes?: string[] | null;
  yogaStyles?: string[] | null;
  // 新的上課時段（台北時間 HH:mm），套用到每一場原本的日期。
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  capacity?: number | null;
};

export type EditSeriesFromOccurrenceErrorCode =
  | "series_not_found"
  | "class_session_not_found"
  | "class_session_not_editable"
  | "class_session_already_started"
  | "teacher_not_approved"
  | "validation_failed"
  | "teacher_schedule_conflict"
  | "capacity_below_enrolled";

export type EditSeriesFromOccurrenceResult =
  | { ok: true; updatedCount: number; notifiedMemberCount: number }
  | {
      ok: false;
      code: EditSeriesFromOccurrenceErrorCode;
      validationErrors?: ClassSessionValidationError[];
      // 撞課或名額不足的那一場的開始時間，讓畫面指出是哪一天。
      failedStartAt?: Date;
      enrolledCount?: number;
    };

export type EditSeriesFromOccurrenceHooks = {
  onSeriesLockAcquired?: () => void | Promise<void>;
};

const EDIT_TRANSACTION_TIMEOUT_MS = 30_000;

class EditRejected extends Error {
  constructor(public readonly result: Extract<EditSeriesFromOccurrenceResult, { ok: false }>) {
    super(result.code);
  }
}

type MemberNotice = { userId: string; sessionCount: number };

type Outcome = {
  updatedCount: number;
  seriesTitle: string;
  summary: string;
  members: MemberNotice[];
};

export async function editSeriesFromOccurrenceForTeacher(
  teacherProfileId: string,
  recurringClassSeriesId: string,
  fromClassSessionId: string,
  input: EditSeriesFromOccurrenceInput,
  hooks?: EditSeriesFromOccurrenceHooks,
): Promise<EditSeriesFromOccurrenceResult> {
  let outcome: Outcome;

  try {
    outcome = await prisma.$transaction(
      async (tx): Promise<Outcome> => {
        const lockedSeries = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "RecurringClassSeries"
          WHERE "id" = ${recurringClassSeriesId} AND "teacherProfileId" = ${teacherProfileId}
          FOR UPDATE
        `;

        if (lockedSeries.length === 0) {
          throw new EditRejected({ ok: false, code: "series_not_found" });
        }

        await hooks?.onSeriesLockAcquired?.();

        const fromSession = await tx.classSession.findFirst({
          where: { id: fromClassSessionId, recurringClassSeriesId, teacherProfileId },
          select: { startAt: true, status: true, origin: true },
        });

        if (!fromSession) {
          throw new EditRejected({ ok: false, code: "class_session_not_found" });
        }

        if (
          fromSession.origin !== "teacher_initiated" ||
          (fromSession.status !== "draft" && fromSession.status !== "open_for_enrollment")
        ) {
          throw new EditRejected({ ok: false, code: "class_session_not_editable" });
        }

        if (fromSession.startAt.getTime() <= Date.now()) {
          throw new EditRejected({ ok: false, code: "class_session_already_started" });
        }

        // 鎖住「這一場起」尚未開始的草稿／開放報名場次（依 id 排序，與其他批次操作同一順序）。
        const targets = await tx.$queryRaw<
          { id: string; startAt: Date; endAt: Date; location: string; origin: string }[]
        >`
          SELECT "id", "startAt", "endAt", "location", "origin" FROM "ClassSession"
          WHERE "recurringClassSeriesId" = ${recurringClassSeriesId}
            AND "teacherProfileId" = ${teacherProfileId}
            AND "status" = ANY(ARRAY['draft', 'open_for_enrollment']::"ClassSessionStatus"[])
            AND "startAt" >= ${fromSession.startAt}
            AND "startAt" > ${new Date()}
          ORDER BY "id"
          FOR UPDATE
        `;

        const lockedTeacher = await tx.$queryRaw<{ status: string }[]>`
          SELECT "status" FROM "TeacherProfile" WHERE "id" = ${teacherProfileId} FOR UPDATE
        `;

        if (lockedTeacher[0]?.status !== "approved") {
          throw new EditRejected({ ok: false, code: "teacher_not_approved" });
        }

        const byStart = [...targets].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
        const planned: {
          id: string;
          startAt: Date;
          endAt: Date;
          timeChanged: boolean;
          locationChanged: boolean;
        }[] = [];
        let normalized: ReturnType<typeof validateClassSessionCreate> | null = null;

        for (const target of byStart) {
          const date = formatTaipeiDatetimeLocal(target.startAt).split("T")[0];
          const validation = validateClassSessionCreate(
            {
              title: input.title,
              description: input.description,
              serviceTypes: input.serviceTypes,
              yogaStyles: input.yogaStyles,
              startAt: `${date}T${input.startTime ?? ""}`,
              endAt: `${date}T${input.endTime ?? ""}`,
              location: input.location,
              capacity: input.capacity,
            },
            { requireYogaStyles: true },
          );

          if (!validation.valid) {
            throw new EditRejected({
              ok: false,
              code: "validation_failed",
              validationErrors: validation.errors,
              failedStartAt: target.startAt,
            });
          }

          normalized = validation;
          const next = validation.normalized;
          const timeChanged =
            next.startAt.getTime() !== target.startAt.getTime() ||
            next.endAt.getTime() !== target.endAt.getTime();

          if (timeChanged) {
            const conflict = await lockTeacherScheduleAndCheckConflict(
              tx,
              teacherProfileId,
              next.startAt,
              next.endAt,
              target.id,
            );

            if (conflict) {
              throw new EditRejected({
                ok: false,
                code: "teacher_schedule_conflict",
                failedStartAt: target.startAt,
              });
            }
          }

          const activeCount = await tx.enrollment.count({
            where: { classSessionId: target.id, status: { in: ["pending", "confirmed"] } },
          });

          if (next.capacity < activeCount) {
            throw new EditRejected({
              ok: false,
              code: "capacity_below_enrolled",
              failedStartAt: target.startAt,
              enrolledCount: activeCount,
            });
          }

          planned.push({
            id: target.id,
            startAt: next.startAt,
            endAt: next.endAt,
            timeChanged,
            locationChanged: next.location !== target.location,
          });
        }

        if (!normalized || !normalized.valid) {
          // 沒有任何可改的場次（例如剛好都已開始）：視為這一場不能改。
          throw new EditRejected({ ok: false, code: "class_session_not_editable" });
        }

        const next = normalized.normalized;

        for (const item of planned) {
          await tx.classSession.update({
            where: { id: item.id },
            data: {
              title: next.title,
              description: next.description,
              serviceType: next.serviceType,
              serviceTypes: next.serviceTypes,
              yogaStyles: next.yogaStyles,
              startAt: item.startAt,
              endAt: item.endAt,
              location: next.location,
              capacity: next.capacity,
            },
          });
        }

        await tx.recurringClassSeries.update({
          where: { id: recurringClassSeriesId },
          data: {
            title: next.title,
            description: next.description,
            serviceType: next.serviceType,
            serviceTypes: next.serviceTypes,
            yogaStyles: next.yogaStyles,
            startTime: input.startTime ?? undefined,
            endTime: input.endTime ?? undefined,
            location: next.location,
            capacity: next.capacity,
          },
        });

        // 只有時間或地點有變的場次才需要通知；同一位學員合併成一則。
        const notifySessionIds = planned
          .filter((item) => item.timeChanged || item.locationChanged)
          .map((item) => item.id);
        const enrollments = notifySessionIds.length
          ? await tx.enrollment.findMany({
              where: { classSessionId: { in: notifySessionIds }, status: { in: ["pending", "confirmed"] } },
              select: { userId: true },
            })
          : [];
        const counts = new Map<string, number>();

        for (const enrollment of enrollments) {
          counts.set(enrollment.userId, (counts.get(enrollment.userId) ?? 0) + 1);
        }

        const anyTimeChanged = planned.some((item) => item.timeChanged);
        const anyLocationChanged = planned.some((item) => item.locationChanged);
        const parts: string[] = [];

        if (anyTimeChanged) {
          parts.push(`上課時間改為 ${input.startTime}–${input.endTime}`);
        }

        if (anyLocationChanged) {
          parts.push(`地點改為 ${next.location}`);
        }

        return {
          updatedCount: planned.length,
          seriesTitle: next.title,
          // 例如「從 10/13（二）起，上課時間改為 19:30–20:30；地點改為 …」。
          summary: `從 ${formatTaipeiShortDatetime(byStart[0].startAt).replace(/\d{2}:\d{2}$/, "")}起，${parts.join("；")}`,
          members: [...counts].map(([userId, sessionCount]) => ({ userId, sessionCount })),
        };
      },
      { timeout: EDIT_TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    if (error instanceof EditRejected) {
      return error.result;
    }

    throw error;
  }

  // 通知在 commit 之後；每位學員一則，寫明影響他報名的幾堂。失敗只記錄，不撤銷修改。
  for (const member of outcome.members) {
    try {
      await notifyUsers("class_session_changed", [{ userId: member.userId, role: "affected_member" }], {
        classSessionTitle: outcome.seriesTitle,
        changeSummary: `${outcome.summary}（影響你報名的 ${member.sessionCount} 堂）`,
      });
    } catch (notifyError) {
      console.error("[notification] class_session_changed (series) trigger failed", notifyError);
    }
  }

  return {
    ok: true,
    updatedCount: outcome.updatedCount,
    notifiedMemberCount: outcome.members.length,
  };
}
