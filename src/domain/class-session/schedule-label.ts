// 找課程卡片與系列頁共用的「規律」文字，例如「每週四 19:00–20:00」。期班用系列自己的欄位，
// 持續開課用「下一堂」那一場實際的日期與時間（系列預設值可能被「改這場以後」改得和近期場次不同）。
import { taipeiDayOfWeek } from "./recurring-series-dates";
import { formatTaipeiDatetimeLocal } from "./timezone";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export function weeklyScheduleLabel(dayOfWeek: number | null, startTime: string, endTime: string): string {
  return `${dayOfWeek === null ? "指定日期" : `每${dayOfWeekLabels[dayOfWeek]}`} ${startTime}–${endTime}`;
}

// 台北時間的「HH:mm–HH:mm」。
export function taipeiTimeRange(startAt: Date, endAt: Date): string {
  return `${formatTaipeiDatetimeLocal(startAt).slice(11, 16)}–${formatTaipeiDatetimeLocal(endAt).slice(11, 16)}`;
}

export function sessionScheduleLabel(startAt: Date, endAt: Date): string {
  const [start, end] = taipeiTimeRange(startAt, endAt).split("–");
  return weeklyScheduleLabel(taipeiDayOfWeek(startAt), start, end);
}
