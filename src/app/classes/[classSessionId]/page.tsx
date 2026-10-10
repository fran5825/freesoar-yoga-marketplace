import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClassSessionForMember } from "@/domain/enrollment/read-service";
import {
  getClassSeriesContext,
  getTermDetailForViewer,
  listVisibleSiblingSessions,
} from "@/domain/enrollment/term-read-service";
import { formatTaipeiDatetime, formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { getPublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { getClassAvailability } from "@/domain/class-session/availability";
import { getCurrentUser } from "@/lib/auth/session";
import { classDetailHref, classReturnLabel, safeClassReturnPath, termDetailHref } from "@/lib/navigation/class-return-path";
import { SiteShell } from "../../_components/site-shell";
import { ClassAvailabilityBadge } from "../_components/ClassAvailabilityBadge";
import { DetailCover } from "../_components/ClassCover";
import { ClassOriginTag } from "../_components/ClassOriginTag";
import { ClassSummary } from "../_components/ClassSummary";
import { ClassEnrollmentPanel } from "../_components/ClassEnrollmentPanel";
import { ClassSignInGuide } from "../_components/ClassSignInGuide";
import { ClassInfoSections } from "../_components/ClassInfoSections";
import { TermClassEnrollPanel } from "../_components/TermClassEnrollPanel";

export default async function MemberClassSessionPage({ params, searchParams }: {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string; returnTo?: string; enroll?: string }>;
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
  const feedback = query?.result && query.message ? { success: query.result === "success", message: query.message } : null;
  const [siblings, termDetail] = await Promise.all([
    seriesContext ? listVisibleSiblingSessions(classSession.id, Boolean(user)) : Promise.resolve([]),
    term ? getTermDetailForViewer(term.id, user?.id ?? null) : Promise.resolve(null),
  ]);
  // 票 14（Q2）：屬於期班、還沒報名這一堂時，用合併後的期班報名區（「我要報名」展開、二選一）。
  const useTermPanel = Boolean(term) && !ownEnrollment;
  const termPeriod =
    termDetail?.firstStartAt && termDetail.lastStartAt
      ? `${shortDate(termDetail.firstStartAt)} – ${shortDate(termDetail.lastStartAt)}（共 ${termDetail.totalCount} 堂）`
      : null;
  const canEnroll = classSession.canAcceptNewEnrollments && !ownEnrollment;
  const openForm = query?.enroll === "1" || (feedback !== null && !feedback.success);
  const detailHref = classDetailHref(classSession.id, returnTo);
  const enrollHref = `${detailHref}${detailHref.includes("?") ? "&" : "?"}enroll=1#enroll`;
  const availability = getClassAvailability(classSession);
  return (
    <SiteShell signedInArea="member" publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8" signedInClassName="flex flex-col gap-6">
      <div className={canEnroll ? "group grid min-w-0 gap-6 pb-24 sm:pb-0" : "grid min-w-0 gap-6"}>
        <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>{classReturnLabel(returnTo)}</Link>
        <DetailCover url={classSession.coverUrl} />
        <header className="border-b border-ink/15 pb-5">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink">{classSession.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3"><ClassOriginTag origin={classSession.origin} /><ClassAvailabilityBadge availability={availability} canAcceptNewEnrollments={classSession.canAcceptNewEnrollments} /></div>
          {canEnroll && !useTermPanel ? <a className="mt-4 inline-flex min-h-11 items-center rounded-full bg-pine px-5 py-3 text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-clay" href="#enroll">{classSession.requiresApproval ? "申請報名" : "我要報名"}</a> : null}
        </header>
        {feedback && !useTermPanel ? <section aria-live="polite" className={feedback.success ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"}>{feedback.message}{feedback.success ? <> <Link className="font-medium underline" href="/member/enrollments">查看我的報名</Link></> : null}</section> : null}
        <ClassSummary classSession={classSession} termPeriod={termPeriod} />
        {useTermPanel && term ? (
          <TermClassEnrollPanel
            classSession={classSession}
            feedback={feedback}
            openForm={openForm}
            returnTo={returnTo}
            signedIn={Boolean(user)}
            term={term}
            termDetail={termDetail}
          />
        ) : (
          <ClassEnrollmentPanel classSession={classSession} signedIn={Boolean(user)} returnTo={returnTo} />
        )}
        {/* 票 14（Q6）：課程說明、適合對象、準備事項有填才顯示（取代學員流程票 03 的「尚未提供」）。 */}
        <ClassInfoSections
          description={classSession.description}
          paymentRulesText={classSession.paymentRulesText}
          preparationNotes={classSession.preparationNotes}
          priceNote={classSession.priceNote}
          suitableFor={classSession.suitableFor}
        />
        {/* teacher-class-scheduling 票 12：同系列其他尚未開始、學員看得到的場次。 */}
        {siblings.length > 0 ? (
          <section aria-labelledby="sibling-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
            <h2 id="sibling-heading" className="text-lg font-medium text-ink">同系列的其他場次</h2>
            <ul aria-label="同系列的其他場次" className="mt-3 grid gap-1">
              {siblings.map((sibling) => (
                <li key={sibling.id}>
                  <Link className="inline-flex min-h-11 items-center text-sm text-ink underline-offset-4 hover:underline" href={`/classes/${sibling.id}`}>
                    {formatTaipeiDatetime(sibling.startAt)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {canEnroll ? <a href={useTermPanel ? enrollHref : "#enroll"} className="fixed inset-x-0 bottom-0 z-20 border-t border-pine/20 bg-cream px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-pine underline focus-visible:outline-2 focus-visible:outline-pine group-has-[form:focus-within]:hidden sm:hidden">{useTermPanel ? "我要報名" : "前往報名"}</a> : null}
      </div>
    </SiteShell>
  );
}

// 「10/07（二）19:00」→「10/07（二）」。
function shortDate(date: Date): string {
  return formatTaipeiShortDatetime(date).replace(/\d{2}:\d{2}$/, "");
}
