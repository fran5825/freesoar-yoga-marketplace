// teacher-class-scheduling 票 03：「從這場以後全部取消」。取消某個系列中選定的這一場，以及之後
// 所有尚未開始、狀態為草稿或開放報名的場次；之前的場次照常。系列本身保留，每週固定的系列之後
// 仍可「生成更多」。
//
// 不依賴登入狀態（呼叫端傳入 teacherProfileId），讓測試能直接驗證；對外的登入檢查在 service.ts。
// 資格沿用既有老師取消單堂的規則（own-scoped，不另外檢查老師狀態）。
//
// 鎖定（docs/specs/teacher-class-scheduling-spec.md 第 6 節）：先 `FOR UPDATE` 鎖本人系列列，
// 鎖內重新讀取「這場以後」的場次集合，再依 id 排序逐場取消（每場由單堂取消核心鎖住該場）。
// 全部在同一個 transaction 內完成；取消通知在 commit 之後才發，每一場各一則（沿用單堂取消）。

import { prisma } from "@/lib/prisma";

import {
  cancelClassSessionForTeacherInTransaction,
  notifyClassSessionCancelledForTeacher,
  type CancelledClassSessionNotice,
} from "./cancel-class-session-core-for-teacher";

export type CancelSeriesFromOccurrenceErrorCode = "series_not_found" | "class_session_not_found";

export type CancelSeriesFromOccurrenceResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; code: CancelSeriesFromOccurrenceErrorCode };

export type CancelSeriesFromOccurrenceOptions = {
  // 供 Playwright 在「已取得系列鎖」之後插入同步點。
  onSeriesLockAcquired?: () => void | Promise<void>;
};

const CANCEL_TRANSACTION_TIMEOUT_MS = 30_000;

export async function cancelSeriesFromOccurrenceForTeacherProfile(
  teacherProfileId: string,
  recurringClassSeriesId: string,
  fromClassSessionId: string,
  options: CancelSeriesFromOccurrenceOptions = {},
): Promise<CancelSeriesFromOccurrenceResult> {
  const outcome = await prisma.$transaction(
    async (tx): Promise<
      | { ok: true; cancelled: CancelledClassSessionNotice[] }
      | { ok: false; code: CancelSeriesFromOccurrenceErrorCode }
    > => {
      const lockedSeries = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "RecurringClassSeries"
        WHERE "id" = ${recurringClassSeriesId} AND "teacherProfileId" = ${teacherProfileId}
        FOR UPDATE
      `;

      if (lockedSeries.length === 0) {
        return { ok: false, code: "series_not_found" };
      }

      await options.onSeriesLockAcquired?.();

      const fromSession = await tx.classSession.findFirst({
        where: { id: fromClassSessionId, recurringClassSeriesId, teacherProfileId },
        select: { startAt: true },
      });

      if (!fromSession) {
        return { ok: false, code: "class_session_not_found" };
      }

      const targets = await tx.classSession.findMany({
        where: {
          recurringClassSeriesId,
          teacherProfileId,
          // organizer-usability-redesign 票 09：只挑老師自己開的場次，與單堂取消核心的 origin 條件一致。
          origin: "teacher_initiated",
          status: { in: ["draft", "open_for_enrollment"] },
          startAt: { gte: fromSession.startAt, gt: new Date() },
        },
        orderBy: { id: "asc" },
        select: { id: true },
      });

      const cancelled: CancelledClassSessionNotice[] = [];

      for (const target of targets) {
        const result = await cancelClassSessionForTeacherInTransaction(tx, teacherProfileId, target.id);

        // 鎖到之後才發現已開始或已被取消（例如剛好跨過開始時間）就跳過，其餘照常。
        if (result.ok) {
          cancelled.push(result.cancelled);
        }
      }

      return { ok: true, cancelled };
    },
    { timeout: CANCEL_TRANSACTION_TIMEOUT_MS },
  );

  if (!outcome.ok) {
    return outcome;
  }

  for (const cancelled of outcome.cancelled) {
    await notifyClassSessionCancelledForTeacher(teacherProfileId, cancelled);
  }

  return { ok: true, cancelledCount: outcome.cancelled.length };
}
