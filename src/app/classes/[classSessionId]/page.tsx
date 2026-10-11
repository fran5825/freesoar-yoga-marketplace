import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClassSessionForMember, type MemberFacingClassSession } from "@/domain/enrollment/read-service";
import {
  getClassSeriesContext,
  getTermDetailForViewer,
  listVisibleSiblingSessions,
} from "@/domain/enrollment/term-read-service";
import { formatTaipeiDatetime, formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { getSeriesBadgeInfo, seriesBadgeLabel } from "@/domain/class-session/series-badge";
import { loadEnrollRows } from "@/domain/enrollment/session-enroll-rows";
import { getPublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { getClassAvailability } from "@/domain/class-session/availability";
import { SERIES_SHOW_MAX, isPublicSeriesPageAvailable } from "@/domain/class-session/public-read-service";
import { getCurrentUser } from "@/lib/auth/session";
import { classDetailHref, classReturnLabel, safeClassReturnPath, seriesDetailHref, termDetailHref } from "@/lib/navigation/class-return-path";
import { SiteShell } from "../../_components/site-shell";
import { ClassAvailabilityBadge } from "../_components/ClassAvailabilityBadge";
import { DetailCover } from "../_components/ClassCover";
import { ClassOriginTag } from "../_components/ClassOriginTag";
import { ClassSummary } from "../_components/ClassSummary";
import { ClassCardEnroll } from "../_components/ClassCardEnroll";
import { EnrollRow, readRowFeedback } from "../_components/EnrollRow";
import { ClassOwnEnrollmentActions, ClassOwnEnrollmentStatus } from "../_components/ClassOwnEnrollment";
import { ScrollToTarget } from "../../_components/ScrollToTarget";
import { ClassSignInGuide } from "../_components/ClassSignInGuide";
import { ClassInfoSections } from "../_components/ClassInfoSections";

export default async function MemberClassSessionPage({ params, searchParams }: {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string; returnTo?: string; enroll?: string; open?: string; focus?: string }>;
}) {
  const [{ classSessionId }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  // 保留 Visitor / Member 各自既有的可見性與權限查詢條件。
  const classSession = user ? await getClassSessionForMember(classSessionId) : await getPublicClassSessionDetail(classSessionId);
  const returnTo = safeClassReturnPath(query?.returnTo);
  // organizer-usability-redesign 票 13：訪客讀不到（不存在、草稿、僅透過連結招募等）一律顯示同一個
  // 登入引導，不回 not-found，也不透露是哪一種；已登入仍依既有 Member 規則，讀不到就 not-found。
  if (!classSession && !user) {
    return (
      <SiteShell signedInArea="member" publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8" signedInClassName="flex flex-col gap-6">
        <ClassSignInGuide classSessionId={classSessionId} returnTo={returnTo} />
      </SiteShell>
    );
  }
  if (!classSession) notFound();
  // teacher-class-scheduling 票 14（Q1、Q9）：只收整期的期班，看得到這一堂但還沒報名的人直接轉到期班頁。
  // 只在看得到這一堂時才轉；訪客讀不到時仍是上面的通用登入引導，不透露這一堂屬於哪個期班。
  // 已登入時 ownEnrollment 已隨課程讀出（任何狀態都算已報名）；訪客一定還沒報名。
  const ownEnrollment = "ownEnrollment" in classSession ? classSession.ownEnrollment : null;
  const seriesContext = await getClassSeriesContext(classSession.id);
  const term = seriesContext?.term ?? null;
  if (term?.termEnrollmentMode === "term_only" && !ownEnrollment) redirect(returnTo.startsWith(`/classes/terms/${term.id}`) ? returnTo : termDetailHref(term.id, returnTo));
  // inline-member-enroll 票 08：同系列列表上的操作結果指向那一列（focus=session-row-…），其餘是這一堂自己的結果。
  const rowFeedback = readRowFeedback(query);
  const rowRelated = Boolean(rowFeedback?.focus?.startsWith("session-row-"));
  const feedback = rowFeedback?.message ? { success: rowFeedback.success, message: rowFeedback.message } : null;
  const [siblings, termDetail, badge] = await Promise.all([
    seriesContext ? listVisibleSiblingSessions(classSession.id, Boolean(user), user?.id ?? null) : Promise.resolve([]),
    term ? getTermDetailForViewer(term.id, user?.id ?? null) : Promise.resolve(null),
    seriesContext ? getSeriesBadgeInfo(classSession.id) : Promise.resolve(null),
  ]);
  const siblingRows = await loadEnrollRows(siblings.map((sibling) => sibling.id), user?.id ?? null);
  // 票 14（Q2）：屬於期班、還沒報名這一堂時，用合併後的期班報名區（「我要報名」展開、二選一）。
  const useTermPanel = Boolean(term) && !ownEnrollment;
  const termPeriod =
    termDetail?.firstStartAt && termDetail.lastStartAt
      ? `${shortDate(termDetail.firstStartAt)} – ${shortDate(termDetail.lastStartAt)}（共 ${termDetail.totalCount} 堂）`
      : null;
  const canEnroll = classSession.canAcceptNewEnrollments && !ownEnrollment;
  const openForm = query?.enroll === "1" || (feedback !== null && !feedback.success && !rowRelated);
  const detailHref = classDetailHref(classSession.id, returnTo);
  // inline-member-actions 票 03（spec I8）：持續開課且系列頁看得到時，「同系列的其他場次」整張卡改成第一張卡裡的連結。
  // 只有這位使用者看得到的其他場次全部公開、連同這一堂沒超過系列頁上限時才換（否則會有日期失去入口），條件與系列頁一致。
  const seriesLink =
    seriesContext?.kind === "continuous" &&
    siblings.length > 0 &&
    siblings.every((sibling) => sibling.isPublic) &&
    siblings.length + 1 <= SERIES_SHOW_MAX &&
    (await isPublicSeriesPageAvailable(seriesContext.seriesId))
      ? `/classes/series/${seriesContext.seriesId}`
      : null;
  // 已登入時 classSession 來自 getClassSessionForMember（含自己的報名與就地操作資料）。
  const memberSession = user ? (classSession as MemberFacingClassSession) : null;
  // 票 08（spec Q4）：已報名時卡片頂端是自己的狀態；沒報名時是報名區（「我要報名」在這張卡內展開）。
  const ownStatusSlot = memberSession?.ownEnrollment ? (
    <ClassOwnEnrollmentStatus classSession={memberSession} />
  ) : (
    <ClassCardEnroll
      classSession={classSession}
      openForm={openForm}
      returnTo={returnTo}
      signedIn={Boolean(user)}
      term={useTermPanel ? term : null}
      termDetail={termDetail}
    />
  );
  // 標題旁的系列標籤：期班連到期班頁；持續開課在系列頁看得到時才連過去。
  const badgeHref = !badge
    ? null
    : badge.kind === "term"
      ? termDetailHref(badge.seriesId, returnTo)
      : (await isPublicSeriesPageAvailable(badge.seriesId))
        ? seriesDetailHref(badge.seriesId, returnTo)
        : null;
  const summaryActions =
    memberSession?.ownEnrollment || seriesLink ? (
      <>
        {memberSession?.ownEnrollment ? <ClassOwnEnrollmentActions classSession={memberSession} detailHref={detailHref} returnTo={returnTo} /> : null}
        {seriesLink ? <Link className="w-fit py-2 text-sm font-medium text-clay underline" href={seriesLink}>查看這個課程的所有日期</Link> : null}
      </>
    ) : null;
  const enrollHref = `${detailHref}${detailHref.includes("?") ? "&" : "?"}enroll=1#enroll`;
  const availability = getClassAvailability(classSession);
  return (
    <SiteShell signedInArea="member" publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8" signedInClassName="flex flex-col gap-6">
      <div className={canEnroll ? "group grid min-w-0 gap-6 pb-24 sm:pb-0" : "grid min-w-0 gap-6"}>
        <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>{classReturnLabel(returnTo)}</Link>
        <DetailCover url={classSession.coverUrl} />
        <header className="border-b border-ink/15 pb-5">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink">{classSession.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {badge ? (
              badgeHref ? (
                <Link className="inline-flex min-h-8 items-center rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep hover:bg-pine/15" href={badgeHref}>{seriesBadgeLabel(badge)}</Link>
              ) : (
                <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">{seriesBadgeLabel(badge)}</span>
              )
            ) : null}
            <ClassOriginTag origin={classSession.origin} />
            <ClassAvailabilityBadge availability={availability} canAcceptNewEnrollments={classSession.canAcceptNewEnrollments} />
          </div>
        </header>
        {feedback && !(rowRelated && !rowFeedback?.success && rowFeedback?.open === rowFeedback?.focus) ? <section aria-live="polite" id="action-feedback" className={feedback.success ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"}>{feedback.message}{feedback.success ? <> <Link className="font-medium underline" href="/member/enrollments">查看我的報名</Link></> : null}</section> : null}
        <ScrollToTarget targetId={query?.focus} />
        <ClassSummary actionsSlot={summaryActions} classSession={classSession} id="enroll" statusSlot={ownStatusSlot} termPeriod={termPeriod} />
        {/* 票 14（Q6）：課程說明、適合對象、準備事項有填才顯示（取代學員流程票 03 的「尚未提供」）。 */}
        <ClassInfoSections
          description={classSession.description}
          paymentRulesText={classSession.paymentRulesText}
          preparationNotes={classSession.preparationNotes}
          priceNote={classSession.priceNote}
          suitableFor={classSession.suitableFor}
        />
        {/* teacher-class-scheduling 票 12：同系列其他尚未開始、學員看得到的場次。 */}
        {siblings.length > 0 && !seriesLink ? (
          <section aria-labelledby="sibling-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
            <h2 id="sibling-heading" className="text-lg font-medium text-ink">同系列的其他場次</h2>
            <ul aria-label="同系列的其他場次" className="mt-3 grid gap-2">
              {siblings.map((sibling) => {
                const row = siblingRows.get(sibling.id);
                const main = (
                  <Link className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:underline" href={classDetailHref(sibling.id, returnTo)}>
                    {formatTaipeiDatetime(sibling.startAt)}
                  </Link>
                );

                // inline-member-enroll 票 08：每一列用共用場次列，報名、取消報名、整期請假都在列上完成。
                return row ? <EnrollRow feedback={rowFeedback} key={sibling.id} main={main} returnTo={detailHref} row={row} signedIn={Boolean(user)} /> : null;
              })}
            </ul>
          </section>
        ) : null}
        {canEnroll ? <a href={enrollHref} className="fixed inset-x-0 bottom-0 z-20 border-t border-pine/20 bg-cream px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-pine underline focus-visible:outline-2 focus-visible:outline-pine group-has-[form:focus-within]:hidden sm:hidden">{useTermPanel ? "我要報名" : "前往報名"}</a> : null}
      </div>
    </SiteShell>
  );
}

// 「10/07（二）19:00」→「10/07（二）」。
function shortDate(date: Date): string {
  return formatTaipeiShortDatetime(date).replace(/\d{2}:\d{2}$/, "");
}
