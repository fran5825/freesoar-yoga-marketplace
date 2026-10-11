// 我的行事曆（teacher-my-calendar spec 2.1）：月份與台灣日期的純函式。
// 月份一律寫成 "YYYY-MM"、日期寫成 "YYYY-MM-DD"，都是台灣當地日期（D13：固定 UTC+8、無 DST），
// 不經過伺服器時區，避免課程跑到前一天或後一天。

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

export const CALENDAR_WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function splitMonth(month: string): { year: number; month: number } {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, month: monthNumber };
}

// 台灣當地日期，例如 2026-10-11T16:30:00Z（台灣 10/12 00:30）→ "2026-10-12"。
export function taipeiDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function taipeiMonthKey(date: Date): string {
  return taipeiDateKey(date).slice(0, 7);
}

// 只接受 1000–9999 年、01–12 月；其他一律 null，由呼叫端退回本月。
export function parseCalendarMonth(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = MONTH_PATTERN.exec(value);

  if (!match || Number(match[1]) < 1000) {
    return null;
  }

  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? value : null;
}

// 日期必須是真的存在的日子，而且落在指定月份內。
export function parseCalendarDay(value: unknown, month: string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = DAY_PATTERN.exec(value);

  if (!match || `${match[1]}-${match[2]}` !== month) {
    return null;
  }

  const day = Number(match[3]);
  return day >= 1 && day <= daysInMonth(month) ? value : null;
}

export function daysInMonth(month: string): number {
  const { year, month: monthNumber } = splitMonth(month);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function shiftMonth(month: string, delta: number): string {
  const { year, month: monthNumber } = splitMonth(month);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

// 該月份在台灣時間的起訖瞬間：[當月 1 日 00:00, 下個月 1 日 00:00)。
export function taipeiMonthBounds(month: string): { from: Date; to: Date } {
  const toInstant = (key: string) => {
    const { year, month: monthNumber } = splitMonth(key);
    return new Date(Date.UTC(year, monthNumber - 1, 1) - TAIPEI_OFFSET_MS);
  };

  return { from: toInstant(month), to: toInstant(shiftMonth(month, 1)) };
}

// 0（星期日）–6（星期六），對齊 TeacherAvailability.dayOfWeek。
export function weekdayOfDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

export function nextDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

// 月曆格子：從星期日開始，一列七格；月初之前、月底之後用 null 補位。
export function monthGrid(month: string): (string | null)[][] {
  const firstWeekday = weekdayOfDay(`${month}-01`);
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth(month); day += 1) {
    cells.push(`${month}-${pad(day)}`);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}
