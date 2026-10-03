import Link from "next/link";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { notFound, redirect } from "next/navigation";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import {
  getOwnRecurringClassSeriesDetailForTeacher,
  type RecurringClassSeriesOccurrence,
} from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

import { ConfirmActionDialog } from "../../_components/ConfirmActionDialog";
import { PendingSubmitButton } from "../../_components/PendingSubmitButton";
import { teacherClassDetailHref } from "../../_lib/return-context";
import { cancelRecurringClassSeriesAction, generateMoreOccurrencesAction } from "./actions";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type RecurringClassSeriesPageProps = {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

// teacher-initiated-open-classes Slice B：常規／固定期課程系列管理頁。
// teacher-usability-redesign 票 05：每場顯示日期、狀態、已確認／待確認人數並可點進單堂（返回會回到這裡的同一場）；
// 取消整個系列先在確認視窗列出真正會被取消的場次與報名，確認後才沿用既有取消 service。
export default async function RecurringClassSeriesPage({
  params,
  searchParams,
}: RecurringClassSeriesPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [{ recurringClassSeriesId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  const series = await getOwnRecurringClassSeriesDetailForTeacher(recurringClassSeriesId);

  if (!series) {
    notFound();
  }

  const now = new Date().getTime();
  const cancellableOccurrences = series.occurrences.filter((occurrence) =>
    isCancellableOccurrence(occurrence, now),
  );
  const affectedConfirmed = cancellableOccurrences.reduce((sum, item) => sum + item.confirmedCount, 0);
  const affectedPending = cancellableOccurrences.reduce((sum, item) => sum + item.pendingCount, 0);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:underline"
          href="/teacher/classes"
        >
          ← 回我的課程
        </Link>
        <p className="mt-1 text-sm font-medium text-clay">系列管理</p>
        <h1 className="mt-1 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {series.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {series.dayOfWeek === null
            ? `指定日期系列——${series.startTime}–${series.endTime}，日期在建立時已經一次決定，不支援生成更多。`
            : `每週固定系列——每${dayOfWeekLabels[series.dayOfWeek]} ${series.startTime}–${series.endTime}。`}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
          每一場都是獨立的課：要逐堂開放報名、逐堂處理報名；系列場次不會列在公開課程列表。
          {series.requiresApproval ? "新報名需要你確認才算成立。" : "新報名送出即成立。"}
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      <section
        aria-labelledby="occurrences-title"
        className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-medium text-ink" id="occurrences-title">
          已生成場次（{series.occurrences.length}）
        </h2>
        {series.occurrences.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">目前還沒有生成任何場次。</p>
        ) : (
          <ul className="grid gap-2">
            {/* 票 04／05：每場可點進單堂詳情，詳情頁的「返回」會回到這個系列的同一場位置。 */}
            {series.occurrences.map((occurrence) => {
              const isOver =
                occurrence.status === "cancelled" ||
                occurrence.status === "completed" ||
                occurrence.endAt.getTime() <= now;

              return (
                <li className="scroll-mt-6" id={`class-${occurrence.id}`} key={occurrence.id}>
                  <Link
                    className={`grid min-h-11 gap-2 rounded-2xl border p-3 text-sm transition hover:border-pine/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:grid-cols-[1fr_auto] sm:items-center ${
                      isOver ? "border-ink/10 bg-cream/60 text-ink-soft" : "border-ink/10 bg-cream text-ink"
                    }`}
                    href={teacherClassDetailHref(occurrence.id, { kind: "series", seriesId: series.id })}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {formatTaipeiDatetime(occurrence.startAt)} – {formatTaipeiDatetime(occurrence.endAt)}
                      </span>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[occurrence.status]}`}
                      >
                        {classSessionStatusLabels[occurrence.status]}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
                      <span>
                        已報名 {occurrence.confirmedCount} / {series.capacity} 人
                      </span>
                      {occurrence.pendingCount > 0 ? (
                        <span className="font-medium text-clay-deep">
                          待確認 {occurrence.pendingCount} 人
                        </span>
                      ) : null}
                      <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="series-info-title"
        className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-medium text-ink" id="series-info-title">
          系列內容
        </h2>
        <dl className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-medium text-ink">地點</dt>
            <dd className="mt-1 break-words">{series.location}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">名額上限（每場）</dt>
            <dd className="mt-1">{series.capacity} 人</dd>
          </div>
          {getClassServiceTypes(series).length > 0 ? (
            <div className="min-w-0">
              <dt className="font-medium text-ink">課程風格</dt>
              <dd className="mt-1 break-words">{getClassServiceTypes(series).join("、")}</dd>
            </div>
          ) : null}
          {series.yogaStyles.length > 0 ? (
            <div className="min-w-0">
              <dt className="font-medium text-ink">瑜伽類型</dt>
              <dd className="mt-1 break-words">{series.yogaStyles.join("、")}</dd>
            </div>
          ) : null}
        </dl>
        {series.description ? (
          <p className="whitespace-pre-wrap break-words border-t border-ink/10 pt-3 text-sm leading-6 text-ink-soft">
            {series.description}
          </p>
        ) : null}
      </section>

      {series.dayOfWeek !== null ? (
        <section className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
          <form action={generateMoreOccurrencesAction} className="grid gap-3">
            <input name="recurringClassSeriesId" type="hidden" value={series.id} />
            <label className="text-sm font-medium text-ink" htmlFor="count">
              生成更多場次
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="min-h-11 w-24 rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={8}
                id="count"
                max={26}
                min={1}
                name="count"
                required
                type="number"
              />
              <PendingSubmitButton className="min-h-11 rounded-full border border-ink/25 px-5 py-2 text-sm font-medium text-ink transition hover:border-pine/40 hover:bg-pine-tint">
                生成
              </PendingSubmitButton>
            </div>
            <p className="text-xs leading-5 text-ink-faint">
              從目前最後一場之後，依每{dayOfWeekLabels[series.dayOfWeek]}繼續生成；新場次一樣是草稿，要逐堂開放報名。
            </p>
          </form>
        </section>
      ) : null}

      {cancellableOccurrences.length > 0 ? (
        <section
          aria-labelledby="cancel-series-title"
          className="grid gap-3 rounded-2xl border border-ink/10 p-5 sm:p-6"
        >
          <h2 className="text-base font-medium text-ink" id="cancel-series-title">
            取消這個系列
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            只會取消還沒開始的草稿與開放報名場次；已開始、已結束或已取消的場次不受影響。
          </p>
          <div>
            <ConfirmActionDialog
              action={cancelRecurringClassSeriesAction}
              confirmLabel={`確定取消 ${cancellableOccurrences.length} 場`}
              hiddenFields={{ recurringClassSeriesId: series.id }}
              title="取消這個系列尚未開始的場次？"
              triggerClassName="min-h-11 rounded-full border border-clay/40 px-5 py-2 text-left text-sm font-medium text-clay transition hover:bg-clay-tint"
              triggerLabel="取消整個系列（僅影響尚未開始的場次）"
            >
              <p>
                系列：<span className="break-words font-medium text-ink">{series.title}</span>
              </p>
              <p>會取消以下 {cancellableOccurrences.length} 場：</p>
              <ul
                aria-label="會被取消的場次"
                className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-3"
              >
                {cancellableOccurrences.map((occurrence) => (
                  <li key={occurrence.id}>
                    {formatTaipeiDatetime(occurrence.startAt)}
                    {occurrence.confirmedCount + occurrence.pendingCount > 0
                      ? `（已報名 ${occurrence.confirmedCount}、待確認 ${occurrence.pendingCount}）`
                      : ""}
                  </li>
                ))}
              </ul>
              <p>
                {affectedConfirmed + affectedPending > 0
                  ? `這些場次共有已報名 ${affectedConfirmed} 筆、待確認 ${affectedPending} 筆報名，會一起取消，學員會收到通知。`
                  : "這些場次目前沒有人報名。"}
              </p>
              <p>取消後這些場次不能再開放報名。系列本身會保留，不會被刪除。</p>
            </ConfirmActionDialog>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function isCancellableOccurrence(occurrence: RecurringClassSeriesOccurrence, now: number): boolean {
  return (
    ["draft", "open_for_enrollment"].includes(occurrence.status) &&
    occurrence.startAt.getTime() > now
  );
}
