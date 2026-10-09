import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassSessionForMember } from "@/domain/enrollment/read-service";
import { getTermSummaryForClassSession } from "@/domain/enrollment/term-read-service";
import { getPublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { getClassAvailability } from "@/domain/class-session/availability";
import { getCurrentUser } from "@/lib/auth/session";
import { safeClassReturnPath } from "@/lib/navigation/class-return-path";
import { SiteShell } from "../../_components/site-shell";
import { ClassAvailabilityBadge } from "../_components/ClassAvailabilityBadge";
import { ClassOriginTag } from "../_components/ClassOriginTag";
import { ClassSummary } from "../_components/ClassSummary";
import { ClassEnrollmentPanel } from "../_components/ClassEnrollmentPanel";
import { ClassSignInGuide } from "../_components/ClassSignInGuide";

export default async function MemberClassSessionPage({ params, searchParams }: {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string; returnTo?: string }>;
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
  const feedback = query?.result && query.message ? { success: query.result === "success", message: query.message } : null;
  const ownEnrollment = "ownEnrollment" in classSession ? classSession.ownEnrollment : null;
  // teacher-class-scheduling 票 08：屬於期班時引導到期班頁；只收整期的期班不提供單堂報名。
  const term = await getTermSummaryForClassSession(classSession.id);
  const termOnly = term?.termEnrollmentMode === "term_only";
  const canEnroll = classSession.canAcceptNewEnrollments && !ownEnrollment && !termOnly;
  const availability = getClassAvailability(classSession);
  return (
    <SiteShell signedInArea="member" publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8" signedInClassName="flex flex-col gap-6">
      <div className={canEnroll ? "group grid min-w-0 gap-6 pb-24 sm:pb-0" : "grid min-w-0 gap-6"}>
        <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>返回課程列表</Link>
        <header className="border-b border-ink/15 pb-5">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink">{classSession.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3"><ClassOriginTag origin={classSession.origin} /><ClassAvailabilityBadge availability={availability} canAcceptNewEnrollments={classSession.canAcceptNewEnrollments} /></div>
          {canEnroll ? <a className="mt-4 inline-flex min-h-11 items-center rounded-full bg-pine px-5 py-3 text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-clay" href="#enroll">{classSession.requiresApproval ? "申請報名" : "我要報名"}</a> : null}
        </header>
        {feedback ? <section aria-live="polite" className={feedback.success ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"}>{feedback.message}{feedback.success ? <> <Link className="font-medium underline" href="/member/enrollments">查看我的報名</Link></> : null}</section> : null}
        <ClassSummary classSession={classSession} />
        {term ? (
          <section aria-labelledby="term-notice-heading" className="grid gap-2 rounded-2xl border border-pine/25 bg-pine-tint p-5 sm:p-6">
            <h2 id="term-notice-heading" className="text-lg font-medium text-ink">這堂課屬於期班「{term.title}」</h2>
            <p className="text-sm leading-6 text-ink-soft">
              這一期共 {term.totalCount} 堂，{termOnly ? "只收整期報名。" : "可以報整期，也可以只報這一堂。"}
            </p>
            <Link className="w-fit py-2 text-sm font-medium text-pine underline" href={`/classes/terms/${term.id}`}>
              查看期班與報名整期
            </Link>
          </section>
        ) : null}
        <ClassEnrollmentPanel classSession={classSession} signedIn={Boolean(user)} returnTo={returnTo} termOnlyHref={termOnly && term ? `/classes/terms/${term.id}` : null} />
        <section aria-labelledby="description-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"><h2 id="description-heading" className="text-lg font-medium text-ink">課程說明</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{classSession.description || "尚未提供課程說明。"}</p></section>
        {/* member-flow 票 03：適合對象、準備事項，接在課程說明之後；舊課與團主課沒有資料時顯示「尚未提供」。 */}
        <section aria-labelledby="suitable-for-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"><h2 id="suitable-for-heading" className="text-lg font-medium text-ink">適合對象</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{classSession.suitableFor || "尚未提供"}</p></section>
        <section aria-labelledby="preparation-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"><h2 id="preparation-heading" className="text-lg font-medium text-ink">準備事項</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{classSession.preparationNotes || "尚未提供"}</p></section>
        {canEnroll ? <a href="#enroll" className="fixed inset-x-0 bottom-0 z-20 border-t border-pine/20 bg-cream px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-pine underline focus-visible:outline-2 focus-visible:outline-pine group-has-[form:focus-within]:hidden sm:hidden">前往報名</a> : null}
      </div>
    </SiteShell>
  );
}
