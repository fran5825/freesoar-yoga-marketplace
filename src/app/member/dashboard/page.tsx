import Link from "next/link";
import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { listOwnEnrollmentsForMember } from "@/domain/enrollment/read-service";
import { listOwnNotifications } from "@/domain/notification/read-service";
import { requireUser } from "@/lib/auth/session";

const enrollmentStatusLabels: Record<string, string> = {
  pending: "處理中",
  confirmed: "已報名",
  cancelled: "已取消",
};

const RECENT_NOTIFICATIONS_LIMIT = 5;
const UPCOMING_ENROLLMENTS_LIMIT = 5;

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

  const enrollmentCounts = {
    pending: enrollments.filter((enrollment) => enrollment.status === "pending").length,
    confirmed: enrollments.filter((enrollment) => enrollment.status === "confirmed").length,
    cancelled: enrollments.filter((enrollment) => enrollment.status === "cancelled").length,
  };

  const now = new Date();
  const upcomingEnrollments = enrollments
    .filter(
      (enrollment) =>
        enrollment.status === "confirmed" && enrollment.classSession.startAt >= now,
    )
    .slice(0, UPCOMING_ENROLLMENTS_LIMIT);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Member</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          我的總覽
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          這裡彙整你最近的通知與報名狀態。
        </p>
      </header>

      <section className="rounded border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-950">近期通知</h2>
          <Link
            className="text-sm font-medium text-sky-700 hover:underline"
            href="/notifications"
          >
            查看全部通知
          </Link>
        </div>

        {recentNotifications.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-gray-600">
            目前沒有任何通知。重要狀態變更（例如媒合成立、報名成功）都會顯示在這裡。
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {recentNotifications.map((notification) => (
              <li
                className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                key={notification.id}
              >
                <p className="text-sm font-medium text-gray-950">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-700">
                  {notification.body}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatTaipeiDatetime(notification.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-950">我的報名</h2>
          <Link
            className="text-sm font-medium text-sky-700 hover:underline"
            href="/member/enrollments"
          >
            查看全部報名
          </Link>
        </div>

        {enrollments.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-gray-600">
            目前沒有任何報名。透過團主分享的課程連結報名後，會顯示在這裡。
          </p>
        ) : (
          <>
            <dl className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <dt className="text-gray-500">{enrollmentStatusLabels.confirmed}</dt>
                <dd className="text-xl font-semibold text-gray-950">
                  {enrollmentCounts.confirmed}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{enrollmentStatusLabels.pending}</dt>
                <dd className="text-xl font-semibold text-gray-950">
                  {enrollmentCounts.pending}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{enrollmentStatusLabels.cancelled}</dt>
                <dd className="text-xl font-semibold text-gray-950">
                  {enrollmentCounts.cancelled}
                </dd>
              </div>
            </dl>

            {upcomingEnrollments.length > 0 ? (
              <div className="mt-6 grid gap-3">
                <h3 className="text-sm font-medium text-gray-950">即將到來</h3>
                {upcomingEnrollments.map((enrollment) => (
                  <div
                    className="rounded border border-gray-100 bg-gray-50 p-4"
                    key={enrollment.id}
                  >
                    <p className="text-sm font-medium text-gray-950">
                      {enrollment.classSession.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatTaipeiDatetime(enrollment.classSession.startAt)} 開始・
                      {enrollment.classSession.location}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
