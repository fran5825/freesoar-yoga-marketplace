import Link from "next/link";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { getClassAvailability } from "@/domain/class-session/availability";
import {
  getPublicClassListEntries,
  getPublicClassYogaStyles,
  type PublicClassSessionListItem,
  type PublicTermListItem,
} from "@/domain/class-session/public-read-service";
import { classDiscoveryHref, classDiscoveryWeekday, parseClassDiscoveryFilters, type DiscoveryParams } from "@/domain/class-session/class-discovery-filters";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { classDetailHref } from "@/lib/navigation/class-return-path";
import { SiteShell } from "../_components/site-shell";
import { ClassAvailabilityBadge } from "./_components/ClassAvailabilityBadge";
import { ClassOriginTag } from "./_components/ClassOriginTag";
import { ClassFilters } from "./_components/ClassFilters";

export default async function PublicClassesPage({ searchParams }: { searchParams?: Promise<DiscoveryParams> }) {
  const { filters, errors } = parseClassDiscoveryFilters(await searchParams);
  // teacher-class-scheduling 票 12：公開期班合併成一張卡片，其他場次維持逐場。
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
      <p role="status" className="text-sm text-ink-soft">{errors.length ? "請修正篩選條件後再查找。" : `找到 ${entries.length} 堂${filters.includeFull ? "尚未開始" : "還有名額"}的課程`}</p>
      {entries.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有符合條件的公開課程</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">試試放寬日期、地點或類型，或稍後再回來看看。</p>
          <Link className="mt-4 inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white" href="/classes">清除篩選</Link>
        </section>
      ) : <section aria-label="課程結果" className="grid gap-4 sm:grid-cols-2">
        {entries.map(entry => entry.kind === "term" ? <TermCard key={`term-${entry.item.id}`} term={entry.item} /> : <SessionCard key={entry.item.id} returnTo={returnTo} session={entry.item} />)}
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
        <span className={term.canEnroll ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800" : "rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink-soft"}>{term.canEnroll ? "可報名" : "目前無法報名"}</span>
      </div>
      <h2 className="min-w-0 break-words text-lg font-medium text-ink">{term.title}</h2>
      <p className="text-sm text-ink">{term.scheduleLabel}・下一堂 {formatTaipeiDatetime(term.nextStartAt)}</p>
      <p className="break-words text-sm text-ink-soft">{term.location}</p>
      <p className="break-words text-sm text-ink-soft">{term.teacherProfile.displayName ?? "老師"}{serviceTypes.length ? `・${serviceTypes.join("、")}` : ""}</p>
      {term.yogaStyles.length ? <p className="break-words text-sm text-ink-soft">瑜伽類型：{term.yogaStyles.join("、")}</p> : null}
      <p className="text-sm font-medium text-pine">{term.termEnrollmentMode === "term_only" ? "只收整期報名" : "可報整期，也可單堂報名"}{term.requiresApproval ? "・需老師確認" : ""}</p>
      <span className="text-sm text-clay">查看期班 →</span>
    </Link>
  );
}

function SessionCard({ session, returnTo }: { session: PublicClassSessionListItem; returnTo: string }) {
  return (
        <Link className={cardClassName} href={classDetailHref(session.id, returnTo)}>
          <div className="flex flex-wrap gap-2"><ClassOriginTag origin={session.origin} /><ClassAvailabilityBadge availability={getClassAvailability({ capacity: session.capacity, activeEnrollmentCount: session.activeEnrollmentCount, startAt: session.startAt })} canAcceptNewEnrollments={session.canAcceptNewEnrollments} /></div>
          <h2 className="min-w-0 break-words text-lg font-medium text-ink">{session.title}</h2>
          <p className="text-sm text-ink">{formatTaipeiDatetime(session.startAt)}・{classDiscoveryWeekday(session.startAt)}</p>
          <p className="break-words text-sm text-ink-soft">{session.location}</p>
          <p className="break-words text-sm text-ink-soft">{session.teacherProfile.displayName ?? "老師"}{getClassServiceTypes(session).length ? `・${getClassServiceTypes(session).join("、")}` : ""}</p>
          {session.yogaStyles.length ? <p className="break-words text-sm text-ink-soft">瑜伽類型：{session.yogaStyles.join("、")}</p> : null}
          <p className="text-sm font-medium text-pine">{session.requiresApproval ? "報名需老師確認" : "確認送出後成立報名"}</p>
          <span className="text-sm text-clay">查看課程 →</span>
        </Link>
  );
}
