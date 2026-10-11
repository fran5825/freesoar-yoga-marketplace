import type { AvailabilityExceptionType } from "@prisma/client";

import { formatAvailabilityExceptionDate } from "@/domain/teacher-availability/date-format";

import { daysInMonth, weekdayOfDay } from "./month";

// 我的行事曆（spec 2.2.1）：老師「自己設定的」可授課時間，不扣掉已排的課。
// 規則沿用 teacher-availability：
// D3 同一時段 blocked 優先於 extra_available；D4 開始、結束都空白代表整天。

export type CalendarWeeklySlot = { dayOfWeek: number; startTime: string; endTime: string };

export type CalendarAvailabilityException = {
  date: Date; // @db.Date，用 UTC 年月日表示那一天
  startTime: string | null;
  endTime: string | null;
  type: AvailabilityExceptionType;
};

export type CalendarSlot = { startTime: string; endTime: string };

type Range = [number, number]; // 分鐘，[開始, 結束)

// 整天加開：spec 寫 00:00–23:59，與既有時段欄位的上限一致。整天封鎖則蓋住整天。
const WHOLE_DAY_AVAILABLE: Range = [0, 23 * 60 + 59];
const WHOLE_DAY_BLOCKED: Range = [0, 24 * 60];

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];

    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

function subtractRanges(ranges: Range[], blocked: Range[]): Range[] {
  let remaining = ranges;

  for (const [blockStart, blockEnd] of blocked) {
    remaining = remaining.flatMap(([start, end]): Range[] => {
      if (blockEnd <= start || blockStart >= end) {
        return [[start, end]];
      }

      return [
        [start, Math.min(blockStart, end)],
        [Math.max(blockEnd, start), end],
      ].filter(([s, e]) => e > s) as Range[];
    });
  }

  return remaining;
}

function exceptionRange(exception: CalendarAvailabilityException): Range {
  if (exception.startTime && exception.endTime) {
    return [toMinutes(exception.startTime), toMinutes(exception.endTime)];
  }

  return exception.type === "blocked" ? WHOLE_DAY_BLOCKED : WHOLE_DAY_AVAILABLE;
}

export function availabilityForDay(
  day: string,
  weekly: CalendarWeeklySlot[],
  exceptions: CalendarAvailabilityException[],
): CalendarSlot[] {
  const weekday = weekdayOfDay(day);
  const todays = exceptions.filter((exception) => formatAvailabilityExceptionDate(exception.date) === day);
  const available = mergeRanges([
    ...weekly
      .filter((slot) => slot.dayOfWeek === weekday)
      .map((slot): Range => [toMinutes(slot.startTime), toMinutes(slot.endTime)]),
    ...todays.filter((exception) => exception.type === "extra_available").map(exceptionRange),
  ]);
  const blocked = todays.filter((exception) => exception.type === "blocked").map(exceptionRange);

  return mergeRanges(subtractRanges(available, blocked)).map(([start, end]) => ({
    startTime: toTime(start),
    endTime: toTime(end),
  }));
}

// 只列出有可授課時間的日子。
export function availabilityByDay(
  month: string,
  weekly: CalendarWeeklySlot[],
  exceptions: CalendarAvailabilityException[],
): Map<string, CalendarSlot[]> {
  const result = new Map<string, CalendarSlot[]>();

  for (let date = 1; date <= daysInMonth(month); date += 1) {
    const day = `${month}-${String(date).padStart(2, "0")}`;
    const slots = availabilityForDay(day, weekly, exceptions);

    if (slots.length > 0) {
      result.set(day, slots);
    }
  }

  return result;
}
