import Link from "next/link";
import { notFound } from "next/navigation";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { getSeriesDetailForAdmin } from "@/domain/class-session/admin-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireAdmin } from "@/lib/auth/session";

import { adminDetailHref, safeAdminReturnTo } from "../../../_lib/list-context";

// teacher-series-rollup 票 06（spec 2.1）：管理員唯讀系列頁。課程清單的系列卡點進來，
// 列出每一場的日期、狀態、人數，點一場進管理員既有的單堂頁（單場操作都在那裡）。
// 非管理員一律 404（與管理員其他頁相同，不透露存在與否）。
const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export default async function AdminSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [{ recurringClassSeriesId }, query] = await Promise.all([params, searchParams]);
  const series = await getSeriesDetailForAdmin(recurringClassSeriesId);

  if (!series) {
    notFound();
  }

  const returnTo = safeAdminReturnTo("classes", query?.returnTo);
  const schedule =
    series.dayOfWeek === null
      ? `指定日期 ${series.startTime}–${series.endTime}`
      : `每${weekdayLabels[series.dayOfWeek]} ${series.startTime}–${series.endTime}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link className="text-sm font-medium text-gold underline underline-offset-4" href={returnTo}>
          ← 回課程列表
        </Link>
        <p className="mt-4 w-fit rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">
          {series.kind === "term" ? `期班・共 ${series.sessions.filter((session) => session.status !== "cancelled").length} 堂` : "持續開課"}
        </p>
        <h1 className="mt-2 min-w-0 wrap-anywhere text-3xl font-semibold tracking-tight text-ink">{series.title}</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          {schedule}・{series.location}・{series.teacherDisplayName ?? "老師資料無法查看"}
        </p>
        <p className="mt-1 text-sm leading-6 text-ink-soft">這一頁只供查看；要取消某一場或處理報名，點進那一場。</p>
      </header>

      <section aria-labelledby="admin-series-sessions" className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-6">
        <h2 className="text-lg font-medium text-ink" id="admin-series-sessions">
          每一場（{series.sessions.length}）
        </h2>
        <ul className="grid gap-2">
          {series.sessions.map((session) => (
            <li key={session.id}>
              <Link
                className="grid min-h-11 gap-2 rounded-2xl border border-ink/10 bg-cream p-3 text-sm transition hover:border-pine/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:grid-cols-[1fr_auto] sm:items-center"
                href={adminDetailHref("classes", session.id, returnTo)}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{formatTaipeiDatetime(session.startAt)}</span>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[session.status]}`}>
                    {classSessionStatusLabels[session.status]}
                  </span>
                </span>
                <span className="text-ink-soft">
                  已報名 {session.confirmedCount} / {session.capacity} 人{session.pendingCount > 0 ? `・待老師確認 ${session.pendingCount} 人` : ""} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
