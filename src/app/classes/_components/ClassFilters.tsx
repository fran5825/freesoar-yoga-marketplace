"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClassDiscoveryFilters } from "@/domain/class-session/class-discovery-filters";
import { SERVICE_TYPES } from "@/domain/demand-request/service-types";

const inputClass = "mt-2 w-full min-w-0 rounded-xl border border-ink/25 bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-pine";

export function ClassFilters({ filters, yogaStyles, errors }: { filters: ClassDiscoveryFilters; yogaStyles: string[]; errors: string[] }) {
  const [dateRange, setDateRange] = useState(filters.dateRange);
  return (
    <section aria-label="篩選課程" className="rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
      <form action="/classes" method="get" className="grid gap-4">
        {errors.length > 0 ? <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{errors.join(" ")}</div> : null}
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
            <input className={inputClass} name="location" defaultValue={filters.location} maxLength={200} placeholder="例如：台北、信義區、場地名稱" />
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
          <summary className="cursor-pointer text-sm text-ink-soft">更多篩選</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-ink">課程風格<select aria-label="課程風格" className={inputClass} name="serviceType" defaultValue={filters.serviceType}><option value="">不限風格</option>{SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="text-sm text-ink">星期幾<select aria-label="星期幾" className={inputClass} name="dayOfWeek" defaultValue={filters.dayOfWeek ?? ""}><option value="">不限星期</option>{["週日", "週一", "週二", "週三", "週四", "週五", "週六"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" name="includeFull" value="1" defaultChecked={filters.includeFull} />包含額滿課程</label>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-4">
          <button className="rounded-full bg-pine px-6 py-3 text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay" type="submit">套用篩選</button>
          <Link href="/classes" className="py-2 text-sm text-clay underline">清除篩選</Link>
        </div>
        <p className="text-xs leading-5 text-ink-soft">以台灣時間顯示。預設只看尚未開始、有名額的課程；地點以關鍵字查找。</p>
      </form>
    </section>
  );
}
