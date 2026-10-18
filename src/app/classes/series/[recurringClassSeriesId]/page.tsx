import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import {
  getPublicSeriesDetail,
  parseSeriesShow,
  SERIES_SHOW_DEFAULT,
  SERIES_SHOW_MAX,
  SERIES_SHOW_STEP,
  type PublicSeriesDetail,
} from "@/domain/class-session/public-read-service";
import { loadEnrollRows, type EnrollRow as EnrollRowData } from "@/domain/enrollment/session-enroll-rows";
import { getCurrentUser } from "@/lib/auth/session";
import { classDetailHref, classReturnLabel, safeParentReturnPath, seriesDetailHref } from "@/lib/navigation/class-return-path";

import { ScrollToTarget } from "../../../_components/ScrollToTarget";
import { SiteShell } from "../../../_components/site-shell";
import { DetailCover, TeacherByline } from "../../_components/ClassCover";
import { ClassOriginTag } from "../../_components/ClassOriginTag";
import { EnrollRow, PageFeedback, readRowFeedback, type RowFeedback } from "../../_components/EnrollRow";

// class-discovery-series-cards 票 01：持續開課的系列頁。找不到、不是持續開課、沒有公開場次一律 not-found。
// inline-member-enroll 票 07：每一場的列直接報名（名額旁的「報名」就地展開），自己已報名的列顯示狀態與取消報名，
// 不必進單堂頁；日期仍連到單堂頁看詳情。
const cardClass = "min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6";

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ show?: string | string[]; returnTo?: string; result?: string; message?: string; focus?: string; open?: string }>;
}) {
  const [{ recurringClassSeriesId }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const returnTo = safeParentReturnPath(query?.returnTo);
  const series = await getPublicSeriesDetail(recurringClassSeriesId, { show: parseSeriesShow(query?.show) });

  if (!series) {
    notFound();
  }

  const rows = await loadEnrollRows(series.sessions.map((session) => session.id), user?.id ?? null);
  const feedback = readRowFeedback(query);
  // 列上操作做完回到這一頁（保留來源與已展開的日期數）。
  const seriesHref = seriesDetailHref(series.id, returnTo);
  const selfHref =
    series.show === SERIES_SHOW_DEFAULT ? seriesHref : `${seriesHref}${seriesHref.includes("?") ? "&" : "?"}show=${series.show}`;

  return (
    <SiteShell
      signedInArea="member"
      publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8"
      signedInClassName="flex flex-col gap-6"
    >
      <div className="grid min-w-0 gap-6">
        <Link className="inline-flex min-h-11 w-fit items-center text-sm text-gold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" href={returnTo}>
          {classReturnLabel(returnTo)}
        </Link>
        <header className="border-b border-ink/15 pb-5">
          <div className="flex flex-wrap gap-2">
            <ClassOriginTag origin={series.origin} />
            <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">持續開課</span>
          </div>
          <h1 className="mt-3 min-w-0 break-words text-2xl font-semibold tracking-tight text-ink">{series.title}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            每一堂各自報名，在想上的日期按「{series.requiresApproval ? "申請報名" : "報名"}」即可{series.requiresApproval ? "；報名需老師確認" : ""}。
          </p>
        </header>

        <PageFeedback feedback={feedback} />
        <ScrollToTarget targetId={query?.focus} />
        <DetailCover url={series.coverUrl} />
        <SeriesSummary series={series} />
        <SeriesSessionList feedback={feedback} returnTo={returnTo} rows={rows} selfHref={selfHref} series={series} signedIn={Boolean(user)} />

        {series.priceNote ? (
          <section aria-labelledby="series-price-heading" className={cardClass}>
            <h2 className="text-lg font-medium text-ink" id="series-price-heading">價格</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{series.priceNote}</p>
          </section>
        ) : null}
        <section aria-labelledby="series-description-heading" className={cardClass}>
          <h2 className="text-lg font-medium text-ink" id="series-description-heading">課程說明</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{series.description || "尚未提供課程說明。"}</p>
        </section>
        <section aria-labelledby="series-suitable-heading" className={cardClass}>
          <h2 className="text-lg font-medium text-ink" id="series-suitable-heading">適合對象</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{series.suitableFor || "尚未提供"}</p>
        </section>
        <section aria-labelledby="series-preparation-heading" className={cardClass}>
          <h2 className="text-lg font-medium text-ink" id="series-preparation-heading">準備事項</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{series.preparationNotes || "尚未提供"}</p>
        </section>
        {series.paymentRulesText ? (
          <section aria-labelledby="series-payment-rules-heading" className={cardClass}>
            <h2 className="text-lg font-medium text-ink" id="series-payment-rules-heading">繳費與取消規則</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{series.paymentRulesText}</p>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}

function SeriesSummary({ series }: { series: PublicSeriesDetail }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: "上課時間", value: series.scheduleLabel },
    { label: "地點", value: series.location },
    { label: "老師", value: <TeacherByline avatarUrl={series.teacherAvatarUrl} href={series.teacherPageId ? `/teachers/${series.teacherPageId}` : null} name={series.teacherProfile.displayName ?? "飛索老師"} /> },
    ...(series.serviceTypes.length ? [{ label: "課程風格", value: series.serviceTypes.join("、") }] : []),
    ...(series.yogaStyles.length ? [{ label: "瑜伽類型", value: series.yogaStyles.join("、") }] : []),
  ];

  return (
    <section aria-labelledby="series-summary-heading" className={cardClass}>
      <h2 className="text-lg font-medium text-ink" id="series-summary-heading">課程資訊</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-ink-faint">{row.label}</dt>
            <dd className="mt-1 break-words text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SeriesSessionList({
  series,
  returnTo,
  rows,
  selfHref,
  signedIn,
  feedback,
}: {
  series: PublicSeriesDetail;
  returnTo: string;
  rows: Map<string, EnrollRowData>;
  selfHref: string;
  signedIn: boolean;
  feedback: RowFeedback | null;
}) {
  const nextShow = Math.min(series.show + SERIES_SHOW_STEP, SERIES_SHOW_MAX);
  const showMoreParams = new URLSearchParams();
  if (returnTo !== "/classes") showMoreParams.set("returnTo", returnTo);
  showMoreParams.set("show", String(nextShow));

  return (
    <section aria-labelledby="series-sessions-heading" className={cardClass} id="sessions">
      <h2 className="text-lg font-medium text-ink" id="series-sessions-heading">挑一個上課日期</h2>
      <ul aria-label="可報名的上課日期" className="mt-3 grid gap-2">
        {series.sessions.map((session) => {
          const row = rows.get(session.id);
          const main = (
            <>
              <Link className="inline-flex min-h-11 items-center font-medium text-ink underline-offset-4 hover:underline" href={classDetailHref(session.id, seriesDetailHref(series.id, returnTo))}>
                {formatTaipeiShortDatetime(session.startAt)}
              </Link>
              {session.timeNote || session.locationNote ? (
                <span className="block break-words text-ink-soft">
                  {session.timeNote ? `這一堂時間：${session.timeNote}` : ""}
                  {session.timeNote && session.locationNote ? "・" : ""}
                  {session.locationNote ? `這一堂地點：${session.locationNote}` : ""}
                </span>
              ) : null}
            </>
          );

          return row ? <EnrollRow feedback={feedback} key={session.id} main={main} returnTo={selfHref} row={row} signedIn={signedIn} /> : null;
        })}
      </ul>
      {series.hasMore && !series.capped ? (
        <Link className="mt-4 inline-flex min-h-11 items-center rounded-full border border-pine/40 px-5 py-2 text-sm font-medium text-pine hover:bg-pine-tint" href={`?${showMoreParams.toString()}#sessions`} scroll={false}>
          看更多日期
        </Link>
      ) : null}
      {series.capped ? <p className="mt-4 text-sm text-ink-soft">僅列出前 {SERIES_SHOW_MAX} 堂。</p> : null}
    </section>
  );
}
