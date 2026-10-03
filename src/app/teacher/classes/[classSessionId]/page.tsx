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

import { ConfirmActionDialog } from "../_components/ConfirmActionDialog";
import { PendingSubmitButton } from "../_components/PendingSubmitButton";
import {
  parseReturnContext,
  returnContextParams,
  teacherClassBackLink,
} from "../_lib/return-context";
import {
  cancelOwnClassSessionAction,
  completeOwnClassSessionAction,
  confirmPendingEnrollmentAction,
  declinePendingEnrollmentAction,
  openOwnClassSessionForEnrollmentAction,
} from "../actions";

type TeacherClassSessionDetailPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{
    result?: string;
    message?: string;
    from?: string;
    tab?: string;
    status?: string;
    series?: string;
  }>;
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

const primaryButtonClassName =
  "min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep";
const secondaryButtonClassName =
  "min-h-11 rounded-full border border-ink/25 bg-white px-5 py-2 text-sm font-medium text-ink transition hover:border-ink/40";

// teacher-usability 第 06 票：老師的單堂課詳情頁。
// teacher-usability-redesign 票 03：頂端「課程重點」放時間、地點、狀態、人數與下一步，下一步的操作就在旁邊；
// 草稿先看課程內容、開放後先看報名名單；取消放在最下方獨立區塊，按下後先在確認視窗說清楚影響才執行。
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
  // 票 04：從列表／系列進來時記得從哪裡來；系列只接受這堂課自己的系列。操作表單也帶著，做完仍保留。
  const returnContext = parseReturnContext(
    resolvedSearchParams ?? {},
    classSession.recurringClassSeriesId,
  );
  const returnFields = Object.fromEntries(returnContextParams(returnContext));
  const returnInputs = Object.entries(returnFields).map(([name, value]) => (
    <input key={name} name={name} type="hidden" value={value} />
  ));
  const backLink = teacherClassBackLink(returnContext, classSession.id);
  const timeText = `${formatTaipeiDatetime(classSession.startAt)}–${formatTaipeiDatetime(classSession.endAt)}`;

  const contentSection = (
    <section
      aria-labelledby="content-title"
      className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
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
        <DetailItem label="名額上限" value={`${classSession.capacity} 人`} />
        <DetailItem
          label="公開列表"
          value={classSession.isPublic ? "列在公開課程列表" : "不列在公開課程列表"}
        />
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
      {isOwnClass ? (
        <p className="text-xs leading-5 text-ink-faint">
          課程內容建立後目前無法修改；需要調整的話，請取消後重新建立。
        </p>
      ) : null}
    </section>
  );

  const enrollmentSection = (
    <section
      aria-labelledby="enrollment-title"
      className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-ink" id="enrollment-title">
          報名狀況
        </h2>
        <p className="text-sm text-ink-soft">
          已報名 {confirmedEnrollments.length} / {classSession.capacity} 人
          {pendingEnrollments.length > 0 ? `・待確認 ${pendingEnrollments.length} 人` : ""}
        </p>
      </div>

      {/* 第 8 節（Gate G2/G3）：只要還有 pending 就顯示，不論課程狀態——時間邊界由 action 回傳明確錯誤。 */}
      {pendingEnrollments.length > 0 ? (
        <div className="min-w-0 scroll-mt-6" id="pending-enrollments">
          <h3 className="text-sm font-medium text-ink">
            待確認報名（{pendingEnrollments.length} 人）
          </h3>
          <ul className="mt-2 grid gap-2">
            {pendingEnrollments.map((enrollment) => {
              const memberName = enrollment.user.name ?? enrollment.user.email ?? "會員";

              return (
                <li
                  className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm"
                  key={enrollment.id}
                >
                  <p className="min-w-0 break-words font-medium text-ink">{memberName}</p>
                  {enrollment.notes ? (
                    <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-ink-soft">
                      {enrollment.notes}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={confirmPendingEnrollmentAction}>
                      <input name="enrollmentId" type="hidden" value={enrollment.id} />
                      <input name="classSessionId" type="hidden" value={classSession.id} />
                      {returnInputs}
                      <PendingSubmitButton className="min-h-11 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50">
                        確認報名
                      </PendingSubmitButton>
                    </form>
                    <ConfirmActionDialog
                      action={declinePendingEnrollmentAction}
                      confirmLabel="確定婉拒"
                      hiddenFields={{
                        enrollmentId: enrollment.id,
                        classSessionId: classSession.id,
                        ...returnFields,
                      }}
                      title="婉拒這筆報名？"
                      triggerAriaLabel={`婉拒 ${memberName} 的報名`}
                      triggerClassName="min-h-11 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-cream"
                      triggerLabel="婉拒"
                    >
                      <p>
                        學員：<span className="break-words font-medium text-ink">{memberName}</span>
                      </p>
                      <p>
                        課程：<span className="break-words text-ink">{classSession.title}</span>（{timeText}）
                      </p>
                      <p>婉拒後這筆報名會取消，學員會收到通知；之後無法再恢復這筆報名。</p>
                    </ConfirmActionDialog>
                  </div>
                </li>
              );
            })}
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
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:underline"
          href={backLink.href}
        >
          {backLink.label}
        </Link>
        <h1 className="mt-1 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
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
              className="inline-flex min-h-11 w-fit items-center rounded-full bg-pine-tint px-4 text-xs font-medium text-pine transition hover:bg-pine/15"
              href={`/teacher/classes/series/${classSession.recurringClassSeriesId}`}
            >
              系列：{classSession.recurringClassSeries?.title ?? "課程系列"}
            </Link>
          ) : null}
        </div>
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
        aria-labelledby="overview-title"
        className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
      >
        <h2 className="sr-only" id="overview-title">
          課程重點
        </h2>
        <dl className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
          <DetailItem label="時間" value={timeText} />
          <DetailItem label="地點" value={classSession.location} />
          <DetailItem
            label="已報名"
            value={`${confirmedEnrollments.length} / ${classSession.capacity} 人`}
          />
          <DetailItem label="待確認" value={`${pendingEnrollments.length} 人`} />
        </dl>
        <section
          aria-labelledby="next-step-title"
          className={`grid gap-3 rounded-xl border p-4 ${nextStepToneClasses[nextStep.kind]}`}
        >
          <div>
            <h3 className="text-sm font-medium" id="next-step-title">
              下一步
            </h3>
            <p className="mt-1 text-base leading-7">{nextStep.message}</p>
          </div>
          {canOpen || canComplete || pendingEnrollments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {canOpen ? (
                <form action={openOwnClassSessionForEnrollmentAction}>
                  <input name="classSessionId" type="hidden" value={classSession.id} />
                  {returnInputs}
                  <PendingSubmitButton className={primaryButtonClassName}>
                    開放報名
                  </PendingSubmitButton>
                </form>
              ) : null}
              {pendingEnrollments.length > 0 ? (
                <a className={`inline-flex items-center ${primaryButtonClassName}`} href="#pending-enrollments">
                  前往確認報名
                </a>
              ) : null}
              {canComplete ? (
                <form action={completeOwnClassSessionAction}>
                  <input name="classSessionId" type="hidden" value={classSession.id} />
                  {returnInputs}
                  <PendingSubmitButton className={secondaryButtonClassName}>
                    標記完成
                  </PendingSubmitButton>
                </form>
              ) : null}
            </div>
          ) : null}
          {canOpen ? (
            <p className="text-xs leading-5">
              開放報名不會改變公開列表設定：這堂課
              {classSession.isPublic ? "會列在公開課程列表" : "不會列在公開課程列表，學員要有課程連結才能報名"}。
            </p>
          ) : null}
        </section>
      </section>

      {/* 草稿先核對課程內容；開放後先看報名名單。 */}
      {classSession.status === "draft" ? (
        <>
          {contentSection}
          {enrollmentSection}
        </>
      ) : (
        <>
          {enrollmentSection}
          {contentSection}
        </>
      )}

      {classSession.status === "completed" ? (
        <section
          aria-labelledby="reviews-title"
          className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
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

      {canCancel ? (
        <section
          aria-labelledby="cancel-title"
          className="grid gap-3 rounded-2xl border border-ink/10 p-5 sm:p-6"
        >
          <h2 className="text-base font-medium text-ink" id="cancel-title">
            取消這堂課
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            取消後這堂課不能再開放報名，已報名與待確認的報名會一起取消。
          </p>
          <div>
            <ConfirmActionDialog
              action={cancelOwnClassSessionAction}
              confirmLabel="確定取消課程"
              hiddenFields={{ classSessionId: classSession.id, ...returnFields }}
              title="取消這堂課？"
              triggerClassName="min-h-11 rounded-full border border-clay/40 px-5 py-2 text-sm font-medium text-clay transition hover:bg-clay-tint"
              triggerLabel="取消課程"
            >
              <p>
                課程：<span className="break-words font-medium text-ink">{classSession.title}</span>
              </p>
              <p>時間：{timeText}</p>
              <p>
                {confirmedEnrollments.length + pendingEnrollments.length > 0
                  ? `目前已報名 ${confirmedEnrollments.length} 人、待確認 ${pendingEnrollments.length} 人；取消後這些報名都會一起取消，學員會收到通知。`
                  : "目前沒有人報名。"}
              </p>
              <p>取消後無法復原，這堂課也不能再開放報名。</p>
            </ConfirmActionDialog>
          </div>
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
