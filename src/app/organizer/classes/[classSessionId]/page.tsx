import { notFound, redirect } from "next/navigation";

import { getOwnClassSessionDetailForOrganizer } from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { listConfirmedEnrollmentsForClassSession } from "@/domain/enrollment/read-service";
import { listReviewsForClassSession } from "@/domain/review/read-service";
import { requireUser } from "@/lib/auth/session";

import { demandRequestTargetLevelLabels } from "../../demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "../_components/status-labels";
import {
  cancelClassSessionAction,
  completeClassSessionAction,
  openForEnrollmentAction,
} from "./actions";

type OrganizerClassSessionDetailPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function OrganizerClassSessionDetailPage({
  params,
  searchParams,
}: OrganizerClassSessionDetailPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [{ classSessionId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success"
              ? ("success" as const)
              : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  const classSession = await getOwnClassSessionDetailForOrganizer(classSessionId);

  if (!classSession) {
    notFound();
  }

  const roster = ["open_for_enrollment", "completed"].includes(classSession.status)
    ? ((await listConfirmedEnrollmentsForClassSession(classSessionId)) ?? [])
    : [];
  const reviews =
    classSession.status === "completed"
      ? ((await listReviewsForClassSession(classSessionId)) ?? [])
      : [];
  const hasEnded = hasClassSessionEnded(classSession.endAt);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
          >
            {classSessionStatusLabels[classSession.status]}
          </span>
        </div>
        <h1 className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {classSession.title}
        </h1>
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

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <DetailField label="授課老師" value={classSession.teacherProfile.displayName} />
        <DetailField label="課程類型" value={classSession.serviceType} />
        <DetailField
          label="程度"
          value={
            classSession.demandRequest?.targetLevel
              ? (demandRequestTargetLevelLabels[classSession.demandRequest.targetLevel] ??
                classSession.demandRequest.targetLevel)
              : null
          }
        />
        <DetailField label="開始時間" value={formatTaipeiDatetime(classSession.startAt)} />
        <DetailField label="結束時間" value={formatTaipeiDatetime(classSession.endAt)} />
        <DetailField label="地點" value={classSession.location} />
        <DetailField label="名額上限" value={`${classSession.capacity} 人`} />
        <div className="min-w-0 sm:col-span-2">
          <DetailField label="課程說明" multiline value={classSession.description} />
        </div>
      </section>

      {classSession.status === "draft" ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <div>
            <h2 className="text-lg font-medium text-ink">開放報名</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              開放後，會員就能看到並報名這堂課，此動作無法復原。
            </p>
          </div>
          <form action={openForEnrollmentAction} className="grid gap-3">
            <input name="classSessionId" type="hidden" value={classSessionId} />
            <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
              <input
                className="mt-1 shrink-0"
                name="confirmOpen"
                required
                type="checkbox"
                value="yes"
              />
              我確認要開放這堂課程的報名。
            </label>
            <button
              className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 sm:w-auto"
              type="submit"
            >
              開放報名
            </button>
          </form>
        </section>
      ) : null}

      {["open_for_enrollment", "completed"].includes(classSession.status) ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          {classSession.status === "open_for_enrollment" ? (
            <div>
              <h2 className="text-lg font-medium text-ink">報名連結</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                把這個連結分享給會員，他們登入後就能查看課程並報名。
              </p>
              <p className="mt-2 min-w-0 break-all rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm text-ink">
                {`/classes/${classSessionId}`}
              </p>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-medium text-ink">
              已報名會員（{roster.length} 人）
            </h3>
            {roster.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                目前還沒有會員報名，之後有報名會顯示在這裡。
              </p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {roster.map((entry) => (
                  <li
                    className="min-w-0 rounded-2xl border border-ink/10 bg-cream p-3 text-sm"
                    key={entry.id}
                  >
                    <p className="min-w-0 break-words font-medium text-ink">
                      {entry.memberLabel}
                    </p>
                    {entry.notes ? (
                      <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-ink-soft">
                        {entry.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {classSession.status === "completed" ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">學員評價（{reviews.length} 則）</h2>
          {reviews.length === 0 ? (
            <p className="text-sm leading-6 text-ink-soft">目前還沒有評價。</p>
          ) : (
            <ul className="grid gap-2">
              {reviews.map((review) => (
                <li
                  className="min-w-0 rounded-2xl border border-ink/10 bg-cream p-3 text-sm"
                  key={review.id}
                >
                  <p className="min-w-0 break-words font-medium text-ink">
                    {review.reviewerLabel}・{"★".repeat(review.rating)}
                  </p>
                  {review.comment ? (
                    <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-ink-soft">
                      {review.comment}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {classSession.status === "open_for_enrollment" && hasEnded ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <div>
            <h2 className="text-lg font-medium text-ink">標記完成</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              確認這堂課程已經結束，標記後會顯示為「已完成」。
            </p>
          </div>
          <form action={completeClassSessionAction} className="grid gap-3">
            <input name="classSessionId" type="hidden" value={classSessionId} />
            <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
              <input
                className="mt-1 shrink-0"
                name="confirmComplete"
                required
                type="checkbox"
                value="yes"
              />
              我確認這堂課程已經結束。
            </label>
            <button
              className="w-full rounded-full bg-pine px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto"
              type="submit"
            >
              標記完成
            </button>
          </form>
        </section>
      ) : null}

      {classSession.status === "draft" || classSession.status === "open_for_enrollment" ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-6">
          <details className="grid gap-4">
            <summary className="cursor-pointer list-none text-lg font-medium text-rose-800 marker:hidden">
              取消課程…
            </summary>
            <div>
              <p className="text-sm leading-6 text-ink-soft">
                取消後無法復原，已報名的會員報名也會一併取消，並會收到通知。
              </p>
            </div>
            <form action={cancelClassSessionAction} className="grid gap-3">
              <input name="classSessionId" type="hidden" value={classSessionId} />
              <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
                <input
                  className="mt-1 shrink-0"
                  name="confirmCancel"
                  required
                  type="checkbox"
                  value="yes"
                />
                我確認要取消這堂課程，且已報名的會員也會一併取消。
              </label>
              <button
                className="w-full rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 sm:w-auto"
                type="submit"
              >
                確認取消課程
              </button>
            </form>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function DetailField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0 text-sm">
      <h3 className="font-medium text-ink">{label}</h3>
      <p
        className={`mt-2 break-words leading-6 text-ink-soft ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value && value.trim().length > 0 ? value : "尚未填寫"}
      </p>
    </div>
  );
}

function hasClassSessionEnded(endAt: Date): boolean {
  return endAt.getTime() <= Date.now();
}
