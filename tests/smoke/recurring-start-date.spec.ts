import { expect, test } from "@playwright/test";

import {
  computeNextWeeklyOccurrenceDates,
  weeklyAfterDateForStartDate,
} from "../../src/domain/class-session/recurring-series-dates";
import { validateRecurringSeriesInput } from "../../src/domain/class-session/recurring-series-validation";
import { futureDateString, futureWeekdayDateString } from "./_helpers/future-dates";

// 常規課程的選填「起始日期」（2026-09-26）：第一場是該日（含）起第一個符合星期幾的日子。

test.describe("weekly series start date (pure functions)", () => {
  test("starts on the start date itself when it already falls on the chosen weekday", () => {
    // 2027-01-04 是週一。
    const dates = computeNextWeeklyOccurrenceDates(1, 3, weeklyAfterDateForStartDate("2027-01-04"));
    expect(dates).toEqual(["2027-01-04", "2027-01-11", "2027-01-18"]);
  });

  test("rolls forward to the next matching weekday when the start date is not that weekday", () => {
    // 2027-01-05 是週二，選週一 → 下週一 2027-01-11。
    const dates = computeNextWeeklyOccurrenceDates(1, 2, weeklyAfterDateForStartDate("2027-01-05"));
    expect(dates).toEqual(["2027-01-11", "2027-01-18"]);
    // 2027-01-03 是週日，選週一 → 隔天 2027-01-04。
    const sunday = computeNextWeeklyOccurrenceDates(1, 1, weeklyAfterDateForStartDate("2027-01-03"));
    expect(sunday).toEqual(["2027-01-04"]);
  });

  const baseInput = {
    title: "起始日期測試",
    serviceTypes: ["放鬆紓壓"],
    yogaStyles: ["陰瑜珈"],
    startTime: "10:00",
    endTime: "11:00",
    location: "台北市測試教室",
    capacity: 10,
    mode: "weekly",
    dayOfWeek: 1,
    generateCount: 3,
  };

  test("validation: start date is optional, must be a real date, and must be after today", () => {
    const withoutStart = validateRecurringSeriesInput(baseInput);
    expect(withoutStart.valid).toBe(true);
    if (withoutStart.valid && withoutStart.schedule.mode === "weekly") {
      expect(withoutStart.schedule.startDate).toBeNull();
    }

    const future = futureWeekdayDateString(30, 1); // baseInput 選的是週一
    const withStart = validateRecurringSeriesInput({ ...baseInput, startDate: future });
    expect(withStart.valid).toBe(true);
    if (withStart.valid && withStart.schedule.mode === "weekly") {
      expect(withStart.schedule.startDate).toBe(future);
    }

    const codesFor = (startDate: string) => {
      const result = validateRecurringSeriesInput({ ...baseInput, startDate });
      return result.valid ? [] : result.errors.map((error) => error.code);
    };

    expect(codesFor(futureDateString(0))).toContain("start_date_not_future"); // 今天不行
    expect(codesFor("2020-01-01")).toContain("start_date_not_future");
    expect(codesFor("2027-02-31")).toContain("start_date_invalid"); // 不存在的日期
    expect(codesFor("明天")).toContain("start_date_invalid");
    // 起始日期不是選定的星期幾（週一）。
    expect(codesFor(futureWeekdayDateString(30, 4))).toContain("start_date_weekday_mismatch");
  });
});
