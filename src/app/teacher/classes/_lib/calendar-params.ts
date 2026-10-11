import { parseCalendarDay, parseCalendarMonth } from "@/domain/teacher-calendar/month";

// 我的行事曆的網址參數（spec 2.1、2.4）：view=calendar、month=YYYY-MM、day=YYYY-MM-DD。
// 一律白名單檢查：月份格式不對就回到本月，日期不在該月就忽略，不收任意字串。

export type TeacherCalendarParams = { month: string; day: string | null };

export function isCalendarView(value: unknown): boolean {
  return value === "calendar";
}

export function parseTeacherCalendarParams(
  params: { month?: unknown; day?: unknown },
  currentMonth: string,
): TeacherCalendarParams {
  const month = parseCalendarMonth(params.month) ?? currentMonth;
  return { month, day: parseCalendarDay(params.day, month) };
}

export function teacherCalendarHref(month: string, day: string | null = null): string {
  const query = new URLSearchParams({ view: "calendar", month });

  if (day) {
    query.set("day", day);
  }

  return `/teacher/classes?${query.toString()}`;
}
