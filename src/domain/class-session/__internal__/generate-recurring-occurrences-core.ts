// teacher-initiated-open-classes 第 7 節：接受一個已存在的 RecurringClassSeries 與一份
// Taipei 日曆日字串清單（"YYYY-MM-DD"），逐筆建立獨立 ClassSession row（G1 = A，materialize）。
// 常規週期的日期在呼叫端用 recurring-series-dates.ts 算；固定期課程的日期清單直接來自使用者輸入。
//
// teacher-class-scheduling 票 01：整批生成改在「同一個 transaction」內完成，並先鎖住系列列，
// 作為所有改動系列場次集合的序列化邊界（docs/specs/teacher-class-scheduling-spec.md 第 6 節）：
//   1. `FOR UPDATE` 鎖本人系列列（own-scope 寫在 WHERE）。
//   2. 鎖內重新讀取系列設定與老師狀態。
//   3. 日期可以是固定陣列，也可以是「鎖內才計算」的 resolver（生成更多要在鎖內讀最後一場）。
//   4. 逐場在同一 transaction 內建立；撞課的那場跳過、其餘照常。
//   5. commit 之後才發通知；rollback 時不發。
// 鎖定順序：系列 → 老師（撞課檢查鎖 TeacherProfile），符合全站順序。

import type { Prisma, RecurringClassSeries } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createClassSessionForTeacherInTransaction,
  notifyClassSessionsCreated,
  type CreatedClassSessionNotice,
} from "./create-teacher-class-session-core";
import { parseTaipeiDatetimeLocal } from "../timezone";

export type OccurrenceSkip = { date: string; reason: "teacher_schedule_conflict" };

export type GenerateOccurrencesResult =
  | { ok: true; createdClassSessionIds: string[]; skipped: OccurrenceSkip[] }
  | { ok: false; code: "series_not_found" | "teacher_not_approved" };

export type OccurrenceDatesResolver = (
  tx: Prisma.TransactionClient,
  series: RecurringClassSeries,
) => Promise<string[]>;

export type GenerateOccurrencesOptions = {
  // 建立後直接開放報名（票 01 的「建立後全部開放報名」勾選框）。
  openForEnrollment?: boolean;
  // 供 Playwright 併發測試在「已取得系列鎖」之後插入同步點。
  onSeriesLockAcquired?: () => void | Promise<void>;
  // 供測試在「場次都已寫入、transaction 尚未 commit」時插入動作（例如拋錯驗證 rollback 不發通知）。
  onOccurrencesWritten?: () => void | Promise<void>;
};

// 最多 26 場、每場都要鎖老師、查重疊、寫入；預設 5 秒的互動式 transaction 上限不夠保險。
const GENERATE_TRANSACTION_TIMEOUT_MS = 30_000;

class SeriesNotFoundError extends Error {}

type GenerateInTransactionOutcome =
  | {
      ok: true;
      created: CreatedClassSessionNotice[];
      skipped: OccurrenceSkip[];
    }
  | { ok: false; code: "series_not_found" | "teacher_not_approved" };

export async function generateOccurrencesForSeries(
  teacherProfileId: string,
  recurringClassSeriesId: string,
  dates: string[] | OccurrenceDatesResolver,
  options: GenerateOccurrencesOptions = {},
): Promise<GenerateOccurrencesResult> {
  let outcome: GenerateInTransactionOutcome;

  try {
    outcome = await prisma.$transaction(
      async (tx): Promise<GenerateInTransactionOutcome> => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "RecurringClassSeries"
          WHERE "id" = ${recurringClassSeriesId} AND "teacherProfileId" = ${teacherProfileId}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new SeriesNotFoundError();
        }

        await options.onSeriesLockAcquired?.();

        const series = await tx.recurringClassSeries.findUniqueOrThrow({
          where: { id: recurringClassSeriesId },
          include: { teacherProfile: { select: { status: true } } },
        });

        if (series.teacherProfile.status !== "approved") {
          return { ok: false, code: "teacher_not_approved" };
        }

        const resolvedDates =
          typeof dates === "function" ? await dates(tx, series) : dates;

        const created: CreatedClassSessionNotice[] = [];
        const skipped: OccurrenceSkip[] = [];

        for (const date of resolvedDates) {
          const startAt = parseTaipeiDatetimeLocal(`${date}T${series.startTime}`);
          const endAt = parseTaipeiDatetimeLocal(`${date}T${series.endTime}`);

          // 理論上不會發生（格式在建立 series 或輸入時已驗證），防禦性地當成這一場跳過。
          if (!startAt || !endAt) {
            skipped.push({ date, reason: "teacher_schedule_conflict" });
            continue;
          }

          const result = await createClassSessionForTeacherInTransaction(tx, teacherProfileId, {
            title: series.title,
            description: series.description,
            // schema 上 nullable，但 validateRecurringSeriesInput 列為必填，實際不會是 null。
            serviceType: series.serviceType as string,
            serviceTypes: series.serviceTypes,
            yogaStyles: series.yogaStyles,
            startAt,
            endAt,
            location: series.location,
            capacity: series.capacity,
            // 票 06：沿用系列目前的公開設定。
            isPublic: series.isPublic,
            requiresApproval: series.requiresApproval,
            recurringClassSeriesId: series.id,
            openForEnrollment: options.openForEnrollment === true,
          });

          if (result.ok) {
            created.push(result.created);
          } else if (result.code === "teacher_schedule_conflict") {
            skipped.push({ date, reason: "teacher_schedule_conflict" });
          } else if (result.code === "teacher_not_approved" && created.length === 0) {
            return { ok: false, code: "teacher_not_approved" };
          } else if (result.code === "teacher_not_approved") {
            // 極端競態：鎖住老師之前狀態被改。已建立的場次維持有效，剩餘日期不再生成。
            break;
          } else {
            throw new Error(
              `unexpected error generating occurrence for series ${recurringClassSeriesId} on ${date}: ${result.code}`,
            );
          }
        }

        await options.onOccurrencesWritten?.();

        return { ok: true, created, skipped };
      },
      { timeout: GENERATE_TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    if (error instanceof SeriesNotFoundError) {
      return { ok: false, code: "series_not_found" };
    }

    throw error;
  }

  if (!outcome.ok) {
    return outcome;
  }

  await notifyClassSessionsCreated(outcome.created);

  return {
    ok: true,
    createdClassSessionIds: outcome.created.map((created) => created.classSessionId),
    skipped: outcome.skipped,
  };
}
