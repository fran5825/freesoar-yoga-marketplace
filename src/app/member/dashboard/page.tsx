import Link from "next/link";
import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getMemberTodos } from "@/domain/enrollment/member-todos";
import { listOwnEnrollmentsForMember } from "@/domain/enrollment/read-service";
import { listOwnNotifications } from "@/domain/notification/read-service";
import { requireUser } from "@/lib/auth/session";

import { MemberTodoList, MemberWaitingList } from "../_components/MemberTodoList";

const RECENT_NOTIFICATIONS_LIMIT = 5;
const UPCOMING_ENROLLMENTS_LIMIT = 5;

// 學員首頁先呈現即將上課，再呈現本人可操作／等候事項與近期通知。
export default async function MemberDashboardPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [notifications, enrollments] = await Promise.all([
    listOwnNotifications(),
    listOwnEnrollmentsForMember(),
  ]);

  const recentNotifications = notifications.slice(0, RECENT_NOTIFICATIONS_LIMIT);

  const now = new Date();
  const todos = getMemberTodos(enrollments, now);
  const upcomingEnrollments = enrollments
    .filter(
      (enrollment) =>
        enrollment.status === "confirmed" && enrollment.classSession.startAt >= now,
    )
    .slice(0, UPCOMING_ENROLLMENTS_LIMIT);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          我的總覽
        </h1>
      </header>

      {/* inline-member-actions 票 04：待你處理有事項時是標題後第一張卡。 */}
      <MemberTodoList todos={todos} />

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">即將上課</h2>
          <Link
            className="text-sm font-medium text-clay hover:underline"
            href="/member/enrollments"
          >
            查看全部報名
          </Link>
        </div>

        {enrollments.length === 0 ? (
          <>
            <p className="mt-4 text-sm leading-6 text-ink-soft">
              目前沒有任何報名。報名後的課程會顯示在這裡。
            </p>
            <Link
              className="mt-4 inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/classes"
            >
              去找一堂課
            </Link>
          </>
        ) : upcomingEnrollments.length === 0 ? (
          <>
            <p className="mt-4 text-sm leading-6 text-ink-soft">
              目前沒有即將上課的課程。
            </p>
            <Link
              className="mt-4 inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/classes"
            >
              去找一堂課
            </Link>
          </>
        ) : (
          <div className="mt-4 grid gap-3">
            {upcomingEnrollments.map((enrollment, index) => (
              <Link
                className="grid gap-1 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:border-pine/40 hover:bg-pine-tint/60"
                href={`/classes/${enrollment.classSession.id}`}
                key={enrollment.id}
              >
                {index === 0 ? <span className="text-xs font-medium text-pine">下一堂課</span> : null}
                <span className="min-w-0 break-words text-sm font-medium text-ink">
                  {enrollment.classSession.title}
                </span>
                <span className="text-sm text-ink-soft">
                  {formatTaipeiDatetime(enrollment.classSession.startAt)} 開始・
                  {enrollment.classSession.location}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MemberWaitingList todos={todos} />

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">近期通知</h2>
          <Link
            className="text-sm font-medium text-clay hover:underline"
            href="/member/notifications"
          >
            查看全部通知
          </Link>
        </div>

        {recentNotifications.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            目前沒有任何通知。重要狀態變更（例如媒合成立、報名成功）都會顯示在這裡。
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {recentNotifications.map((notification) => (
              <li
                className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0"
                key={notification.id}
              >
                <p className="text-sm font-medium text-ink">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  {notification.body}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  {formatTaipeiDatetime(notification.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
