"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClassDiscoveryFilters } from "@/domain/class-session/class-discovery-filters";
import { SERVICE_TYPES } from "@/domain/demand-request/service-types";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-ink/25 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-pine";

export function ClassFilters({ filters, yogaStyles, errors }: { filters: ClassDiscoveryFilters; yogaStyles: string[]; errors: string[] }) {
  const [dateRange, setDateRange] = useState(filters.dateRange);
  // 2026-10-18 impeccable 改版（診斷報告 C1）：手機上篩選表單預設收合，第一個畫面先看到課程；
  // 已經帶了篩選條件或有錯誤時預設展開。sm 以上一律顯示，外觀不變。
  const hasActiveFilters =
    errors.length > 0 ||
    filters.dateRange !== "all" ||
    filters.timeOfDay !== "all" ||
    Boolean(filters.location || filters.yogaStyle || filters.serviceType || filters.includeFull) ||
    filters.dayOfWeek !== undefined;
  const [isOpen, setIsOpen] = useState(hasActiveFilters);
  return (
    <section aria-label="篩選課程" className="rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
      <button
        aria-controls="class-filters-form"
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:hidden"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>篩選課程{hasActiveFilters ? "（已套用條件）" : ""}</span>
        <span aria-hidden="true" className="text-gold">{isOpen ? "收起" : "展開"}</span>
      </button>
      <form action="/classes" method="get" className={`${isOpen ? "mt-4 grid" : "hidden"} gap-4 sm:mt-0 sm:grid`} id="class-filters-form">
        {errors.length > 0 ? <div role="alert" className="rounded-xl bg-gold-tint p-3 text-sm text-gold-deep">{errors.join(" ")}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-ink">日期
            <select aria-label="日期" className={inputClass} name="dateRange" value={dateRange} onChange={event => setDateRange(event.target.value as ClassDiscoveryFilters["dateRange"])}>
              <option value="all">不限日期</option><option value="today">今天</option><option value="week">未來 7 天</option><option value="month">未來 30 天</option><option value="custom">自訂日期</option>
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-ink">時段
            <select aria-label="時段" className={inputClass} name="timeOfDay" defaultValue={filters.timeOfDay}>
              <option value="all">不限時段</option><option value="morning">上午</option><option value="afternoon">下午</option><option value="evening">晚上</option>
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-ink">地點
            <input className={inputClass} name="location" defaultValue={filters.location} maxLength={200} placeholder="例如：竹北、新竹市、場地名稱" />
          </label>
          <label className="min-w-0 text-sm font-medium text-ink">瑜伽類型
            <select aria-label="瑜伽類型" className={inputClass} name="yogaStyle" defaultValue={filters.yogaStyle}>
              <option value="">不限類型</option>{yogaStyles.map(style => <option value={style} key={style}>{style}</option>)}
            </select>
          </label>
        </div>
        {dateRange === "custom" ? <div className="rounded-xl border border-ink/10 p-3">
          <p className="text-sm text-ink-soft">自訂起訖日期（包含結束日期當天）</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm text-ink">開始日期<input className={inputClass} type="date" name="dateFrom" defaultValue={filters.dateFrom} required /></label>
            <label className="min-w-0 text-sm text-ink">結束日期<input className={inputClass} type="date" name="dateTo" defaultValue={filters.dateTo} required /></label>
          </div>
        </div> : null}
        <details open={Boolean(filters.serviceType || filters.dayOfWeek !== undefined || filters.includeFull) || undefined} className="rounded-xl border border-ink/10 p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink-soft">更多篩選</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-ink">課程風格<select aria-label="課程風格" className={inputClass} name="serviceType" defaultValue={filters.serviceType}><option value="">不限風格</option>{SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="text-sm text-ink">星期幾<select aria-label="星期幾" className={inputClass} name="dayOfWeek" defaultValue={filters.dayOfWeek ?? ""}><option value="">不限星期</option>{["週日", "週一", "週二", "週三", "週四", "週五", "週六"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink-soft"><input className="size-5 accent-pine" type="checkbox" name="includeFull" value="1" defaultChecked={filters.includeFull} />包含額滿課程</label>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-4">
          <button className="inline-flex min-h-11 items-center rounded-full bg-pine px-6 text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" type="submit">套用篩選</button>
          <Link href="/classes" className="inline-flex min-h-11 items-center text-sm text-gold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">清除篩選</Link>
        </div>
        <p className="text-xs leading-5 text-ink-soft">以台灣時間顯示。預設只看尚未開始、有名額的課程；地點以關鍵字查找。</p>
      </form>
    </section>
  );
}
