import Link from "next/link";
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

import { cancelRecurringClassSeriesAction, generateMoreOccurrencesAction } from "./actions";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type RecurringClassSeriesPageProps = {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

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

  const hasFutureCancellableOccurrence = series.occurrences.some(isCancellableOccurrence);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-sky-700">Teacher classes / 系列管理</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
              {series.title}
            </h1>
          </div>
          <Link
            className="inline-flex rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-400"
            href="/teacher/classes"
          >
            回到我的課程
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          {series.dayOfWeek === null
            ? "固定期課程系列——日期在建立當下已經一次到位，不支援生成更多。"
            : `常規課程系列——每週${dayOfWeekLabels[series.dayOfWeek]}${series.startTime}–${series.endTime}。`}
        </p>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          {series.requiresApproval
            ? "這個系列底下的新報名需要你確認才算成立。"
            : "這個系列底下的新報名送出即成立。"}
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      <section className="grid gap-3 rounded border border-gray-200 bg-white p-5">
        <dl className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-gray-950">地點</dt>
            <dd className="mt-1 break-words">{series.location}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-950">名額上限</dt>
            <dd className="mt-1">{series.capacity} 人</dd>
          </div>
          {series.serviceType ? (
            <div>
              <dt className="font-medium text-gray-950">課程類型</dt>
              <dd className="mt-1">{series.serviceType}</dd>
            </div>
          ) : null}
        </dl>
        {series.description ? (
          <p className="whitespace-pre-wrap break-words border-t border-gray-100 pt-3 text-sm leading-6 text-gray-600">
            {series.description}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 rounded border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-medium text-gray-950">
          已生成場次（{series.occurrences.length}）
        </h2>
        {series.occurrences.length === 0 ? (
          <p className="text-sm leading-6 text-gray-600">目前還沒有生成任何場次。</p>
        ) : (
          <ul className="grid gap-2">
            {series.occurrences.map((occurrence) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
                key={occurrence.id}
              >
                <span className="text-gray-950">
                  {formatTaipeiDatetime(occurrence.startAt)} – {formatTaipeiDatetime(occurrence.endAt)}
                </span>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[occurrence.status]}`}
                >
                  {classSessionStatusLabels[occurrence.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-5">
        {series.dayOfWeek !== null ? (
          <form action={generateMoreOccurrencesAction} className="grid gap-3">
            <input name="recurringClassSeriesId" type="hidden" value={series.id} />
            <label className="text-sm font-medium text-gray-950" htmlFor="count">
              生成更多場次
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="w-24 rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={8}
                id="count"
                max={26}
                min={1}
                name="count"
                required
                type="number"
              />
              <button
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-sky-300 hover:bg-sky-50"
                type="submit"
              >
                生成
              </button>
            </div>
          </form>
        ) : null}

        {hasFutureCancellableOccurrence ? (
          <form action={cancelRecurringClassSeriesAction} className="border-t border-gray-100 pt-4">
            <input name="recurringClassSeriesId" type="hidden" value={series.id} />
            <button
              className="rounded border border-amber-200 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
              type="submit"
            >
              取消整個系列（僅影響尚未開始的場次）
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function isCancellableOccurrence(occurrence: RecurringClassSeriesOccurrence): boolean {
  return (
    ["draft", "open_for_enrollment"].includes(occurrence.status) &&
    occurrence.startAt.getTime() > Date.now()
  );
}
