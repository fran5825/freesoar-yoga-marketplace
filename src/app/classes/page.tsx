import Link from "next/link";
import {
  getPublicClassListEntries,
  getPublicClassYogaStyles,
} from "@/domain/class-session/public-read-service";
import { classDiscoveryHref, parseClassDiscoveryFilters, type DiscoveryParams } from "@/domain/class-session/class-discovery-filters";
import { SiteShell } from "../_components/site-shell";
import { ClassListEntries } from "./_components/ClassListCards";
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
        <ClassListEntries entries={entries} returnTo={returnTo} />
      </section>}
    </SiteShell>
  );
}
