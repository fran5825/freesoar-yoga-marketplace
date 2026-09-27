import Link from "next/link";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";

import { SERVICE_TYPES } from "@/domain/demand-request/service-types";
import { getClassAvailability } from "@/domain/class-session/availability";
import { getPublicClassSessionListItems } from "@/domain/class-session/public-read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";

import { SiteShell } from "../_components/site-shell";

import { ClassAvailabilityBadge } from "./_components/ClassAvailabilityBadge";
import { ClassOriginTag } from "./_components/ClassOriginTag";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type ActiveFilters = { serviceType?: string; dayOfWeek?: number; available: boolean };

// 每個篩選 chip 都是一個連結：點下去就改網址參數並重新載入列表，不需要送出按鈕，
// 也能把篩選結果直接分享給別人。
function buildFilterHref(filters: ActiveFilters, change: Partial<ActiveFilters>): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();

  if (next.serviceType) params.set("serviceType", next.serviceType);
  if (next.dayOfWeek !== undefined) params.set("dayOfWeek", String(next.dayOfWeek));
  if (next.available) params.set("available", "1");

  const query = params.toString();

  return query ? `/classes?${query}` : "/classes";
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "inline-flex shrink-0 whitespace-nowrap rounded-full border border-pine bg-pine px-3 py-1.5 text-sm text-white"
          : "inline-flex shrink-0 whitespace-nowrap rounded-full border border-ink/20 px-3 py-1.5 text-sm text-ink-soft transition hover:border-pine/40 hover:bg-pine-tint/60"
      }
      href={href}
      scroll={false}
    >
      {children}
    </Link>
  );
}

type PublicClassesPageProps = {
  searchParams?: Promise<{ serviceType?: string; dayOfWeek?: string; available?: string }>;
};

// teacher-initiated-open-classes 第 9 節（Slice D）：完全不檢查登入狀態，任何人（Visitor 或
// Member）都能瀏覽。Gate G6 = A，視覺沿用現有頁面既有元件與 Tailwind class 慣例，不引入新
// 色票——品牌視覺計畫核准後再套用（比照 lightweight-payment-v0-plan 的既有先例）。
export default async function PublicClassesPage({ searchParams }: PublicClassesPageProps) {
  const resolvedSearchParams = await searchParams;
  const serviceType = resolvedSearchParams?.serviceType?.trim() || undefined;
  const dayOfWeek =
    resolvedSearchParams?.dayOfWeek !== undefined && resolvedSearchParams.dayOfWeek !== ""
      ? Number(resolvedSearchParams.dayOfWeek)
      : undefined;

  const activeDayOfWeek = Number.isInteger(dayOfWeek) ? dayOfWeek : undefined;
  const availableOnly = resolvedSearchParams?.available === "1";
  const filters: ActiveFilters = {
    serviceType,
    dayOfWeek: activeDayOfWeek,
    available: availableOnly,
  };
  const hasActiveFilters =
    serviceType !== undefined || activeDayOfWeek !== undefined || availableOnly;

  const classSessions = await getPublicClassSessionListItems({
    serviceType,
    dayOfWeek: activeDayOfWeek,
    availableOnly,
  });

  // signed-in-navigation 票 04：登入後套學員專區外框（導覽列「找課程」），訪客維持公開 header。
  return (
    <SiteShell
      publicMainClassName="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8"
      signedInArea="member"
    >
        <header className="border-b border-ink/15 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            瀏覽公開課程
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            這裡列出老師公開招募的課程，登入後即可直接報名。
          </p>
        </header>

        <section aria-label="篩選課程" className="grid gap-4 overflow-hidden rounded-2xl border border-ink/15 bg-white p-5">
          <div>
            <p className="text-sm font-medium text-ink">課程風格</p>
            <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <FilterChip active={serviceType === undefined} href={buildFilterHref(filters, { serviceType: undefined })}>
                不限風格
              </FilterChip>
              {SERVICE_TYPES.map((type) => (
                <FilterChip active={serviceType === type} href={buildFilterHref(filters, { serviceType: type })} key={type}>
                  {type}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">星期幾</p>
            <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <FilterChip active={activeDayOfWeek === undefined} href={buildFilterHref(filters, { dayOfWeek: undefined })}>
                不限星期
              </FilterChip>
              {dayOfWeekLabels.map((label, index) => (
                <FilterChip active={activeDayOfWeek === index} href={buildFilterHref(filters, { dayOfWeek: index })} key={label}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilterChip active={availableOnly} href={buildFilterHref(filters, { available: !availableOnly })}>
              只看還有名額
            </FilterChip>
            {hasActiveFilters ? (
              <Link className="text-sm text-clay underline" href="/classes">
                清除篩選
              </Link>
            ) : null}
          </div>
        </section>

        {classSessions.length === 0 ? (
          <section className="rounded-2xl border border-ink/15 bg-white p-6">
            <h2 className="text-lg font-medium text-ink">目前沒有符合條件的公開課程</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {hasActiveFilters ? "試試放寬篩選條件，或稍後再回來看看。" : "稍後再回來看看。"}
            </p>
            {hasActiveFilters ? (
              <Link
                className="mt-4 inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
                href="/classes"
              >
                清除篩選
              </Link>
            ) : null}
          </section>
        ) : (
          <section className="grid gap-4">
            {classSessions.map((classSession) => (
              <Link
                className="grid gap-2 rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40 hover:bg-pine-tint/60"
                href={`/classes/${classSession.id}`}
                key={classSession.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ClassOriginTag origin={classSession.origin} />
                  <ClassAvailabilityBadge
                    availability={getClassAvailability({
                      capacity: classSession.capacity,
                      activeEnrollmentCount: classSession.activeEnrollmentCount,
                      startAt: classSession.startAt,
                    })}
                  />
                </div>
                <h2 className="min-w-0 break-words text-lg font-medium text-ink">
                  {classSession.title}
                </h2>
                <p className="text-sm text-ink-soft">
                  {classSession.teacherProfile.displayName ?? "老師"}
                  {getClassServiceTypes(classSession).length > 0
                    ? ` ・ ${getClassServiceTypes(classSession).join("、")}`
                    : ""}
                </p>
                {classSession.yogaStyles.length > 0 ? (
                  <p className="text-sm text-ink-soft">
                    瑜伽類型：{classSession.yogaStyles.join("、")}
                  </p>
                ) : null}
                <p className="text-sm text-ink-soft">
                  {formatTaipeiDatetime(classSession.startAt)} 開始 ・ {classSession.location}
                </p>
              </Link>
            ))}
          </section>
        )}
    </SiteShell>
  );
}
