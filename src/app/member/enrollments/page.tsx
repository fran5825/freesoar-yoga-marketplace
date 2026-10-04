import Link from "next/link";
import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getMemberTodos } from "@/domain/enrollment/member-todos";
import { listOwnEnrollmentsForMember } from "@/domain/enrollment/read-service";
import { requireUser } from "@/lib/auth/session";

import { CancelEnrollmentForm } from "../_components/CancelEnrollmentForm";
import { EnrollmentStatusBadge } from "../_components/EnrollmentStatusBadge";
import { MemberTodoList } from "../_components/MemberTodoList";

import { cancelEnrollmentAction, submitReviewAction } from "./actions";

type MemberEnrollmentsPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
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
  const isUpcoming = (enrollment: (typeof enrollments)[number]) =>
    enrollment.status !== "cancelled" &&
    enrollment.classSession.status !== "cancelled" &&
    enrollment.classSession.status !== "completed" &&
    enrollment.classSession.endAt.getTime() >= now.getTime();
  const upcoming = enrollments
    .filter(isUpcoming)
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
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      <MemberTodoList todos={todos} />

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
