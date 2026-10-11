"use client";

import Link from "next/link";
import { useState } from "react";

import { CALENDAR_WEEKDAY_LABELS } from "@/domain/teacher-calendar/month";

import type { CalendarEntry, CalendarEntryTone, TeacherCalendarView } from "../_lib/calendar-view";
import { teacherCalendarHref } from "../_lib/calendar-params";

// 我的行事曆（spec 2.3）：
// - 電腦版（md 以上）格子內直接列課名＋人數，超過 MAX_ENTRIES_IN_CELL 筆顯示「還有 N 筆」。
// - 手機版格子只放狀態色點；點某一天，在月曆下方列出當日明細。
// - 有可授課時間的日子格子用淡色底；時段只在當日明細列出。
// 選到的日子寫回網址（replaceState），重新整理或從單堂頁返回時停在同一天。

const MAX_ENTRIES_IN_CELL = 3;

const dotClasses: Record<CalendarEntryTone, string> = {
  active: "bg-pine",
  draft: "border border-dashed border-ink-faint bg-white",
  cancelled: "bg-ink/25",
  proposal: "bg-clay",
};

const cellEntryClasses: Record<CalendarEntryTone, string> = {
  active: "bg-white text-ink border border-pine/30",
  draft: "border border-dashed border-ink/30 bg-white/70 text-ink-faint",
  cancelled: "bg-white/60 text-ink-faint line-through",
  proposal: "bg-clay-tint text-clay-deep border border-clay/30",
};

const detailEntryClasses: Record<CalendarEntryTone, string> = {
  active: "border border-ink/15 bg-white",
  draft: "border border-dashed border-ink/30 bg-white/70 text-ink-faint",
  cancelled: "border border-ink/10 bg-white/60 text-ink-faint",
  proposal: "border border-clay/30 bg-clay-tint",
};

const legend: { tone: CalendarEntryTone; label: string }[] = [
  { tone: "active", label: "課程" },
  { tone: "draft", label: "草稿" },
  { tone: "cancelled", label: "已取消" },
  { tone: "proposal", label: "合作邀請" },
];

function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}

// 課程連結帶上返回月曆的參數（spec 2.4）；合作邀請頁沒有返回參數。
function entryHref(entry: CalendarEntry, month: string, day: string): string {
  if (entry.kind !== "class") {
    return entry.href;
  }

  return `${entry.href}?${new URLSearchParams({ from: "calendar", month, day }).toString()}`;
}

export function TeacherMonthCalendar({ view }: { view: TeacherCalendarView }) {
  const [selectedDay, setSelectedDay] = useState(view.initialDay);
  const selected = view.days[selectedDay] ?? view.days[`${view.month}-01`];

  function selectDay(day: string) {
    setSelectedDay(day);

    try {
      window.history.replaceState(window.history.state, "", teacherCalendarHref(view.month, day));
    } catch {
      // 只是方便返回時停在同一天；失敗不影響畫面。
    }
  }

  return (
    <section aria-label="我的行事曆" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          aria-label="上個月"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-ink/20 bg-white px-3 text-sm text-ink transition hover:border-ink/40"
          href={teacherCalendarHref(view.prevMonth)}
        >
          ←
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-ink">{view.monthLabel}</h2>
          {view.isCurrentMonth ? null : (
            <Link
              className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:underline"
              href={teacherCalendarHref(view.today.slice(0, 7), view.today)}
            >
              回到本月
            </Link>
          )}
        </div>
        <Link
          aria-label="下個月"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-ink/20 bg-white px-3 text-sm text-ink transition hover:border-ink/40"
          href={teacherCalendarHref(view.nextMonth)}
        >
          →
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white">
        <div className="grid grid-cols-7 border-b border-ink/10 bg-cream text-center text-xs text-ink-faint">
          {CALENDAR_WEEKDAY_LABELS.map((label) => (
            <span className="py-2" key={label}>
              {label}
            </span>
          ))}
        </div>
        {view.weeks.map((week, weekIndex) => (
          <div className="grid grid-cols-7 border-b border-ink/10 last:border-b-0" key={weekIndex}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div aria-hidden="true" className="min-h-14 bg-cream/40 md:min-h-28" key={`blank-${dayIndex}`} />;
              }

              const info = view.days[day];
              const hasAvailability = info.slots.length > 0;
              const isSelected = day === selected.day;
              const isToday = day === view.today;
              const hidden = info.entries.length - MAX_ENTRIES_IN_CELL;

              return (
                <div
                  className={`relative min-h-14 min-w-0 overflow-hidden border-r border-ink/10 last:border-r-0 md:min-h-28 ${
                    hasAvailability ? "bg-pine-tint" : "bg-white"
                  } ${isSelected ? "outline-2 -outline-offset-2 outline-pine" : ""}`}
                  data-day={day}
                  data-has-availability={hasAvailability ? "true" : undefined}
                  key={day}
                >
                  <button
                    aria-label={`${dayNumber(day)} 日，${info.entries.length} 筆${hasAvailability ? "，有可授課時間" : ""}`}
                    aria-pressed={isSelected}
                    className="flex min-h-14 w-full flex-col items-center gap-1 px-1 pt-1.5 text-sm md:min-h-0 md:items-start md:px-2"
                    onClick={() => selectDay(day)}
                    type="button"
                  >
                    <span
                      className={`inline-flex size-7 items-center justify-center rounded-full ${
                        isToday ? "bg-pine font-medium text-white" : "text-ink"
                      }`}
                    >
                      {dayNumber(day)}
                    </span>
                    {/* 手機版：只放狀態色點 */}
                    <span aria-hidden="true" className="flex flex-wrap justify-center gap-0.5 md:hidden">
                      {info.entries.slice(0, 4).map((entry) => (
                        <span className={`size-1.5 rounded-full ${dotClasses[entry.tone]}`} key={entry.key} />
                      ))}
                    </span>
                  </button>
                  {/* 電腦版：課名＋人數 */}
                  <ul className="hidden min-w-0 grid-cols-1 gap-1 px-1.5 pb-1.5 md:grid">
                    {info.entries.slice(0, MAX_ENTRIES_IN_CELL).map((entry) => (
                      <li className="min-w-0" key={entry.key}>
                        <Link
                          className={`block truncate rounded-md px-1.5 py-0.5 text-xs transition hover:opacity-80 ${cellEntryClasses[entry.tone]}`}
                          href={entryHref(entry, view.month, day)}
                          title={`${entry.timeLabel} ${entry.title}`}
                        >
                          {entry.countLabel ? `${entry.title} ${entry.countLabel}` : `${entry.badge}・${entry.title}`}
                        </Link>
                      </li>
                    ))}
                    {hidden > 0 ? (
                      <li>
                        <button
                          className="text-xs font-medium text-clay hover:underline"
                          onClick={() => selectDay(day)}
                          type="button"
                        >
                          還有 {hidden} 筆
                        </button>
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ul aria-label="圖例" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        {legend.map((item) => (
          <li className="inline-flex items-center gap-1.5" key={item.tone}>
            <span aria-hidden="true" className={`size-2 rounded-full ${dotClasses[item.tone]}`} />
            {item.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm border border-ink/10 bg-pine-tint" />
          可授課時間
        </li>
      </ul>

      <section aria-live="polite" aria-label="當日明細" className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-4 sm:p-5">
        <h3 className="text-base font-medium text-ink">
          {Number(selected.day.slice(5, 7))} 月 {dayNumber(selected.day)} 日（
          {CALENDAR_WEEKDAY_LABELS[new Date(`${selected.day}T00:00:00Z`).getUTCDay()]}）
        </h3>
        {selected.entries.length === 0 ? (
          <p className="text-sm text-ink-soft">這天沒有課程或合作邀請。</p>
        ) : (
          <ul className="grid gap-2">
            {selected.entries.map((entry) => (
              <li key={entry.key}>
                <Link
                  className={`grid gap-1 rounded-xl px-4 py-3 text-sm transition hover:border-pine/40 ${detailEntryClasses[entry.tone]}`}
                  href={entryHref(entry, view.month, selected.day)}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`min-w-0 break-words font-medium ${entry.tone === "cancelled" ? "line-through" : "text-ink"}`}>
                      {entry.title}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        entry.tone === "proposal" ? "bg-white text-clay-deep" : "bg-sand text-ink-soft"
                      }`}
                    >
                      {entry.badge}
                    </span>
                  </span>
                  <span className="text-ink-soft">
                    {entry.timeLabel}
                    {entry.countLabel ? `・已報名 ${entry.countLabel}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {selected.slots.length > 0 ? (
          <div className="grid gap-1 border-t border-ink/10 pt-3 text-sm">
            <p className="font-medium text-ink">你設定的可授課時間</p>
            <p className="text-ink-soft">
              {selected.slots.map((slot) => `${slot.startTime}–${slot.endTime}`).join("、")}
            </p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
