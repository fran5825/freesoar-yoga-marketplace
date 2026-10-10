import { expect, test } from "@playwright/test";
import { classDiscoveryDateBounds, matchesClassDiscoveryTime, parseClassDiscoveryFilters, taipeiDateStart } from "../../src/domain/class-session/class-discovery-filters";
import { classDetailHref, classReturnLabel, safeClassReturnPath, safeParentReturnPath, seriesDetailHref, termDetailHref } from "../../src/lib/navigation/class-return-path";

const now = new Date("2026-10-03T23:30:00+08:00");
const filters = (params: Parameters<typeof parseClassDiscoveryFilters>[0]) => parseClassDiscoveryFilters(params).filters;

test("Taipei calendar windows include the last day, exclude the next midnight and already-started courses", () => {
  const week = filters({ dateRange: "week" });
  expect(classDiscoveryDateBounds(week, now)).toEqual({ from: new Date("2026-10-03T00:00+08:00"), to: new Date("2026-10-10T00:00+08:00") });
  expect(matchesClassDiscoveryTime(new Date("2026-10-09T23:59+08:00"), week, now)).toBe(true);
  expect(matchesClassDiscoveryTime(new Date("2026-10-10T00:00+08:00"), week, now)).toBe(false);
  expect(matchesClassDiscoveryTime(now, week, now)).toBe(false);
  const today = filters({ dateRange: "today" });
  expect(matchesClassDiscoveryTime(new Date("2026-10-03T23:59+08:00"), today, now)).toBe(true);
  expect(matchesClassDiscoveryTime(new Date("2026-10-04T00:00+08:00"), today, now)).toBe(false);
  expect(classDiscoveryDateBounds(filters({ dateRange: "month" }), now).to).toEqual(new Date("2026-11-02T00:00+08:00"));
  const custom = filters({ dateRange: "custom", dateFrom: "2026-10-04", dateTo: "2026-10-05" });
  expect(matchesClassDiscoveryTime(new Date("2026-10-04T00:00+08:00"), custom, now)).toBe(true);
  expect(matchesClassDiscoveryTime(new Date("2026-10-05T23:59+08:00"), custom, now)).toBe(true);
  expect(matchesClassDiscoveryTime(new Date("2026-10-06T00:00+08:00"), custom, now)).toBe(false);
});

test("time ranges classify by Taipei start time at noon and 18:00", () => {
  for (const [time, expected] of [["00:00", "morning"], ["11:59", "morning"], ["12:00", "afternoon"], ["17:59", "afternoon"], ["18:00", "evening"], ["23:59", "evening"]]) {
    for (const period of ["morning", "afternoon", "evening"]) expect(matchesClassDiscoveryTime(new Date(`2026-10-04T${time}+08:00`), filters({ timeOfDay: period }), now)).toBe(period === expected);
  }
});

test("invalid dates and reversed ranges have explicit errors; location is trimmed", () => {
  expect(taipeiDateStart("2026-02-30")).toBeNull();
  expect(taipeiDateStart("2028-02-29")).not.toBeNull();
  expect(parseClassDiscoveryFilters({ dateRange: "custom", dateFrom: "2026-10-05", dateTo: "2026-10-04" }).errors).toContain("結束日期不能早於開始日期。");
  expect(parseClassDiscoveryFilters({ dateRange: "custom", dateFrom: "2026-02-30" }).errors.length).toBeGreaterThan(0);
  expect(parseClassDiscoveryFilters({ timeOfDay: "invalid", dayOfWeek: "7" }).errors).toHaveLength(2);
  expect(filters({ location: "  信義區  " }).location).toBe("信義區");
});

test("return paths are restricted to known class-list filters and cannot redirect externally", () => {
  for (const path of [undefined, "//evil.example", "https://evil.example", "/classes/id", "/member/enrollments?x=1", "/member/enrollments#a", "/member/admin", "/classes/terms/a/b", "/classes#enroll", "/classes%5c@evil.example", "/classes?dateRange=custom&dateFrom=invalid", "/classes/../admin", "/\\evil.example"]) expect(safeClassReturnPath(path)).toBe("/classes");
  const href = safeClassReturnPath("/classes?location=%20%E4%BF%A1%E7%BE%A9%E5%8D%80%20&includeFull=1&unknown=secret");
  expect(href).toBe("/classes?location=%E4%BF%A1%E7%BE%A9%E5%8D%80&includeFull=1");
  expect(classDetailHref("abc123", href)).toBe(`/classes/abc123?returnTo=${encodeURIComponent(href)}`);
  expect(classDetailHref("abc123", "https://evil.example")).toBe("/classes/abc123");
});

test("return paths allow member pages and one level of term/series parents, and label matches destination", () => {
  expect(safeClassReturnPath("/member/enrollments")).toBe("/member/enrollments");
  expect(safeClassReturnPath("/member/dashboard")).toBe("/member/dashboard");
  expect(classReturnLabel("/member/enrollments")).toBe("返回我的報名");
  expect(classReturnLabel("/member/dashboard")).toBe("返回首頁");
  expect(classReturnLabel(undefined as unknown as string)).toBe("返回課程列表");
  const term = termDetailHref("t1", "/member/enrollments");
  expect(term).toBe(`/classes/terms/t1?returnTo=${encodeURIComponent("/member/enrollments")}`);
  expect(safeClassReturnPath(term)).toBe(term);
  expect(classReturnLabel(term)).toBe("返回期班");
  expect(classReturnLabel(seriesDetailHref("s1", "/classes"))).toBe("返回持續開課");
  expect(classDetailHref("c1", term)).toBe(`/classes/c1?returnTo=${encodeURIComponent(term)}`);
  expect(termDetailHref("t1", "/classes")).toBe("/classes/terms/t1");
  // 期班頁自己的來源不能再巢狀、不能是另一個期班頁
  expect(safeParentReturnPath(term)).toBe("/classes");
  expect(safeClassReturnPath(`/classes/terms/t1?returnTo=${encodeURIComponent(term)}`)).toBe("/classes");
  expect(safeClassReturnPath("/classes/terms/t1?returnTo=https%3A%2F%2Fevil.example")).toBe("/classes");
  expect(safeClassReturnPath("/classes/terms/t1?x=1")).toBe("/classes");
  expect(safeClassReturnPath(`/classes/terms/${"a".repeat(65)}`)).toBe("/classes");
  expect(safeClassReturnPath(`/classes?q=${"a".repeat(700)}`)).toBe("/classes");
});
