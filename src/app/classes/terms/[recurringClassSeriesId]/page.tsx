import Link from "next/link";
import { notFound } from "next/navigation";

import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { getTermDetailForViewer, type TermDetail, type TermEnrollBlock } from "@/domain/enrollment/term-read-service";
import { getCurrentUser } from "@/lib/auth/session";

import { SignInOptions } from "../../../_components/sign-in-options";
import { SiteShell } from "../../../_components/site-shell";
import { EnrollmentStatusBadge } from "../../../member/_components/EnrollmentStatusBadge";
import { enrollTermAction, signInToEnrollTermAction } from "./actions";

// teacher-class-scheduling 票 08：學員端的期班頁（規格 4.7、4.8）。顯示期間、全部可見日期、剩餘堂數與報名方式，
// 提供「報名整期」；整期和單堂都收的期班，每一場可以點進單堂頁單獨報名。
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";
const cardClass = "min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6";
const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export default async function TermPage({
  params,
  searchParams,
}: {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
}) {
  const [{ recurringClassSeriesId }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const term = await getTermDetailForViewer(recurringClassSeriesId, user?.id ?? null);

  if (!term) {
    notFound();
  }

  const feedback = query?.result && query.message ? { success: query.result === "success", message: query.message } : null;

  return (
    <SiteShell
      signedInArea="member"
      publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8"
      signedInClassName="flex flex-col gap-6"
    >
      <div className="grid min-w-0 gap-6">
        <Link className="w-fit py-2 text-sm text-clay underline" href="/classes">
          返回課程列表
        </Link>
        <header className="border-b border-ink/15 pb-5">
          <p className="inline-flex rounded-full bg-pine-tint px-3 py-1 text-sm font-medium text-pine-deep">
            期班・共 {term.totalCount} 堂・剩 {term.remainingCount} 堂
          </p>
          <h1 className="mt-3 min-w-0 break-words text-2xl font-semibold tracking-tight text-ink">{term.title}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {term.termEnrollmentMode === "term_only" ? "只收整期報名" : "可以報整期，也可以只報其中幾堂"}
            {term.requiresApproval ? "・報名需老師確認" : ""}
          </p>
        </header>

        {feedback ? (
          <section
            aria-live="polite"
            className={
              feedback.success
                ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
                : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
            }
          >
            {feedback.message}
            {feedback.success ? (
              <>
                {" "}
                <Link className="font-medium underline" href="/member/enrollments">
                  查看我的報名
                </Link>
              </>
            ) : null}
          </section>
        ) : null}

        <TermSummary term={term} />
        <TermEnrollPanel signedIn={Boolean(user)} term={term} />
        <TermSessionList term={term} />

        <section aria-labelledby="term-description-heading" className={cardClass}>
          <h2 className="text-lg font-medium text-ink" id="term-description-heading">
            課程說明
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">
            {term.description || "尚未提供課程說明。"}
          </p>
        </section>
        <section aria-labelledby="term-suitable-heading" className={cardClass}>
          <h2 className="text-lg font-medium text-ink" id="term-suitable-heading">
            適合對象
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">
            {term.suitableFor || "尚未提供"}
          </p>
        </section>
        <section aria-labelledby="term-preparation-heading" className={cardClass}>
          <h2 className="text-lg font-medium text-ink" id="term-preparation-heading">
            準備事項
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">
            {term.preparationNotes || "尚未提供"}
          </p>
        </section>
      </div>
    </SiteShell>
  );
}

function TermSummary({ term }: { term: TermDetail }) {
  const rows: { label: string; value: string }[] = [
    {
      label: "期間",
      value:
        term.firstStartAt && term.lastStartAt
          ? `${shortDate(term.firstStartAt)} – ${shortDate(term.lastStartAt)}`
          : "—",
    },
    {
      label: "上課時間",
      value: `${term.dayOfWeek === null ? "指定日期" : `每${dayOfWeekLabels[term.dayOfWeek]}`} ${term.startTime}–${term.endTime}`,
    },
    { label: "地點", value: term.location },
    { label: "老師", value: term.teacherDisplayName ?? "飛索老師" },
  ];

  return (
    <section aria-labelledby="term-summary-heading" className={cardClass}>
      <h2 className="text-lg font-medium text-ink" id="term-summary-heading">
        課程資訊
      </h2>
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

// 「10/07（二）19:00」→「10/07（二）」。
function shortDate(date: Date): string {
  return formatTaipeiShortDatetime(date).replace(/\d{2}:\d{2}$/, "");
}

const seriesStatusCopy: Record<NonNullable<TermDetail["ownSeriesEnrollment"]>["status"], string> = {
  pending: "整期報名已送出，等待老師確認；確認結果會顯示在「通知」。",
  confirmed: "你已報名整期，請依每一堂的時間與地點準時參加。",
  declined: "老師婉拒了這次整期報名，這一期無法再報整期。",
  withdrawn: "你已退出這一期，這一期無法再報整期。",
};

function blockMessage(block: TermEnrollBlock): string {
  switch (block.reason) {
    case "no_remaining_sessions":
      return "這一期的課都已經開始或結束了，無法再報整期。";
    case "not_fully_open":
      return `這一期還有 ${block.draftCount} 堂尚未開放報名，全部開放後才能報整期。`;
    case "session_full":
      return `${formatTaipeiShortDatetime(block.startAt)} 那一堂已經額滿，暫時不能報整期。`;
    case "has_cancelled_enrollment":
      return `你曾取消 ${formatTaipeiShortDatetime(block.startAt)} 的報名，這一期無法再報整期。`;
    case "teacher_not_approved":
      return "這位老師目前無法接受新報名。";
  }
}

function TermEnrollPanel({ term, signedIn }: { term: TermDetail; signedIn: boolean }) {
  return (
    <section
      aria-labelledby="term-enroll-heading"
      className="scroll-mt-6 grid gap-4 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6"
      id="enroll-term"
    >
      <h2 className="text-lg font-medium text-ink" id="term-enroll-heading">
        {term.ownSeriesEnrollment ? "你的整期報名" : "報名整期"}
      </h2>
      {term.ownSeriesEnrollment ? (
        <p className="text-sm leading-6 text-ink-soft">{seriesStatusCopy[term.ownSeriesEnrollment.status]}</p>
      ) : term.termEnrollBlock ? (
        <p className="text-sm leading-6 text-ink-soft">{blockMessage(term.termEnrollBlock)}</p>
      ) : !signedIn ? (
        <>
          <p className="text-sm leading-6 text-ink-soft">
            登入後即可{term.requiresApproval ? "送出整期報名申請，需老師確認才算成立" : "報名整期"}，會報上剩下的 {term.remainingCount}{" "}
            堂。第一次使用會自動建立帳號；登入後會回到這個頁面，由你確認後才會送出。
          </p>
          <SignInOptions
            action={signInToEnrollTermAction}
            buttonClassName={buttonClass}
            fields={{ recurringClassSeriesId: term.id }}
            label={(provider) => `使用 ${provider} 登入並報名整期`}
          />
        </>
      ) : (
        <form action={enrollTermAction} className="grid gap-4">
          <input name="recurringClassSeriesId" type="hidden" value={term.id} />
          <p className="text-sm leading-6 text-ink-soft">
            會報上剩下的 {term.remainingCount} 堂；已經單堂報名的場次會併入整期。
            {term.requiresApproval ? "送出後等待老師確認，老師確認一次就套用到整期。" : ""}
          </p>
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="term-notes">
              備註（選填）
            </label>
            <textarea
              className="mt-2 min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink focus-visible:outline-2 focus-visible:outline-pine"
              id="term-notes"
              maxLength={500}
              name="notes"
            />
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
            <input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />
            我了解此課程非醫療行為，會依自身身體狀況參與。
          </label>
          <button className={buttonClass} type="submit">
            {term.requiresApproval ? `送出整期報名申請（${term.remainingCount} 堂）` : `報名整期（${term.remainingCount} 堂）`}
          </button>
        </form>
      )}
    </section>
  );
}

function TermSessionList({ term }: { term: TermDetail }) {
  return (
    <section aria-labelledby="term-sessions-heading" className={cardClass}>
      <h2 className="text-lg font-medium text-ink" id="term-sessions-heading">
        這一期的每一堂
      </h2>
      {term.termEnrollmentMode === "term_and_single" ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">只想上其中幾堂，可以點進該堂單獨報名。</p>
      ) : null}
      <ul aria-label="這一期的上課日期" className="mt-3 grid gap-2">
        {term.sessions.map((session) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 px-4 py-3 text-sm"
            key={session.id}
          >
            <Link className="min-h-11 py-2 font-medium text-ink underline-offset-4 hover:underline" href={`/classes/${session.id}`}>
              {formatTaipeiShortDatetime(session.startAt)}
            </Link>
            <span className="flex flex-wrap items-center gap-2 text-ink-soft">
              {session.ownEnrollmentStatus ? <EnrollmentStatusBadge status={session.ownEnrollmentStatus} /> : null}
              {session.status === "completed"
                ? "已結束"
                : `已報名 ${session.activeEnrollmentCount} / ${session.capacity} 人`}
              {session.canEnrollSingle ? <span className="text-pine">・可單堂報名</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {term.draftCount > 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-faint">另有 {term.draftCount} 堂尚未開放報名。</p>
      ) : null}
    </section>
  );
}
