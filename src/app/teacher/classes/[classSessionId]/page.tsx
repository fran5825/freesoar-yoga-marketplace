import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { getOwnClassSessionDetailForTeacher } from "@/domain/class-session/read-service";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { getTeacherClassNextStep } from "@/domain/class-session/teacher-next-step";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

import {
  cancelOwnClassSessionAction,
  completeOwnClassSessionAction,
  confirmPendingEnrollmentAction,
  declinePendingEnrollmentAction,
  openOwnClassSessionForEnrollmentAction,
} from "../actions";

type TeacherClassSessionDetailPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

const originLabels: Record<string, string> = {
  organizer_matched: "團主媒合",
  teacher_initiated: "自己開的課",
};

const nextStepToneClasses = {
  action: "border-clay/30 bg-clay-tint text-clay-deep",
  waiting: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-pine/15 bg-pine-tint text-pine-deep",
} as const;

// teacher-usability 第 06 票：老師的單堂課詳情頁。
// 順序：下一步提示 → 報名狀況與名單 → 課程內容 → 評價 → 操作。
// 讀取只看得到自己的課（getOwnClassSessionDetailForTeacher，第 05 票），別人的課一律 404。
// 暫停中的老師仍可查看自己既有的課（D15）；開放報名、取消、標記完成只對自己開的課顯示，
// 報名確認／婉拒兩種來源都顯示（與原本列表頁的規則相同，底層 action 不變）。
export default async function TeacherClassSessionDetailPage({
  params,
  searchParams,
}: TeacherClassSessionDetailPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [{ classSessionId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const classSession = await getOwnClassSessionDetailForTeacher(classSessionId);

  if (!classSession) {
    notFound();
  }

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

  const confirmedEnrollments = classSession.enrollments.filter(
    (enrollment) => enrollment.status === "confirmed",
  );
  const pendingEnrollments = classSession.enrollments.filter(
    (enrollment) => enrollment.status === "pending",
  );
  const nextStep = getTeacherClassNextStep({
    status: classSession.status,
    origin: classSession.origin,
    pendingEnrollmentCount: pendingEnrollments.length,
    endAt: classSession.endAt,
  });
  const isOwnClass = classSession.origin === "teacher_initiated";
  const serviceTypes = getClassServiceTypes(classSession);
  const showRoster = ["open_for_enrollment", "confirmed", "completed"].includes(
    classSession.status,
  );
  const canOpen = isOwnClass && classSession.status === "draft";
  const canCancel =
    isOwnClass && ["draft", "open_for_enrollment"].includes(classSession.status);
  const canComplete = isOwnClass && classSession.status === "open_for_enrollment";

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay hover:underline"
          href="/teacher/classes"
        >
          ← 回我的課程
        </Link>
        <h1 className="mt-3 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {classSession.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
          >
            {classSessionStatusLabels[classSession.status]}
          </span>
          <span className="w-fit rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">
            {originLabels[classSession.origin] ?? classSession.origin}
          </span>
          {classSession.recurringClassSeriesId ? (
            <Link
              className="w-fit rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine transition hover:bg-pine/15"
              href={`/teacher/classes/series/${classSession.recurringClassSeriesId}`}
            >
              系列：{classSession.recurringClassSeries?.title ?? "課程系列"}
            </Link>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          {formatTaipeiDatetime(classSession.startAt)}–
          {formatTaipeiDatetime(classSession.endAt)}・{classSession.location}
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
        aria-labelledby="next-step-title"
        className={`rounded-2xl border p-5 ${nextStepToneClasses[nextStep.kind]}`}
      >
        <h2 className="text-sm font-medium" id="next-step-title">
          下一步
        </h2>
        <p className="mt-1 text-base leading-7">{nextStep.message}</p>
      </section>

      <section
        aria-labelledby="enrollment-title"
        className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium text-ink" id="enrollment-title">
            報名狀況
          </h2>
          <p className="text-sm text-ink-soft">
            已報名 {confirmedEnrollments.length} / {classSession.capacity} 人
            {pendingEnrollments.length > 0
              ? `・待確認 ${pendingEnrollments.length} 人`
              : ""}
          </p>
        </div>

        {/* 第 8 節（Gate G2/G3）：只要還有 pending 就顯示，不論課程狀態——時間邊界由 action 回傳明確錯誤。 */}
        {pendingEnrollments.length > 0 ? (
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">
              待確認報名（{pendingEnrollments.length} 人）
            </h3>
            <ul className="mt-2 grid gap-2">
              {pendingEnrollments.map((enrollment) => (
                <li
                  className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm"
                  key={enrollment.id}
                >
                  <p className="min-w-0 break-words font-medium text-ink">
                    {enrollment.user.name ?? enrollment.user.email ?? "會員"}
                  </p>
                  {enrollment.notes ? (
                    <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-ink-soft">
                      {enrollment.notes}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={confirmPendingEnrollmentAction}>
                      <input name="enrollmentId" type="hidden" value={enrollment.id} />
                      <input name="classSessionId" type="hidden" value={classSession.id} />
                      <button
                        className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-50"
                        type="submit"
                      >
                        確認報名
                      </button>
                    </form>
                    <form action={declinePendingEnrollmentAction}>
                      <input name="enrollmentId" type="hidden" value={enrollment.id} />
                      <input name="classSessionId" type="hidden" value={classSession.id} />
                      <button
                        className="rounded-full border border-ink/25 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-cream"
                        type="submit"
                      >
                        拒絕
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {showRoster ? (
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">
              已報名會員（{confirmedEnrollments.length} 人）
            </h3>
            {confirmedEnrollments.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-ink-soft">目前還沒有會員報名。</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {confirmedEnrollments.map((enrollment) => (
                  <li
                    className="min-w-0 rounded-2xl border border-ink/10 bg-cream p-3 text-sm"
                    key={enrollment.id}
                  >
                    <p className="min-w-0 break-words font-medium text-ink">
                      {enrollment.user.name ?? enrollment.user.email ?? "會員"}
                    </p>
                    {enrollment.notes ? (
                      <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-ink-soft">
                        {enrollment.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : pendingEnrollments.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">
            {classSession.status === "draft"
              ? "還沒開放報名，開放後報名名單會顯示在這裡。"
              : "這堂課目前沒有報名名單。"}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="content-title"
        className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6"
      >
        <h2 className="text-lg font-medium text-ink" id="content-title">
          課程內容
        </h2>
        <dl className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
          <DetailItem label="團體" value={classSession.organization?.name ?? "（自己開的課）"} />
          {serviceTypes.length > 0 ? (
            <DetailItem label="課程風格" value={serviceTypes.join("、")} />
          ) : null}
          {classSession.yogaStyles.length > 0 ? (
            <DetailItem label="瑜伽類型" value={classSession.yogaStyles.join("、")} />
          ) : null}
          {classSession.demandRequest?.targetLevel ? (
            <DetailItem
              label="程度"
              value={
                demandRequestTargetLevelLabels[classSession.demandRequest.targetLevel] ??
                classSession.demandRequest.targetLevel
              }
            />
          ) : null}
          <DetailItem label="開始時間" value={formatTaipeiDatetime(classSession.startAt)} />
          <DetailItem label="結束時間" value={formatTaipeiDatetime(classSession.endAt)} />
          <DetailItem label="地點" value={classSession.location} />
          <DetailItem label="名額上限" value={`${classSession.capacity} 人`} />
          <DetailItem label="公開瀏覽" value={classSession.isPublic ? "公開" : "不公開"} />
          <DetailItem
            label="報名方式"
            value={classSession.requiresApproval ? "需要我確認才算報名成功" : "送出即報名成功"}
          />
        </dl>
        {classSession.description ? (
          <p className="whitespace-pre-wrap break-words border-t border-ink/10 pt-3 text-sm leading-6 text-ink-soft">
            {classSession.description}
          </p>
        ) : null}
      </section>

      {classSession.status === "completed" ? (
        <section
          aria-labelledby="reviews-title"
          className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-6"
        >
          <h2 className="text-lg font-medium text-ink" id="reviews-title">
            學員評價（{classSession.reviews.length} 則）
          </h2>
          {classSession.reviews.length === 0 ? (
            <p className="text-sm leading-6 text-ink-soft">目前還沒有評價。</p>
          ) : (
            <ul className="grid gap-2">
              {classSession.reviews.map((review) => (
                <li
                  className="min-w-0 rounded-2xl border border-ink/10 bg-cream p-3 text-sm"
                  key={review.id}
                >
                  <p className="min-w-0 break-words font-medium text-ink">
                    {review.reviewer.name ?? review.reviewer.email ?? "會員"}・
                    {"★".repeat(review.rating)}
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

      {canOpen || canCancel || canComplete ? (
        <section
          aria-labelledby="actions-title"
          className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-6"
        >
          <h2 className="text-lg font-medium text-ink" id="actions-title">
            課程操作
          </h2>
          <div className="flex flex-wrap gap-3">
            {canOpen ? (
              <form action={openOwnClassSessionForEnrollmentAction}>
                <input name="classSessionId" type="hidden" value={classSession.id} />
                <button
                  className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
                  type="submit"
                >
                  開放報名
                </button>
              </form>
            ) : null}
            {canComplete ? (
              <form action={completeOwnClassSessionAction}>
                <input name="classSessionId" type="hidden" value={classSession.id} />
                <button
                  className="rounded-full border border-ink/25 px-4 py-2 text-sm font-medium text-ink transition hover:border-emerald-300 hover:bg-emerald-50"
                  type="submit"
                >
                  標記完成
                </button>
              </form>
            ) : null}
            {canCancel ? (
              <form action={cancelOwnClassSessionAction}>
                <input name="classSessionId" type="hidden" value={classSession.id} />
                <button
                  className="rounded-full border border-amber-200 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
                  type="submit"
                >
                  取消課程
                </button>
              </form>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-ink-faint">
            課程內容建立後目前無法修改；需要調整的話，請取消後重新建立。
          </p>
        </section>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-medium text-ink">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
