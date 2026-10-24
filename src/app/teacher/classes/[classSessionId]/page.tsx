import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import {
  getOwnClassSessionDetailForTeacher,
  getOwnRecurringClassSeriesDetailForTeacher,
} from "@/domain/class-session/read-service";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { buildShareTemplates } from "@/domain/class-session/share-templates";
import { getTeacherClassNextStep } from "@/domain/class-session/teacher-next-step";
import { effectiveCoverUrl } from "@/domain/teacher-photo/display";
import { getOwnPaymentInfoReminder } from "@/domain/teacher-profile/payment-settings";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { classActionPhase, getClassActionSlots, type ClassActionKey } from "@/domain/class-session/class-action-slots";
import { getSeriesBadgeInfo, seriesBadgeLabel } from "@/domain/class-session/series-badge";
import { requireUser } from "@/lib/auth/session";

import { ActionBar, InfoTip } from "../../../_components/ActionBar";
import {
  CancelFromHereDialog,
  occurrencesFromHere,
} from "../_components/CancelFromHereDialog";
import { ConfirmActionDialog } from "../_components/ConfirmActionDialog";
import { CopyEnrollLinkButton } from "../_components/CopyEnrollLinkButton";
import {
  PaymentActionButton,
  PaymentDetailLines,
  PaymentInline,
  RosterRow,
  SingleEnrollmentTag,
} from "../_components/EnrollmentPaymentControls";
import { PaymentInfoReminderNotice } from "../_components/PaymentInfoReminderNotice";
import { PendingSubmitButton } from "../_components/PendingSubmitButton";
import { ShareTemplates } from "../_components/ShareTemplates";
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
  organizer_direct: "團主合作開課",
};

const nextStepToneClasses = {
  action: "border-gold/30 bg-gold-tint text-gold-deep",
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
  const [{ classSessionId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  // organizer-usability-redesign 票 12：通知直達這一頁；未登入時登入後回到同一堂課。
  try {
    await requireUser();
  } catch {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/teacher/classes/${classSessionId}`)}`);
  }

  const [classSession, teacherProfile, paymentReminder] = await Promise.all([
    getOwnClassSessionDetailForTeacher(classSessionId),
    getOwnTeacherProfileApplicationSnapshot(),
    getOwnPaymentInfoReminder(),
  ]);

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
  // lightweight-payment-v0（P9）：已付款後被取消的報名仍要讓老師看得到，才能標記退款。
  const cancelledWithPayment = classSession.enrollments.filter(
    (enrollment) => enrollment.status === "cancelled" && enrollment.paymentStatus !== "unpaid",
  );
  // teacher-class-scheduling 票 10：期班的場次，名單標示整期或單堂。
  // teacher-series-rollup 票 02（spec 2.4）：頁首已標明期班，整期學員不加標籤；只有「整期和單堂都收」的期班，單堂報名的學員加「單堂」。
  const showSingleTag =
    classSession.recurringClassSeries?.kind === "term" && classSession.recurringClassSeries.termEnrollmentMode === "term_and_single";
  const nextStep = getTeacherClassNextStep({
    status: classSession.status,
    origin: classSession.origin,
    pendingEnrollmentCount: pendingEnrollments.length,
    endAt: classSession.endAt,
  });
  const isOwnClass = classSession.origin === "teacher_initiated";
  const shareTemplates = buildShareTemplates({
    title: classSession.title,
    startAt: classSession.startAt,
    endAt: classSession.endAt,
    location: classSession.location,
    priceNote: classSession.priceNote,
    suitableFor: classSession.suitableFor,
    preparationNotes: classSession.preparationNotes,
    requiresApproval: classSession.requiresApproval,
    isPublic: classSession.isPublic,
    teacherName: teacherProfile?.displayName ?? null,
    isSeries: classSession.recurringClassSeriesId !== null,
  });
  // 系列場次顯示系列的封面（teacher-showcase-photos 票 04、05）。
  const coverUrl = effectiveCoverUrl(classSession);
  const serviceTypes = getClassServiceTypes(classSession);
  const showRoster = ["open_for_enrollment", "confirmed", "completed"].includes(
    classSession.status,
  );
  const canOpen = isOwnClass && classSession.status === "draft";
  const canCancel =
    isOwnClass && ["draft", "open_for_enrollment"].includes(classSession.status);
  const canComplete = isOwnClass && classSession.status === "open_for_enrollment";
  // teacher-class-scheduling 票 04：可以改課的條件（與 domain 鎖內檢查一致；真正的檢查在 server）。
  const canEdit =
    isOwnClass &&
    teacherProfile?.status === "approved" &&
    ["draft", "open_for_enrollment"].includes(classSession.status) &&
    classSession.startAt.getTime() > new Date().getTime();
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
  // teacher-my-calendar spec 2.4：修改課程也帶著返回參數，存檔回來仍回到原本的列表或月曆。
  const returnQuery = Object.keys(returnFields).length > 0 ? `?${new URLSearchParams(returnFields).toString()}` : "";
  const timeText = `${formatTaipeiDatetime(classSession.startAt)}–${formatTaipeiDatetime(classSession.endAt)}`;
  // teacher-class-scheduling 票 03：系列中的場次可以「從這場以後全部取消」，需要列出之後的場次。
  const series =
    canCancel && classSession.recurringClassSeriesId
      ? await getOwnRecurringClassSeriesDetailForTeacher(classSession.recurringClassSeriesId)
      : null;
  const cancelFromHere = series
    ? occurrencesFromHere(series.occurrences, classSession, new Date().getTime())
    : [];

  // teacher-series-rollup 票 02（spec 2.2）：依狀態挑兩顆常駐按鈕，其餘攤開或收進「更多」。
  // 可用條件沿用原本的判斷（只對自己開的課開放、取消、完成；改課條件同 domain）；真正的檢查在 server。
  const seriesBadge = classSession.recurringClassSeriesId ? await getSeriesBadgeInfo(classSession.id) : null;
  const phase = classActionPhase(classSession);
  const notStarted = classSession.startAt.getTime() > new Date().getTime();
  const available: ClassActionKey[] = [
    ...(canOpen ? (["open"] as const) : []),
    ...(canEdit ? (["edit"] as const) : []),
    ...(classSession.status === "open_for_enrollment" ? (["copyLink"] as const) : []),
    ...(canCancel && notStarted ? (["cancel"] as const) : []),
    ...(canComplete && phase === "ended_awaiting_completion" ? (["complete"] as const) : []),
    ...(canCancel && notStarted && series && cancelFromHere.length > 1 ? (["cancelFromHere"] as const) : []),
  ];
  const slots = getClassActionSlots({ phase, available });
  const actionNode = (key: ClassActionKey, place: "primary" | "secondary" | "rest") => {
    const filled = place === "primary";

    switch (key) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1">
            <form action={openOwnClassSessionForEnrollmentAction}>
              <input name="classSessionId" type="hidden" value={classSession.id} />
              {returnInputs}
              <PendingSubmitButton className={filled ? primaryButtonClassName : secondaryButtonClassName}>開放報名</PendingSubmitButton>
            </form>
            <InfoTip label="開放報名的說明">
              開放報名不會改變公開列表設定：這堂課
              {classSession.isPublic ? "會列在公開課程列表" : "不會列在公開課程列表，學員要有課程連結才能報名"}。
            </InfoTip>
          </span>
        );
      case "edit":
        return (
          <a className={`inline-flex items-center ${filled ? primaryButtonClassName : secondaryButtonClassName}`} href={`/teacher/classes/${classSession.id}/edit${returnQuery}`}>
            修改課程
          </a>
        );
      case "copyLink":
        return (
          <span className="inline-flex items-start gap-1">
            <CopyEnrollLinkButton
              classSessionId={classSession.id}
              className={filled ? primaryButtonClassName : "min-h-11 rounded-full border border-pine/40 bg-white px-4 py-2 text-sm font-medium text-pine transition hover:bg-pine-tint"}
            />
            <InfoTip label="報名連結的說明">
              {classSession.isPublic
                ? "這堂課也列在公開課程列表；想直接邀請學員，可以把報名連結傳給他們。"
                : "這堂課不在公開課程列表，請把報名連結傳給學員。學員需要先登入飛索帳號，才能打開連結並報名。"}
            </InfoTip>
          </span>
        );
      case "complete":
        return (
          <form action={completeOwnClassSessionAction}>
            <input name="classSessionId" type="hidden" value={classSession.id} />
            {returnInputs}
            <PendingSubmitButton className={filled ? primaryButtonClassName : secondaryButtonClassName}>標記完成</PendingSubmitButton>
          </form>
        );
      case "cancel":
        return (
          <ConfirmActionDialog
            action={cancelOwnClassSessionAction}
            confirmLabel="確定取消課程"
            hiddenFields={{ classSessionId: classSession.id, ...returnFields }}
            title="取消這堂課？"
            triggerClassName="min-h-11 rounded-full border border-gold/40 bg-white px-5 py-2 text-sm font-medium text-gold transition hover:bg-gold-tint"
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
        );
      case "cancelFromHere":
        return series ? (
          <CancelFromHereDialog
            affected={cancelFromHere}
            canGenerateMore={series.dayOfWeek !== null}
            fromClassSessionId={classSession.id}
            recurringClassSeriesId={series.id}
            seriesTitle={series.title}
          />
        ) : null;
    }
  };

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
          value={classSession.isPublic ? "列在公開課程列表" : "僅透過連結招募"}
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
      <div className="border-t border-ink/10 pt-3 text-sm leading-6">
        <p className="font-medium text-ink">課程封面</p>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="目前的課程封面" className="mt-2 aspect-[3/2] w-full max-w-xs rounded-xl bg-cream object-cover" src={coverUrl} />
        ) : (
          <p className="mt-1 text-ink-soft">還沒設定封面，學員會看到品牌色塊。要設定請到「修改課程」。</p>
        )}
      </div>
      {/* member-flow 票 03／04：學員會在課程頁看到這兩段；單堂與系列場次都可以填。 */}
      {[
        { label: "適合對象", value: classSession.suitableFor },
        { label: "準備事項", value: classSession.preparationNotes },
        { label: "價格說明", value: classSession.priceNote },
      ].map((item) => (
        <div className="border-t border-ink/10 pt-3 text-sm leading-6" key={item.label}>
          <p className="font-medium text-ink">{item.label}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">
            {item.value || "未填寫，學員頁面不顯示這一項。"}
          </p>
        </div>
      ))}

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
                <RosterRow
                  action={
                    enrollment.seriesEnrollmentId ? null : (
                      <>
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
                      </>
                    )
                  }
                  inline={showSingleTag && !enrollment.seriesEnrollmentId ? <SingleEnrollmentTag /> : null}
                  key={enrollment.id}
                  title={memberName}
                  tone="pending"
                >
                  <PaymentDetailLines paymentNote={null} paymentStatus="unpaid" refundReason={null} studentNotes={enrollment.notes} />
                  {enrollment.seriesEnrollmentId && classSession.recurringClassSeriesId ? (
                    <p className="mt-2 text-ink-soft">
                      整期報名要一次確認或婉拒：
                      <Link
                        className="ml-1 font-medium text-pine underline"
                        href={`/teacher/classes/series/${classSession.recurringClassSeriesId}#term-enrollments`}
                      >
                        到期班頁處理
                      </Link>
                    </p>
                  ) : null}
                </RosterRow>
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
              {confirmedEnrollments.map((enrollment) => {
                const memberName = enrollment.user.name ?? enrollment.user.email ?? "會員";

                return (
                  <RosterRow
                    action={
                      <PaymentActionButton
                        classSessionId={classSession.id}
                        enrollmentId={enrollment.id}
                        enrollmentStatus={enrollment.status}
                        hiddenReturnFields={returnFields}
                        memberName={memberName}
                        paymentStatus={enrollment.paymentStatus}
                      />
                    }
                    inline={
                      <>
                        {showSingleTag && !enrollment.seriesEnrollmentId ? <SingleEnrollmentTag /> : null}
                        <PaymentInline paymentStatus={enrollment.paymentStatus} transferNote={enrollment.transferNote} />
                      </>
                    }
                    key={enrollment.id}
                    title={memberName}
                  >
                    <PaymentDetailLines
                      paymentNote={enrollment.paymentNote}
                      paymentStatus={enrollment.paymentStatus}
                      refundReason={enrollment.paymentRefundReason}
                      studentNotes={enrollment.notes}
                    />
                  </RosterRow>
                );
              })}
            </ul>
          )}
          {cancelledWithPayment.length > 0 ? (
            <div className="mt-4" id="cancelled-payments">
              <h3 className="text-sm font-medium text-ink">
                已取消但有付款紀錄（{cancelledWithPayment.length} 人）
              </h3>
              <p className="mt-1 text-xs leading-5 text-ink-faint">
                這些報名已取消。若你已收款，請退款後在這裡標記已退款，學員才看得到最終結果。
              </p>
              <ul className="mt-2 grid gap-2">
                {cancelledWithPayment.map((enrollment) => {
                  const memberName = enrollment.user.name ?? enrollment.user.email ?? "會員";

                  return (
                    <RosterRow
                      action={
                        <PaymentActionButton
                          classSessionId={classSession.id}
                          enrollmentId={enrollment.id}
                          enrollmentStatus={enrollment.status}
                          hiddenReturnFields={returnFields}
                          memberName={memberName}
                          paymentStatus={enrollment.paymentStatus}
                        />
                      }
                      inline={<PaymentInline cancelled paymentStatus={enrollment.paymentStatus} transferNote={enrollment.transferNote} />}
                      key={enrollment.id}
                      title={memberName}
                    >
                      <PaymentDetailLines paymentNote={enrollment.paymentNote} paymentStatus={enrollment.paymentStatus} refundReason={enrollment.paymentRefundReason} />
                    </RosterRow>
                  );
                })}
              </ul>
            </div>
          ) : null}
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
      <header className="grid gap-3 border-b border-ink/15 pb-6">
        <Link
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-gold hover:underline"
          href={backLink.href}
        >
          {backLink.label}
        </Link>
        <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {classSession.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* teacher-series-rollup 票 02（spec 2.3）：明確標出期班第幾堂或持續開課，點了到系列頁。 */}
          {seriesBadge ? (
            <Link
              className="inline-flex min-h-11 w-fit items-center rounded-full bg-pine-tint px-4 text-sm font-medium text-pine-deep transition hover:bg-pine/15"
              href={`/teacher/classes/series/${seriesBadge.seriesId}`}
            >
              {seriesBadgeLabel(seriesBadge)}
            </Link>
          ) : null}
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
          >
            {classSessionStatusLabels[classSession.status]}
          </span>
          <span className="w-fit rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">
            {originLabels[classSession.origin] ?? classSession.origin}
          </span>
        </div>
        {/* teacher-first-run 票 03：能按「開放報名」時，在按鈕那一排之前（按下之前）提醒缺少的收款資訊。 */}
        {canOpen ? <PaymentInfoReminderNotice reminder={paymentReminder} /> : null}
        {/* teacher-series-rollup 票 02（spec 2.2）：按鈕集中在這一排，說明放進確認視窗或「ⓘ」。 */}
        <ActionBar
          primary={slots.primary ? actionNode(slots.primary, "primary") : null}
          rest={slots.rest.map((key) => ({ key, node: actionNode(key, "rest") }))}
          secondary={slots.secondary ? actionNode(slots.secondary, "secondary") : null}
        />
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
        {/* 下一步只留一行狀態說明；有人待確認時直接連到名單。 */}
        <section aria-label="下一步" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm leading-6 ${nextStepToneClasses[nextStep.kind]}`}>
          <p>
            <span className="font-medium">下一步：</span>
            {nextStep.message}
          </p>
          {pendingEnrollments.length > 0 ? (
            <a className="font-medium underline" href="#pending-enrollments">
              前往確認報名
            </a>
          ) : null}
        </section>
        {/* teacher-showcase-photos 票 08：分享文案收在這裡，需要時才展開。 */}
        {classSession.status === "open_for_enrollment" ? (
          <details className="rounded-xl border border-ink/10 px-4 py-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink" id="share-templates-title">
              分享文案（可以直接複製，也可以先改幾個字）
            </summary>
            <div className="pb-2">
              <ShareTemplates
                enrollPath={`/classes/${classSession.id}`}
                templates={Object.entries(shareTemplates).map(([key, template]) => ({ key, ...template }))}
              />
            </div>
          </details>
        ) : null}
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
