import Link from "next/link";
import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getNotificationLink } from "@/domain/notification/link";
import { listOwnNotifications } from "@/domain/notification/read-service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { OrganizerShell } from "../organizer/_components/OrganizerShell";
import { TeacherShell } from "../teacher/_components/TeacherShell";

export default async function NotificationsPage() {
  let currentUser: Awaited<ReturnType<typeof requireUser>>;

  try {
    currentUser = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [notifications, organizerContext, teacherProfile] = await Promise.all([
    listOwnNotifications(),
    getOwnOrganizerContext(),
    getOwnTeacherProfileApplicationSnapshot(),
  ]);

  const identity = {
    isOrganizer: organizerContext !== null,
    isTeacher: teacherProfile !== null,
    isAdmin: currentUser.isAdmin,
  };

  const content = (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          我的通知
        </h1>
      </header>

      {notifications.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有任何通知</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            重要狀態變更（例如媒合成立、報名成功）都會顯示在這裡。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {notifications.map((notification) => {
            const link = getNotificationLink(notification.type, identity);

            return (
            <article
              className="grid gap-2 rounded-2xl border border-ink/15 bg-white p-5"
              key={notification.id}
            >
              <h2 className="text-lg font-medium text-ink">{notification.title}</h2>
              <p className="text-sm leading-6 text-ink-soft">{notification.body}</p>
              <p className="text-xs text-ink-faint">
                {formatTaipeiDatetime(notification.createdAt)}
              </p>
              {link ? (
                <p>
                  <Link
                    className="text-sm font-medium text-clay hover:underline"
                    href={link.href}
                  >
                    {link.label} →
                  </Link>
                </p>
              ) : null}
            </article>
            );
          })}
        </section>
      )}
    </div>
  );

  // 通知是各角色共用頁面：團主、老師開這頁時帶上自己專區的導覽列（兩種身分都有時以團主為準），
  // 其他人維持原樣。
  if (organizerContext) {
    return <OrganizerShell>{content}</OrganizerShell>;
  }

  if (teacherProfile) {
    return <TeacherShell>{content}</TeacherShell>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 sm:px-8">
      {content}
    </main>
  );
}
