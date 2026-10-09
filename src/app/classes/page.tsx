import Link from "next/link";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { getClassAvailability } from "@/domain/class-session/availability";
import {
  getPublicClassListEntries,
  getPublicClassYogaStyles,
  type PublicClassSessionListItem,
  type PublicSeriesListItem,
  type PublicTermListItem,
} from "@/domain/class-session/public-read-service";
import { classDiscoveryHref, classDiscoveryWeekday, parseClassDiscoveryFilters, type DiscoveryParams } from "@/domain/class-session/class-discovery-filters";
import { formatTaipeiDatetime, formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { classDetailHref } from "@/lib/navigation/class-return-path";
import { SiteShell } from "../_components/site-shell";
import { ClassOriginTag } from "./_components/ClassOriginTag";
import { ClassFilters } from "./_components/ClassFilters";

export default async function PublicClassesPage({ searchParams }: { searchParams?: Promise<DiscoveryParams> }) {
  const { filters, errors } = parseClassDiscoveryFilters(await searchParams);
  // 期班與持續開課各自合併成一張卡片（teacher-class-scheduling 票 12、class-discovery-series-cards 票 02），沒有系列的單堂維持逐場。
  const [entries, availableStyles] = await Promise.all([
    errors.length ? Promise.resolve([]) : getPublicClassListEntries({ serviceType: filters.serviceType || undefined, dayOfWeek: filters.dayOfWeek, discovery: filters }),
    getPublicClassYogaStyles(),
  ]);
  const returnTo = classDiscoveryHref(filters);
  const yogaStyles = [...new Set([...availableStyles, ...(filters.yogaStyle ? [filters.yogaStyle] : [])])];
  return (
    <SiteShell publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8" signedInArea="member">
      <header className="border-b border-ink/15 pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">找課程</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">找到適合你時間與地點的一堂課。團主團課與老師開課，都可以在這裡查看。</p>
      </header>
      <ClassFilters key={returnTo} filters={filters} yogaStyles={yogaStyles} errors={errors} />
      <p role="status" className="text-sm text-ink-soft">{errors.length ? "請修正篩選條件後再查找。" : `找到 ${entries.length} 個${filters.includeFull ? "尚未開始" : "還有名額"}的課程`}</p>
      {entries.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有符合條件的公開課程</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">試試放寬日期、地點或類型，或稍後再回來看看。</p>
          <Link className="mt-4 inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white" href="/classes">清除篩選</Link>
        </section>
      ) : <section aria-label="課程結果" className="grid gap-4 sm:grid-cols-2">
        {entries.map(entry => entry.kind === "term" ? <TermCard key={`term-${entry.item.id}`} term={entry.item} /> : entry.kind === "series" ? <SeriesCard key={`series-${entry.item.id}`} series={entry.item} /> : <SessionCard key={entry.item.id} returnTo={returnTo} session={entry.item} />)}
      </section>}
    </SiteShell>
  );
}

const cardClassName = "grid min-w-0 gap-3 rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40 focus-visible:outline-2 focus-visible:outline-pine";

function TermCard({ term }: { term: PublicTermListItem }) {
  const serviceTypes = getClassServiceTypes(term);
  return (
    <Link className={cardClassName} href={`/classes/terms/${term.id}`}>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">期班・共 {term.totalCount} 堂・剩 {term.remainingCount} 堂</span>
        {term.canEnroll ? null : <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink-soft">目前無法報名</span>}
      </div>
      <h2 className="min-w-0 break-words text-lg font-medium text-ink">{term.title}</h2>
      <p className="text-sm text-ink">{term.scheduleLabel}</p>
      <p className="break-words text-sm text-ink-soft">{term.location}</p>
      <p className="break-words text-sm text-ink-soft">{term.teacherProfile.displayName ?? "老師"}{serviceTypes.length ? `・${serviceTypes.join("、")}` : ""}</p>
      {term.yogaStyles.length ? <p className="break-words text-sm text-ink-soft">瑜伽類型：{term.yogaStyles.join("、")}</p> : null}
      <p className="text-sm font-medium text-pine">下一堂 {formatTaipeiShortDatetime(term.nextStartAt)}・{term.termEnrollmentMode === "term_only" ? "只收整期報名" : "可報整期，也可單堂報名"}{term.requiresApproval ? "・需老師確認" : ""}</p>
    </Link>
  );
}

function SeriesCard({ series }: { series: PublicSeriesListItem }) {
  const serviceTypes = getClassServiceTypes(series);
  return (
    <Link className={cardClassName} href={`/classes/series/${series.id}`}>
      <div className="flex flex-wrap gap-2"><ClassOriginTag origin={series.origin} /><span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">持續開課</span></div>
      <h2 className="min-w-0 break-words text-lg font-medium text-ink">{series.title}</h2>
      <p className="text-sm text-ink">{series.scheduleLabel}</p>
      <p className="break-words text-sm text-ink-soft">{series.location}</p>
      <p className="break-words text-sm text-ink-soft">{series.teacherProfile.displayName ?? "老師"}{serviceTypes.length ? `・${serviceTypes.join("、")}` : ""}</p>
      {series.yogaStyles.length ? <p className="break-words text-sm text-ink-soft">瑜伽類型：{series.yogaStyles.join("、")}</p> : null}
      <p className={series.nextIsFull ? "text-sm font-medium text-ink-soft" : "text-sm font-medium text-pine"}>
        {series.nextIsFull ? `最近一堂 ${formatTaipeiShortDatetime(series.nextStartAt)}・已額滿` : `下一個有名額 ${formatTaipeiShortDatetime(series.nextStartAt)}・剩 ${series.nextRemainingSeats} 個名額`}
      </p>
    </Link>
  );
}

function SessionCard({ session, returnTo }: { session: PublicClassSessionListItem; returnTo: string }) {
  const availability = getClassAvailability({ capacity: session.capacity, activeEnrollmentCount: session.activeEnrollmentCount, startAt: session.startAt });
  const open = availability.state === "open" && session.canAcceptNewEnrollments;
  return (
    <Link className={cardClassName} href={classDetailHref(session.id, returnTo)}>
      <div className="flex flex-wrap gap-2"><ClassOriginTag origin={session.origin} /></div>
      <h2 className="min-w-0 break-words text-lg font-medium text-ink">{session.title}</h2>
      <p className="text-sm text-ink">{formatTaipeiDatetime(session.startAt)}・{classDiscoveryWeekday(session.startAt)}</p>
      <p className="break-words text-sm text-ink-soft">{session.location}</p>
      <p className="break-words text-sm text-ink-soft">{session.teacherProfile.displayName ?? "老師"}{getClassServiceTypes(session).length ? `・${getClassServiceTypes(session).join("、")}` : ""}</p>
      {session.yogaStyles.length ? <p className="break-words text-sm text-ink-soft">瑜伽類型：{session.yogaStyles.join("、")}</p> : null}
      <p className={open ? "text-sm font-medium text-pine" : "text-sm font-medium text-ink-soft"}>
        {open ? `剩 ${availability.remainingSeats} 個名額` : availability.state === "full" ? "已額滿" : availability.state === "started" ? "已開始" : "目前不開放報名"}
        {session.requiresApproval ? "・需老師確認" : ""}
      </p>
    </Link>
  );
}
