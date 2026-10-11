// teacher-series-rollup spec 2.3（學員端併入 inline-member-enroll 票 08）：單堂頁標題旁的系列標籤，
// 期班「期班・第 3 堂／共 8 堂」、持續開課「持續開課・每週四」（指定日期的持續開課只寫「持續開課」）。
// 「第幾堂／共幾堂」以未取消的場次依上課時間排序計算；這一堂本身已取消時不寫第幾堂。
// 老師、管理員、學員單堂頁共用；只回傳標籤需要的欄位，各頁自己決定連到哪個系列頁。
import type { RecurringClassSeriesKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export type SeriesBadgeInfo = {
  seriesId: string;
  kind: RecurringClassSeriesKind;
  // 這一堂在未取消場次中的順序（1 起算）；這一堂已取消時為 null。
  position: number | null;
  total: number;
  dayOfWeek: number | null;
};

export function seriesBadgeLabel(info: SeriesBadgeInfo): string {
  if (info.kind === "term") {
    return info.position === null ? `期班・共 ${info.total} 堂` : `期班・第 ${info.position} 堂／共 ${info.total} 堂`;
  }

  return info.dayOfWeek === null ? "持續開課" : `持續開課・每${weekdayLabels[info.dayOfWeek]}`;
}

export async function getSeriesBadgeInfo(classSessionId: string): Promise<SeriesBadgeInfo | null> {
  const session = await prisma.classSession.findUnique({
    where: { id: classSessionId },
    select: {
      startAt: true,
      status: true,
      recurringClassSeries: {
        select: {
          id: true,
          kind: true,
          dayOfWeek: true,
          classSessions: { where: { status: { not: "cancelled" } }, select: { id: true, startAt: true } },
        },
      },
    },
  });
  const series = session?.recurringClassSeries;

  if (!session || !series) {
    return null;
  }

  const ordered = [...series.classSessions].sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.id.localeCompare(b.id));
  const index = ordered.findIndex((item) => item.id === classSessionId);

  return {
    seriesId: series.id,
    kind: series.kind,
    position: index === -1 ? null : index + 1,
    total: ordered.length,
    dayOfWeek: series.dayOfWeek,
  };
}
