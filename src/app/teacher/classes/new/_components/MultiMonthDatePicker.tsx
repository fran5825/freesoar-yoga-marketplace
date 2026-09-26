"use client";

import { useState } from "react";

// 固定期課程的上課日期：一次顯示三個月的月曆，直接點日期多選（再點一次取消）。
// 日期一律用台灣當地日期字串（YYYY-MM-DD）處理，不經過時區換算，避免選到的日子跑掉一天。
// 今天與過去的日子不能選；最多可選 maxCount 天。

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS_SHOWN = 3;

type YearMonth = { year: number; month: number }; // month：1–12

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function MultiMonthDatePicker({
  selected,
  onToggle,
  maxCount,
}: {
  selected: string[];
  onToggle: (date: string) => void;
  maxCount: number;
}) {
  const today = taipeiToday();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const firstAllowedMonth: YearMonth = { year: todayYear, month: todayMonth };
  const [startMonth, setStartMonth] = useState<YearMonth>(firstAllowedMonth);
  const isAtFirstMonth =
    startMonth.year === firstAllowedMonth.year && startMonth.month === firstAllowedMonth.month;
  const isFull = selected.length >= maxCount;
  const months = Array.from({ length: MONTHS_SHOWN }, (_, index) => addMonths(startMonth, index));
  const lastMonth = months[months.length - 1];

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="往前一個月"
          className="rounded-full border border-ink/20 px-3 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:text-ink-faint"
          disabled={isAtFirstMonth}
          onClick={() => setStartMonth(addMonths(startMonth, -1))}
          type="button"
        >
          ←
        </button>
        <p className="text-sm text-ink-soft">
          {startMonth.year} 年 {startMonth.month} 月 – {lastMonth.year} 年 {lastMonth.month} 月
        </p>
        <button
          aria-label="往後一個月"
          className="rounded-full border border-ink/20 px-3 py-1.5 text-sm text-ink"
          onClick={() => setStartMonth(addMonths(startMonth, 1))}
          type="button"
        >
          →
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {months.map(({ year, month }) => {
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

          return (
            <div
              aria-label={`${year} 年 ${month} 月`}
              className="min-w-0 rounded-2xl border border-ink/10 bg-cream/60 p-3"
              key={`${year}-${month}`}
              role="group"
            >
              <p className="mb-2 text-center text-sm font-medium text-ink">
                {year} 年 {month} 月
              </p>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-faint">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }, (_, index) => (
                  <span aria-hidden="true" key={`blank-${index}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const date = toDateString(year, month, day);
                  const isSelected = selected.includes(date);
                  const isPast = date <= today;
                  const isDisabled = isPast || (isFull && !isSelected);

                  return (
                    <button
                      aria-label={`${year} 年 ${month} 月 ${day} 日`}
                      aria-pressed={isSelected}
                      className={`aspect-square rounded-full text-sm transition ${
                        isSelected
                          ? "bg-pine font-medium text-white"
                          : isDisabled
                            ? "cursor-not-allowed text-ink-faint/60"
                            : "text-ink hover:bg-pine-tint"
                      }`}
                      data-date={date}
                      disabled={isDisabled}
                      key={date}
                      onClick={() => onToggle(date)}
                      type="button"
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
