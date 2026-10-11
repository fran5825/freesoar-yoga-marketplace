import type { ClassSessionOrigin, ClassSessionStatus } from "@prisma/client";

import { daysInMonth, nextDay, taipeiDateKey } from "./month";

// 我的行事曆（spec 2.2、2.2.2）：把課程與合作邀請整理成「每一天要顯示什麼」。

export type CalendarClassItem = {
  kind: "class";
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: ClassSessionStatus;
  origin: ClassSessionOrigin;
  confirmedCount: number;
  capacity: number;
};

// 只有兩種會上月曆：待老師確認、老師已確認但團主還沒開課（spec 2.2）。
export type CalendarProposalStatus = "pending_confirmation" | "confirmed";

export type CalendarProposalItem = {
  kind: "proposal";
  id: string;
  title: string | null;
  startAt: Date;
  endAt: Date;
  status: CalendarProposalStatus;
  organizationName: string;
};

export type CalendarItem = CalendarClassItem | CalendarProposalItem;

// 一筆項目涵蓋的台灣日期：開始那天到結束那天；剛好在午夜 00:00 結束不算進隔天。
export function coveredTaipeiDays(startAt: Date, endAt: Date): string[] {
  const first = taipeiDateKey(startAt);
  const lastInstant = endAt.getTime() > startAt.getTime() ? new Date(endAt.getTime() - 1) : startAt;
  const last = taipeiDateKey(lastInstant);
  const days = [first];

  // 上限一年，防止資料異常時跑出超長迴圈。
  while (days[days.length - 1] < last && days.length < 366) {
    days.push(nextDay(days[days.length - 1]));
  }

  return days;
}

export function isMultiDay(item: { startAt: Date; endAt: Date }): boolean {
  return coveredTaipeiDays(item.startAt, item.endAt).length > 1;
}

// 同一天依開始時間排序；同時開始的課程排在邀請前面，再依 id 固定順序。
function compareItems(a: CalendarItem, b: CalendarItem): number {
  return (
    a.startAt.getTime() - b.startAt.getTime() ||
    (a.kind === b.kind ? 0 : a.kind === "class" ? -1 : 1) ||
    a.id.localeCompare(b.id)
  );
}

// 只回傳落在該月份內的日期；跨月的課在本月涵蓋的日子出現。
export function groupItemsByDay(items: CalendarItem[], month: string): Map<string, CalendarItem[]> {
  const firstDay = `${month}-01`;
  const lastDay = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const byDay = new Map<string, CalendarItem[]>();

  for (const item of items) {
    for (const day of coveredTaipeiDays(item.startAt, item.endAt)) {
      if (day < firstDay || day > lastDay) {
        continue;
      }

      const list = byDay.get(day) ?? [];
      list.push(item);
      byDay.set(day, list);
    }
  }

  for (const list of byDay.values()) {
    list.sort(compareItems);
  }

  return byDay;
}
