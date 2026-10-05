// teacher-class-scheduling 票 02：找出「每週固定」系列中，尚未開始、未取消的場次少於 2 場的系列，
// 讓老師總覽提醒「生成更多」。只讀取，不改資料。
// 不依賴登入狀態（呼叫端傳入 teacherProfileId），讓測試能直接驗證；對外的登入與老師狀態檢查在
// read-service.ts 的 listOwnWeeklySeriesNeedingMoreForTeacher。
// 指定日期系列（dayOfWeek 為 null）不能生成更多，所以不提醒；票 07 加上系列型態後改為「只針對持續開課」。

import { prisma } from "@/lib/prisma";

// 剩下的未來場次少於這個數字就提醒（規格 Q4：剩不到 2 場）。
export const SERIES_REMAINING_REMINDER_THRESHOLD = 2;

export type WeeklySeriesNeedingMore = {
  id: string;
  title: string;
  remainingCount: number;
  // 剩下場次中最晚的一場；剩 0 場時為 null。
  lastUpcomingStartAt: Date | null;
};

export async function listWeeklySeriesNeedingMoreForTeacherProfile(
  teacherProfileId: string,
  now: Date = new Date(),
): Promise<WeeklySeriesNeedingMore[]> {
  const seriesList = await prisma.recurringClassSeries.findMany({
    where: { teacherProfileId, dayOfWeek: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      classSessions: {
        where: { status: { not: "cancelled" }, startAt: { gt: now } },
        orderBy: { startAt: "asc" },
        select: { startAt: true },
      },
    },
  });

  return seriesList
    .filter((series) => series.classSessions.length < SERIES_REMAINING_REMINDER_THRESHOLD)
    .map((series) => ({
      id: series.id,
      title: series.title,
      remainingCount: series.classSessions.length,
      lastUpcomingStartAt: series.classSessions.at(-1)?.startAt ?? null,
    }));
}
