import { expect, test } from "@playwright/test";

import { buildTeacherCalendarView, calendarTimeLabel, toCalendarEntry } from "../../src/app/teacher/classes/_lib/calendar-view";
import { parseTeacherCalendarParams, teacherCalendarHref } from "../../src/app/teacher/classes/_lib/calendar-params";
import {
  parseReturnContext,
  readReturnContextFromForm,
  returnContextParams,
  teacherClassBackLink,
  teacherClassDetailHref,
} from "../../src/app/teacher/classes/_lib/return-context";
import { availabilityForDay, availabilityByDay } from "../../src/domain/teacher-calendar/availability";
import { coveredTaipeiDays, groupItemsByDay, type CalendarItem } from "../../src/domain/teacher-calendar/day-items";
import {
  monthGrid,
  parseCalendarDay,
  parseCalendarMonth,
  shiftMonth,
  taipeiDateKey,
  taipeiMonthBounds,
} from "../../src/domain/teacher-calendar/month";

// 我的行事曆（teacher-my-calendar spec 5）：純函式的單元測試，不需要瀏覽器或資料庫。

const at = (value: string) => new Date(`${value}+08:00`);
const utcDate = (value: string) => new Date(`${value}T00:00:00Z`);

function classItem(id: string, start: string, end: string, extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    kind: "class",
    id,
    title: `課 ${id}`,
    startAt: at(start),
    endAt: at(end),
    status: "open_for_enrollment",
    origin: "teacher_initiated",
    confirmedCount: 6,
    capacity: 10,
    ...extra,
  } as CalendarItem;
}

test("month grid starts on Sunday and pads with blanks", () => {
  // 2026-10-01 是星期四
  const weeks = monthGrid("2026-10");
  expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
  expect(weeks.every((week) => week.length === 7)).toBe(true);
  expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  expect(weeks[weeks.length - 1]).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  // 2026-02-01 是星期日、28 天，剛好四列
  expect(monthGrid("2026-02")).toHaveLength(4);
});

test("Taipei date keys and month bounds do not drift across UTC midnight", () => {
  expect(taipeiDateKey(new Date("2026-10-11T16:30:00Z"))).toBe("2026-10-12");
  expect(taipeiDateKey(new Date("2026-10-11T15:59:00Z"))).toBe("2026-10-11");
  expect(taipeiMonthBounds("2026-10")).toEqual({ from: at("2026-10-01T00:00"), to: at("2026-11-01T00:00") });
  expect(taipeiMonthBounds("2026-12").to).toEqual(at("2027-01-01T00:00"));
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
});

test("month and day params are whitelisted", () => {
  for (const bad of [undefined, "", "2026-13", "2026-00", "2026-1", "0999-10", "2026-10-01", "//evil", 202610]) {
    expect(parseCalendarMonth(bad)).toBeNull();
  }
  expect(parseCalendarMonth("2026-10")).toBe("2026-10");
  expect(parseCalendarDay("2026-10-31", "2026-10")).toBe("2026-10-31");
  expect(parseCalendarDay("2026-11-01", "2026-10")).toBeNull();
  expect(parseCalendarDay("2026-02-29", "2026-02")).toBeNull();
  expect(parseCalendarDay("2028-02-29", "2028-02")).toBe("2028-02-29");
  expect(parseCalendarDay("2026-10-1", "2026-10")).toBeNull();
  expect(parseTeacherCalendarParams({ month: "nope", day: "2026-10-05" }, "2026-10")).toEqual({ month: "2026-10", day: "2026-10-05" });
  expect(parseTeacherCalendarParams({ month: "2026-11", day: "2026-10-05" }, "2026-10")).toEqual({ month: "2026-11", day: null });
  expect(teacherCalendarHref("2026-10", "2026-10-05")).toBe("/teacher/classes?view=calendar&month=2026-10&day=2026-10-05");
});

test("cross-day items cover every Taipei day; ending at midnight does not spill over", () => {
  expect(coveredTaipeiDays(at("2026-10-12T19:00"), at("2026-10-12T20:30"))).toEqual(["2026-10-12"]);
  expect(coveredTaipeiDays(at("2026-10-12T22:00"), at("2026-10-13T00:00"))).toEqual(["2026-10-12"]);
  expect(coveredTaipeiDays(at("2026-10-12T20:00"), at("2026-10-13T01:00"))).toEqual(["2026-10-12", "2026-10-13"]);

  const byDay = groupItemsByDay(
    [
      classItem("spill", "2026-09-30T22:00", "2026-10-01T02:00"),
      classItem("b", "2026-10-05T19:00", "2026-10-05T20:00"),
      classItem("a", "2026-10-05T09:00", "2026-10-05T10:00"),
      { kind: "proposal", id: "p", title: null, startAt: at("2026-10-05T09:00"), endAt: at("2026-10-05T10:00"), status: "pending_confirmation", organizationName: "晨光社" },
    ],
    "2026-10",
  );
  // 上個月開始、跨進本月的課出現在本月 1 日；9/30 不在本月格子裡
  expect(byDay.get("2026-10-01")?.map((item) => item.id)).toEqual(["spill"]);
  expect(byDay.has("2026-09-30")).toBe(false);
  // 同一天依開始時間排序，同時開始時課程在邀請前面
  expect(byDay.get("2026-10-05")?.map((item) => item.id)).toEqual(["a", "p", "b"]);
});

test("availability: weekly slots plus extra, minus blocked; blocked wins; empty times mean whole day", () => {
  // 2026-10-12 是星期一
  const weekly = [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: 1, startTime: "11:00", endTime: "13:00" },
    { dayOfWeek: 3, startTime: "18:00", endTime: "21:00" },
  ];
  expect(availabilityForDay("2026-10-12", weekly, [])).toEqual([{ startTime: "09:00", endTime: "13:00" }]);
  expect(availabilityForDay("2026-10-13", weekly, [])).toEqual([]);

  const blockedMiddle = [{ date: utcDate("2026-10-12"), startTime: "10:00", endTime: "11:00", type: "blocked" as const }];
  expect(availabilityForDay("2026-10-12", weekly, blockedMiddle)).toEqual([
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "11:00", endTime: "13:00" },
  ]);

  // 同一時段同時有加開與封鎖：封鎖優先
  const overlapping = [
    { date: utcDate("2026-10-13"), startTime: "14:00", endTime: "17:00", type: "extra_available" as const },
    { date: utcDate("2026-10-13"), startTime: "15:00", endTime: "16:00", type: "blocked" as const },
  ];
  expect(availabilityForDay("2026-10-13", weekly, overlapping)).toEqual([
    { startTime: "14:00", endTime: "15:00" },
    { startTime: "16:00", endTime: "17:00" },
  ]);

  // 整天封鎖：當天完全沒有可授課時間，即使有加開
  const wholeDayBlocked = [
    { date: utcDate("2026-10-12"), startTime: null, endTime: null, type: "blocked" as const },
    { date: utcDate("2026-10-12"), startTime: "18:00", endTime: "20:00", type: "extra_available" as const },
  ];
  expect(availabilityForDay("2026-10-12", weekly, wholeDayBlocked)).toEqual([]);

  // 整天加開＝00:00–23:59，仍會被封鎖扣掉
  const wholeDayExtra = [
    { date: utcDate("2026-10-17"), startTime: null, endTime: null, type: "extra_available" as const },
    { date: utcDate("2026-10-17"), startTime: "12:00", endTime: "13:00", type: "blocked" as const },
  ];
  expect(availabilityForDay("2026-10-17", weekly, wholeDayExtra)).toEqual([
    { startTime: "00:00", endTime: "12:00" },
    { startTime: "13:00", endTime: "23:59" },
  ]);

  // 例外只影響自己那一天
  const month = availabilityByDay("2026-10", weekly, blockedMiddle);
  expect(month.get("2026-10-19")).toEqual([{ startTime: "09:00", endTime: "13:00" }]);
  expect(month.has("2026-10-13")).toBe(false);
});

test("calendar entries: tones, badges, counts, cross-day labels and return links", () => {
  expect(toCalendarEntry(classItem("x", "2026-10-05T19:00", "2026-10-05T20:30"))).toMatchObject({
    tone: "active",
    countLabel: "6/10",
    timeLabel: "19:00–20:30",
    href: "/teacher/classes/x",
  });
  expect(toCalendarEntry(classItem("x", "2026-10-05T19:00", "2026-10-05T20:30", { status: "cancelled" })).tone).toBe("cancelled");
  expect(toCalendarEntry(classItem("x", "2026-10-05T19:00", "2026-10-05T20:30", { status: "draft" })).tone).toBe("draft");
  expect(calendarTimeLabel({ startAt: at("2026-10-12T20:00"), endAt: at("2026-10-13T01:00") })).toBe("10/12 20:00–10/13 01:00");

  const pending = toCalendarEntry({ kind: "proposal", id: "p1", title: null, startAt: at("2026-10-05T09:00"), endAt: at("2026-10-05T10:00"), status: "pending_confirmation", organizationName: "晨光社" });
  expect(pending).toMatchObject({ tone: "proposal", badge: "待你確認", title: "晨光社的合作邀請", countLabel: null, href: "/teacher/class-proposals/p1" });
  const confirmed = toCalendarEntry({ kind: "proposal", id: "p2", title: "週末流動", startAt: at("2026-10-05T09:00"), endAt: at("2026-10-05T10:00"), status: "confirmed", organizationName: "晨光社" });
  expect(confirmed.badge).toBe("已確認，等團主開課");
});

test("calendar view selects today in the current month, otherwise the first day", () => {
  const data = { month: "2026-10", itemsByDay: new Map(), availabilityByDay: new Map() };
  const now = new Date("2026-10-11T17:00:00Z"); // 台灣 10/12 01:00
  expect(buildTeacherCalendarView(data, { now, selectedDay: null })).toMatchObject({ today: "2026-10-12", initialDay: "2026-10-12", isCurrentMonth: true, prevMonth: "2026-09", nextMonth: "2026-11", monthLabel: "2026 年 10 月" });
  expect(buildTeacherCalendarView({ ...data, month: "2026-11" }, { now, selectedDay: null })).toMatchObject({ initialDay: "2026-11-01", isCurrentMonth: false });
  expect(buildTeacherCalendarView(data, { now, selectedDay: "2026-10-20" }).initialDay).toBe("2026-10-20");
});

test("calendar return context is whitelisted and round-trips through links and forms", () => {
  const context = parseReturnContext({ from: "calendar", month: "2026-10", day: "2026-10-12" }, null);
  expect(context).toEqual({ kind: "calendar", month: "2026-10", day: "2026-10-12" });
  expect(teacherClassDetailHref("c1", context)).toBe("/teacher/classes/c1?from=calendar&month=2026-10&day=2026-10-12");
  expect(teacherClassBackLink(context, "c1")).toEqual({ href: "/teacher/classes?view=calendar&month=2026-10&day=2026-10-12", label: "← 回我的課程" });

  // 日期不在該月就忽略日期；月份壞掉就整個不收，回到預設清單
  expect(parseReturnContext({ from: "calendar", month: "2026-10", day: "2026-11-01" }, null)).toEqual({ kind: "calendar", month: "2026-10", day: null });
  for (const month of ["2026-13", "//evil.example", "https://evil.example", undefined]) {
    expect(parseReturnContext({ from: "calendar", month }, null)).toBeNull();
  }
  expect(teacherClassBackLink(parseReturnContext({ from: "calendar", month: "nope" }, null), "c1").href).toBe("/teacher/classes#class-c1");

  // 操作表單（server action）用同一套解析
  const form = new FormData();
  for (const [name, value] of returnContextParams(context)) form.set(name, value);
  expect(readReturnContextFromForm(form)).toEqual(context);
  const listForm = new FormData();
  listForm.set("from", "list");
  listForm.set("tab", "past");
  expect(readReturnContextFromForm(listForm)).toEqual({ kind: "list", tab: "past", status: null });
  // 表單的系列只檢查格式（所屬系列由詳情頁再比對）；頁面網址則必須是自己的系列
  const seriesForm = new FormData();
  seriesForm.set("from", "series");
  seriesForm.set("series", "s1");
  expect(readReturnContextFromForm(seriesForm)).toEqual({ kind: "series", seriesId: "s1" });
  expect(parseReturnContext({ from: "series", series: "s1" }, "s2")).toBeNull();
});
