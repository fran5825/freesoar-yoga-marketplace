import Link from "next/link";
import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getMemberTodos } from "@/domain/enrollment/member-todos";
import { listOwnEnrollmentsForMember } from "@/domain/enrollment/read-service";
import { requireUser } from "@/lib/auth/session";

import { CancelEnrollmentForm } from "../_components/CancelEnrollmentForm";
import { EnrollmentStatusBadge } from "../_components/EnrollmentStatusBadge";
import { ScrollToTarget } from "../../_components/ScrollToTarget";
import { MemberTodoList, MemberWaitingList } from "../_components/MemberTodoList";
import { TermRowAction, TermRowBadge, WithdrawTermInline } from "../_components/TermRowControls";

import { cancelEnrollmentAction, submitReviewAction } from "./actions";

type OwnEnrollmentItem = Awaited<ReturnType<typeof listOwnEnrollmentsForMember>>[number];

function groupTermCards(items: OwnEnrollmentItem[]) {
  const cards = new Map<
    string,
    { seriesEnrollmentId: string; seriesId: string; title: string; status: string; items: OwnEnrollmentItem[] }
  >();

  for (const item of items) {
    const seriesEnrollment = item.seriesEnrollment;

    if (!seriesEnrollment) {
      continue;
    }

    const card = cards.get(seriesEnrollment.id) ?? {
      seriesEnrollmentId: seriesEnrollment.id,
      seriesId: seriesEnrollment.recurringClassSeries.id,
      title: seriesEnrollment.recurringClassSeries.title,
      status: seriesEnrollment.status,
      items: [],
    };
    card.items.push(item);
    cards.set(seriesEnrollment.id, card);
  }

  return [...cards.values()]
    .map((card) => ({
      ...card,
      items: card.items.sort((a, b) => a.classSession.startAt.getTime() - b.classSession.startAt.getTime()),
    }))
    .sort((a, b) => a.items[0].classSession.startAt.getTime() - b.items[0].classSession.startAt.getTime());
}

type MemberEnrollmentsPageProps = {
  searchParams?: Promise<{ result?: string; message?: string; open?: string; focus?: string }>;
};

export default async function MemberEnrollmentsPage({
  searchParams,
}: MemberEnrollmentsPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [enrollments, resolvedSearchParams] = await Promise.all([
    listOwnEnrollmentsForMember(),
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

  const now = new Date();
  const todos = getMemberTodos(enrollments, now);
  // 即將上課（沒取消、還沒結案）由近到遠排在前面；過去與已取消的放後面、由新到舊。
  // teacher-class-scheduling 票 12：有效整期報名的即將上課場次合併成一張期班卡片；過去的場次與整期已終結的取消逐場列在下方，評價留在各自的場次。
  const isActiveTermChild = (enrollment: (typeof enrollments)[number]) =>
    enrollment.seriesEnrollment !== null &&
    (enrollment.seriesEnrollment.status === "pending" || enrollment.seriesEnrollment.status === "confirmed");
  // inline-member-actions 票 01：整期仍有效時，請假中的堂也算即將上課（收進整期卡，可以就地取消請假）。
  const isOnActiveTermLeave = (enrollment: (typeof enrollments)[number]) => enrollment.rowControl.kind === "on_leave" && isActiveTermChild(enrollment);
  const isUpcoming = (enrollment: (typeof enrollments)[number]) =>
    (enrollment.status !== "cancelled" || isOnActiveTermLeave(enrollment)) &&
    enrollment.classSession.status !== "cancelled" &&
    enrollment.classSession.status !== "completed" &&
    enrollment.classSession.endAt.getTime() >= now.getTime();
  const termCards = groupTermCards(enrollments.filter((enrollment) => isUpcoming(enrollment) && isActiveTermChild(enrollment)));
  const upcoming = enrollments
    .filter((enrollment) => isUpcoming(enrollment) && !isActiveTermChild(enrollment))
    .sort((a, b) => a.classSession.startAt.getTime() - b.classSession.startAt.getTime());
  const past = enrollments
    .filter((enrollment) => !isUpcoming(enrollment))
    .sort((a, b) => b.classSession.startAt.getTime() - a.classSession.startAt.getTime());
  const groups = [
    { heading: "即將上課", items: upcoming },
    { heading: "過去與已取消", items: past },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          我的報名
        </h1>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          id="action-feedback"
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      <ScrollToTarget targetId={resolvedSearchParams?.focus} />

      <MemberTodoList todos={todos} />
      <MemberWaitingList todos={todos} />

      {termCards.length > 0 ? (
        <section aria-label="整期報名" className="grid gap-4">
          {termCards.map((card) => (
            <article
              className="grid gap-3 rounded-2xl border border-pine/25 bg-white p-5"
              id={`term-${card.seriesEnrollmentId}`}
              key={card.seriesEnrollmentId}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="min-w-0 break-words text-lg font-medium text-ink">
                  <Link className="underline-offset-4 hover:underline" href={`/classes/terms/${card.seriesId}`}>
                    {card.title}
                  </Link>
                </h3>
                <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">
                  整期・接下來 {card.items.length} 堂
                </span>
                {card.status === "pending" ? (
                  <span className="text-sm text-ink-soft">等待老師確認整期報名</span>
                ) : null}
              </div>
              <details open={resolvedSearchParams?.open === "sessions"}>
                <summary className="cursor-pointer text-sm font-medium text-pine">查看每一堂</summary>
                <ul aria-label={`${card.title} 的每一堂`} className="mt-3 grid gap-2">
                  {card.items.map((enrollment) => (
                    <li className="grid scroll-mt-6 gap-2 rounded-xl border border-ink/10 px-4 py-2 text-sm" id={`session-row-${enrollment.id}`} key={enrollment.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link className="min-h-11 py-2 text-ink underline-offset-4 hover:underline" href={`/classes/${enrollment.classSession.id}`}>
                          {formatTaipeiDatetime(enrollment.classSession.startAt)}
                        </Link>
                        <TermRowBadge control={enrollment.rowControl} status={enrollment.status} />
                      </div>
                      <TermRowAction
                        classSessionId={enrollment.classSession.id}
                        control={enrollment.rowControl}
                        enrollmentId={enrollment.id}
                        returnTo="/member/enrollments"
                        termMode={enrollment.termEnrollmentMode}
                      />
                    </li>
                  ))}
                </ul>
              </details>
              <WithdrawTermInline
                affectedStartAts={card.items.filter((enrollment) => enrollment.rowControl.kind === "leave").map((enrollment) => enrollment.classSession.startAt)}
                returnTo="/member/enrollments"
                seriesEnrollmentId={card.seriesEnrollmentId}
              />
            </article>
          ))}
        </section>
      ) : null}

      {enrollments.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有任何報名</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            報名後的課程會顯示在這裡。
          </p>
          <Link
            className="mt-4 inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
            href="/classes"
          >
            去找一堂課
          </Link>
        </section>
      ) : (
        <div className="grid gap-8">
          {groups.map((group) => (
            <section className="grid gap-4" key={group.heading}>
              <h2 className="text-sm font-medium text-ink-soft">{group.heading}</h2>
              {group.items.map((enrollment) => (
            <article
              className="relative grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40"
              id={`enrollment-${enrollment.id}`}
              key={enrollment.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="min-w-0 break-words text-lg font-medium text-ink">
                  {/* 標題連結用 after 撐滿整張卡，整張卡都可點進課程詳情；
                      取消與評價的表單另外用 relative z-10 浮在上層，仍可正常操作。 */}
                  {enrollment.classSession.status === "cancelled" ? <span>{enrollment.classSession.title}</span> : <Link
                    className="after:absolute after:inset-0 after:rounded-2xl"
                    href={`/classes/${enrollment.classSession.id}`}
                  >
                    {enrollment.classSession.title}
                  </Link>}
                </h3>
                <EnrollmentStatusBadge status={enrollment.status} />
                {enrollment.classSession.status === "cancelled" ? <span className="text-sm text-ink-soft">課程已取消</span> : null}
              </div>
              <p className="text-sm text-ink-soft">
                {formatTaipeiDatetime(enrollment.classSession.startAt)} 開始・
                {enrollment.classSession.location}
              </p>

              {/* 課程開始後就不顯示取消（按了也會被伺服器擋下，見 cancelOwnEnrollment）。 */}
              {["confirmed", "pending"].includes(enrollment.status) &&
              enrollment.classSession.startAt.getTime() > now.getTime() ? (
                <CancelEnrollmentForm
                  action={cancelEnrollmentAction}
                  enrollmentId={enrollment.id}
                />
              ) : null}

              {enrollment.status === "confirmed" &&
              enrollment.classSession.status === "completed" ? (
                enrollment.classSession.reviews.length > 0 ? (
                  <div className="relative z-10 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-900">
                      你的評價：{"★".repeat(enrollment.classSession.reviews[0].rating)}
                    </p>
                    {enrollment.classSession.reviews[0].comment ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-emerald-900">
                        {enrollment.classSession.reviews[0].comment}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <details className="relative z-10 rounded-xl border border-pine/25 bg-pine-tint/60">
                    <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-pine marker:hidden">
                      留下評價…
                    </summary>
                    <form
                      action={submitReviewAction}
                      className="grid gap-3 border-t border-pine/15 p-4"
                    >
                      <input
                        name="classSessionId"
                        type="hidden"
                        value={enrollment.classSession.id}
                      />
                      <div>
                        <label
                          className="text-sm font-medium text-ink"
                          htmlFor={`rating-${enrollment.id}`}
                        >
                          星等
                        </label>
                        <select
                          className="mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                          defaultValue=""
                          id={`rating-${enrollment.id}`}
                          name="rating"
                          required
                        >
                          <option disabled value="">
                            請選擇星等
                          </option>
                          <option value="5">★★★★★（5）</option>
                          <option value="4">★★★★（4）</option>
                          <option value="3">★★★（3）</option>
                          <option value="2">★★（2）</option>
                          <option value="1">★（1）</option>
                        </select>
                      </div>
                      <div>
                        <label
                          className="text-sm font-medium text-ink"
                          htmlFor={`comment-${enrollment.id}`}
                        >
                          評語（選填）
                        </label>
                        <textarea
                          className="mt-2 min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                          id={`comment-${enrollment.id}`}
                          maxLength={500}
                          name="comment"
                          placeholder="說說這堂課帶給你的感受，讓其他人參考。"
                        />
                      </div>
                      <button
                        className="w-full rounded-full bg-pine px-4 py-2 text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto"
                        type="submit"
                      >
                        送出評價
                      </button>
                    </form>
                  </details>
                )
              ) : null}
            </article>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
