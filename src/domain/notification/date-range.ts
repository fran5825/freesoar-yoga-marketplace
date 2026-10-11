import { formatTaipeiDatetimeLocal } from "@/domain/class-session/timezone";

// teacher-series-rollup 票 07：批次通知內文的日期範圍，例如「10/15–12/03」（台北時間）。同一天只寫一個日期。
export function formatDateRange(first: Date, last: Date): string {
  const toMonthDay = (date: Date) => formatTaipeiDatetimeLocal(date).slice(5, 10).replace("-", "/");
  const start = toMonthDay(first);
  const end = toMonthDay(last);

  return start === end ? start : `${start}–${end}`;
}
