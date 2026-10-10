import Link from "next/link";

import { formatTaipeiDatetimeLocal, formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { getTermDetailForViewer, type TermDetail, type TermEnrollBlock } from "@/domain/enrollment/term-read-service";
import { getCurrentUser } from "@/lib/auth/session";
import { classDetailHref, classReturnLabel, safeParentReturnPath, termDetailHref } from "@/lib/navigation/class-return-path";

import { SignInOptions } from "../../../_components/sign-in-options";
import { SiteShell } from "../../../_components/site-shell";
import { EnrollmentStatusBadge } from "../../../member/_components/EnrollmentStatusBadge";
import { ClassInfoSections } from "../../_components/ClassInfoSections";
import { EnrollReveal, OptionalNotes } from "../../_components/EnrollReveal";
import { enrollTermAction, signInToEnrollTermAction, withdrawTermAction } from "./actions";

// teacher-class-scheduling 票 08：學員端的期班頁（規格 4.7、4.8）。
// 票 14（2026-10-09 產品主人 Q3–Q13）：資訊卡只留期間、上課時間、地點、老師；「我要報名」在同一張卡內展開，
// 報名結果也顯示在這張卡；每一堂清單預設收起；手機底部固定「我要報名」；沒填的說明卡不顯示。
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";
const cardClass = "min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6";
const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export default async function TermPage({
  params,
  searchParams,
}: {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ result?: string; message?: string; enroll?: string; returnTo?: string }>;
}) {
  const [{ recurringClassSeriesId }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const term = await getTermDetailForViewer(recurringClassSeriesId, user?.id ?? null);
  // 這一頁的來源（找課程、我的報名、首頁）；返回連結與下面各表單都帶著它。
  const returnTo = safeParentReturnPath(query?.returnTo);

  if (!term) {
    return (
      <SiteShell
        signedInArea="member"
        publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8"
        signedInClassName="flex flex-col gap-6"
      >
        <TermUnavailable recurringClassSeriesId={recurringClassSeriesId} returnTo={returnTo} signedIn={Boolean(user)} />
      </SiteShell>
    );
  }

  const feedback = query?.result && query.message ? { success: query.result === "success", message: query.message } : null;
  const canStartEnroll = !term.ownSeriesEnrollment && !term.termEnrollBlock;
  const openForm = query?.enroll === "1" || (feedback !== null && !feedback.success);

  return (
    <SiteShell
      signedInArea="member"
      publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8"
      signedInClassName="flex flex-col gap-6"
    >
      <div className={canStartEnroll ? "grid min-w-0 gap-6 pb-24 sm:pb-0" : "grid min-w-0 gap-6"}>
        <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>
          {classReturnLabel(returnTo)}
        </Link>
        <header className="grid gap-3 border-b border-ink/15 pb-5">
          <p className="w-fit rounded-full bg-pine-tint px-3 py-1 text-sm font-medium text-pine-deep">
            期班・共 {term.totalCount} 堂・剩 {term.remainingCount} 堂
          </p>
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink">{term.title}</h1>
          {term.serviceTypes.length + term.yogaStyles.length > 0 ? (
            <ul aria-label="課程風格與瑜伽類型" className="flex flex-wrap gap-2">
              {[...term.serviceTypes, ...term.yogaStyles].map((tag) => (
                <li className="rounded-full border border-ink/15 px-3 py-0.5 text-xs text-ink-soft" key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        <section aria-labelledby="term-summary-heading" className="scroll-mt-6 grid gap-5 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6" id="enroll-term">
          <h2 className="sr-only" id="term-summary-heading">
            課程資訊與報名
          </h2>
          <TermFacts term={term} />
          <div className="grid gap-4 border-t border-ink/10 pt-5">
            <TermEnrollArea feedback={feedback} openForm={openForm} returnTo={returnTo} signedIn={Boolean(user)} term={term} />
          </div>
        </section>

        <TermSessionList returnTo={returnTo} term={term} />

        <ClassInfoSections
          description={term.description}
          idPrefix="term-"
          preparationNotes={term.preparationNotes}
          suitableFor={term.suitableFor}
        />

        {canStartEnroll ? (
          <a
            className="fixed inset-x-0 bottom-0 z-20 border-t border-pine/20 bg-cream px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-pine underline focus-visible:outline-2 focus-visible:outline-pine sm:hidden"
            href={`${termDetailHref(term.id, returnTo)}${returnTo === "/classes" ? "?" : "&"}enroll=1#enroll-term`}
          >
            我要報名
          </a>
        ) : null}
      </div>
    </SiteShell>
  );
}

// 訪客讀不到（不公開、全是草稿等）時顯示登入引導，比照單堂頁不透露期班是否存在；已登入仍讀不到就說明。
function TermUnavailable({ recurringClassSeriesId, returnTo, signedIn }: { recurringClassSeriesId: string; returnTo: string; signedIn: boolean }) {
  return (
    <div className="grid min-w-0 gap-6">
      <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>
        {classReturnLabel(returnTo)}
      </Link>
      <section className="grid gap-4 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{signedIn ? "目前看不到這個期班" : "登入後查看這個期班"}</h1>
        {signedIn ? (
          <p className="text-sm leading-6 text-ink-soft">這個期班目前沒有開放，或連結已經失效。</p>
        ) : (
          <>
            <p className="text-sm leading-6 text-ink-soft">
              如果你是收到老師分享的期班連結，登入後就能看到上課時間與地點，並決定是否報名。第一次使用會自動建立帳號；報名要由你確認後才會送出。
            </p>
            <SignInOptions
              action={signInToEnrollTermAction}
              buttonClassName={buttonClass}
              fields={{ recurringClassSeriesId, returnTo }}
              label={(provider) => `使用 ${provider} 登入查看`}
            />
          </>
        )}
      </section>
    </div>
  );
}

function hasTimeException(term: TermDetail): boolean {
  return term.sessions.some(
    (session) =>
      session.upcoming &&
      (formatTaipeiDatetimeLocal(session.startAt).split("T")[1] !== term.startTime ||
        formatTaipeiDatetimeLocal(session.endAt).split("T")[1] !== term.endTime),
  );
}

function TermFacts({ term }: { term: TermDetail }) {
  const rows: { label: string; value: string }[] = [
    {
      label: "期間",
      value: term.firstStartAt && term.lastStartAt ? `${shortDate(term.firstStartAt)} – ${shortDate(term.lastStartAt)}` : "—",
    },
    {
      label: "上課時間",
      // 只改某一堂的時間時，每一堂的實際時間列在「查看每一堂」（2026-10-09 Codex review）。
      value: `${term.dayOfWeek === null ? "指定日期" : `每${dayOfWeekLabels[term.dayOfWeek]}`} ${term.startTime}–${term.endTime}${
        hasTimeException(term) ? "（部分堂次時間不同，以每一堂為準）" : ""
      }`,
    },
    {
      label: "地點",
      value: term.sessions.some((session) => session.location !== term.location)
        ? `${term.location}（部分堂次地點不同，見每一堂）`
        : term.location,
    },
    { label: "老師", value: term.teacherDisplayName ?? "飛索老師" },
  ];

  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div className="min-w-0" key={row.label}>
          <dt className="text-ink-faint">{row.label}</dt>
          <dd className="mt-1 break-words text-base text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
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
      return block.reEnrollable
        ? `你曾取消 ${formatTaipeiShortDatetime(block.startAt)} 的報名，請先到那一堂重新報名，再回來報整期。`
        : `你曾取消 ${formatTaipeiShortDatetime(block.startAt)} 的報名，這一期無法再報整期。`;
    case "teacher_not_approved":
      return "這位老師目前無法接受新報名。";
  }
}

function TermEnrollArea({
  term,
  signedIn,
  feedback,
  openForm,
  returnTo,
}: {
  returnTo: string;
  term: TermDetail;
  signedIn: boolean;
  feedback: { success: boolean; message: string } | null;
  openForm: boolean;
}) {
  const hint = term.requiresApproval ? "需老師確認，確認一次就套用到整期" : "送出即成立";
  const feedbackLine = feedback ? (
    <p
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
    </p>
  ) : null;

  if (term.ownSeriesEnrollment) {
    const active = term.ownSeriesEnrollment.status === "pending" || term.ownSeriesEnrollment.status === "confirmed";

    return (
      <>
        <h3 className="text-base font-medium text-ink">你的整期報名</h3>
        {feedbackLine}
        <p className="text-sm leading-6 text-ink-soft">{seriesStatusCopy[term.ownSeriesEnrollment.status]}</p>
        {active ? (
          <>
            <p className="text-sm leading-6 text-ink-soft">某一堂不能來，到「查看每一堂」點進那一堂按「請假這一堂」，其他堂照常。</p>
            <WithdrawTermForm returnTo={returnTo} seriesEnrollmentId={term.ownSeriesEnrollment.id} term={term} />
          </>
        ) : null}
      </>
    );
  }

  if (term.termEnrollBlock) {
    // Q12：不能報整期時不顯示按鈕，直接說原因。
    return (
      <>
        {feedbackLine}
        <p className="text-sm leading-6 text-ink-soft">{blockMessage(term.termEnrollBlock)}</p>
      </>
    );
  }

  return (
    <EnrollReveal defaultOpen={openForm} hint={hint}>
      {feedbackLine}
      {!signedIn ? (
        <>
          <p className="text-sm leading-6 text-ink-soft">
            登入後會報上剩下的 {term.remainingCount} 堂。第一次使用會自動建立帳號；登入後回到這裡，由你確認後才會送出。
          </p>
          <SignInOptions
            action={signInToEnrollTermAction}
            buttonClassName={buttonClass}
            fields={{ recurringClassSeriesId: term.id, returnTo }}
            label={(provider) => `使用 ${provider} 登入並報名`}
          />
        </>
      ) : (
        <form action={enrollTermAction} className="grid gap-4">
          <input name="recurringClassSeriesId" type="hidden" value={term.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <p className="text-sm leading-6 text-ink-soft">
            報名整期會報上剩下的 {term.remainingCount} 堂{term.requiresApproval ? "，送出後等待老師確認" : ""}。已經單堂報名的場次會併入整期。
          </p>
          <OptionalNotes id="term-notes" />
          <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
            <input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />
            我了解此課程非醫療行為，會依自身身體狀況參與。
          </label>
          <button className={buttonClass} type="submit">
            {term.requiresApproval ? `送出整期報名申請（${term.remainingCount} 堂）` : `確認報名整期（${term.remainingCount} 堂）`}
          </button>
        </form>
      )}
    </EnrollReveal>
  );
}

// teacher-class-scheduling 票 09：退出整期前列出會取消的場次（尚未開始、處理中／已報名的那幾堂）。
function WithdrawTermForm({ term, seriesEnrollmentId, returnTo }: { term: TermDetail; seriesEnrollmentId: string; returnTo: string }) {
  const affected = term.sessions.filter(
    (session) =>
      session.upcoming && (session.ownEnrollmentStatus === "pending" || session.ownEnrollmentStatus === "confirmed"),
  );

  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
        退出整期…
      </summary>
      <form action={withdrawTermAction} className="grid gap-3 border-t border-amber-100 p-4">
        <input name="recurringClassSeriesId" type="hidden" value={term.id} />
        <input name="seriesEnrollmentId" type="hidden" value={seriesEnrollmentId} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <p className="text-sm font-medium leading-6 text-amber-900">
          {affected.length > 0 ? `會取消之後的 ${affected.length} 堂：` : "之後沒有要取消的場次。"}
        </p>
        {affected.length > 0 ? (
          <ul aria-label="退出後會取消的場次" className="grid gap-1 text-sm text-ink-soft">
            {affected.map((session) => (
              <li key={session.id}>{formatTaipeiShortDatetime(session.startAt)}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm leading-6 text-ink-soft">已經上過的紀錄會保留。退出後這一期不能再報整期。</p>
        <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
          <input className="mt-1 shrink-0" name="confirmWithdraw" required type="checkbox" value="yes" />
          我確認要退出這一期。
        </label>
        <button
          className="w-full rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 sm:w-auto"
          type="submit"
        >
          確認退出整期
        </button>
      </form>
    </details>
  );
}

// Q11：預設收起，只列日期時段、自己的狀態、地點或時間不同的提示；不顯示人數。
function TermSessionList({ term, returnTo }: { term: TermDetail; returnTo: string }) {
  return (
    <details className={cardClass}>
      <summary className="cursor-pointer text-base font-medium text-ink">查看每一堂（共 {term.totalCount} 堂）</summary>
      {term.termEnrollmentMode === "term_and_single" ? (
        <p className="mt-3 text-sm leading-6 text-ink-soft">只想上其中幾堂，可以點進該堂單獨報名。</p>
      ) : null}
      <ul aria-label="這一期的上課日期" className="mt-3 grid gap-2">
        {term.sessions.map((session) => (
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 px-4 py-2 text-sm" key={session.id}>
            <Link className="min-h-11 py-2 font-medium text-ink underline-offset-4 hover:underline" href={classDetailHref(session.id, termDetailHref(term.id, returnTo))}>
              {formatTaipeiShortDatetime(session.startAt)}–{formatTaipeiDatetimeLocal(session.endAt).split("T")[1]}
            </Link>
            <span className="flex flex-wrap items-center gap-2 text-ink-soft">
              {session.ownEnrollmentStatus ? <EnrollmentStatusBadge status={session.ownEnrollmentStatus} /> : null}
              {session.status === "completed" ? "已結束" : null}
              {session.canEnrollSingle ? <span className="text-pine">可單堂報名</span> : null}
            </span>
            {session.location !== term.location ? (
              <span className="w-full break-words text-ink-soft">這一堂地點：{session.location}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {term.draftCount > 0 ? <p className="mt-3 text-sm leading-6 text-ink-faint">另有 {term.draftCount} 堂尚未開放報名。</p> : null}
    </details>
  );
}
