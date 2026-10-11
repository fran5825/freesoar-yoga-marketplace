import { classSessionStatusLabels } from "@/app/organizer/classes/_components/status-labels";
import { isMultiDay, type CalendarItem } from "@/domain/teacher-calendar/day-items";
import { monthGrid, shiftMonth, taipeiDateKey } from "@/domain/teacher-calendar/month";
import type { OwnTeacherCalendarMonth } from "@/domain/teacher-calendar/read-service";

// 我的行事曆的畫面資料（spec 2.2、2.3）：把 domain 整理好的每日項目轉成可以交給
// client component 的純資料（不含 Date、不含函式）。

export type CalendarEntryTone = "active" | "draft" | "cancelled" | "proposal";

export type CalendarEntry = {
  key: string;
  kind: "class" | "proposal";
  tone: CalendarEntryTone;
  title: string;
  timeLabel: string;
  countLabel: string | null;
  badge: string;
  href: string;
};

export type CalendarDay = {
  day: string;
  entries: CalendarEntry[];
  slots: { startTime: string; endTime: string }[];
};

export type TeacherCalendarView = {
  month: string;
  monthLabel: string;
  weeks: (string | null)[][];
  days: Record<string, CalendarDay>;
  today: string;
  initialDay: string;
  prevMonth: string;
  nextMonth: string;
  isCurrentMonth: boolean;
};

const proposalBadges = {
  pending_confirmation: "待你確認",
  confirmed: "已確認，等團主開課",
} as const;

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatShortDateTime(date: Date): string {
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

// 一般課程「19:00–20:30」；跨日的課寫出日期「10/12 20:00–10/13 01:00」（spec 2.2.2）。
export function calendarTimeLabel(item: { startAt: Date; endAt: Date }): string {
  if (isMultiDay(item)) {
    return `${formatShortDateTime(item.startAt)}–${formatShortDateTime(item.endAt)}`;
  }

  return `${timeFormatter.format(item.startAt)}–${timeFormatter.format(item.endAt)}`;
}

export function toCalendarEntry(item: CalendarItem): CalendarEntry {
  if (item.kind === "proposal") {
    return {
      key: `proposal-${item.id}`,
      kind: "proposal",
      tone: "proposal",
      title: item.title ?? `${item.organizationName}的合作邀請`,
      timeLabel: calendarTimeLabel(item),
      countLabel: null,
      badge: proposalBadges[item.status],
      href: `/teacher/class-proposals/${encodeURIComponent(item.id)}`,
    };
  }

  return {
    key: `class-${item.id}`,
    kind: "class",
    tone: item.status === "cancelled" ? "cancelled" : item.status === "draft" ? "draft" : "active",
    title: item.title,
    timeLabel: calendarTimeLabel(item),
    countLabel: `${item.confirmedCount}/${item.capacity}`,
    badge: classSessionStatusLabels[item.status],
    href: `/teacher/classes/${encodeURIComponent(item.id)}`,
  };
}

export function buildTeacherCalendarView(
  data: OwnTeacherCalendarMonth,
  options: { now: Date; selectedDay: string | null },
): TeacherCalendarView {
  const { month } = data;
  const today = taipeiDateKey(options.now);
  const isCurrentMonth = today.startsWith(month);
  const weeks = monthGrid(month);
  const days: Record<string, CalendarDay> = {};

  for (const week of weeks) {
    for (const day of week) {
      if (!day) {
        continue;
      }

      days[day] = {
        day,
        entries: (data.itemsByDay.get(day) ?? []).map(toCalendarEntry),
        slots: data.availabilityByDay.get(day) ?? [],
      };
    }
  }

  const [year, monthNumber] = month.split("-").map(Number);

  return {
    month,
    monthLabel: `${year} 年 ${monthNumber} 月`,
    weeks,
    days,
    today,
    // 預設選今天；今天不在這個月就選當月第一天（spec 2.3）。
    initialDay: options.selectedDay ?? (isCurrentMonth ? today : `${month}-01`),
    prevMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1),
    isCurrentMonth,
  };
}
