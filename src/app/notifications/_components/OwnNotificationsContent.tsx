import Link from "next/link";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getNotificationLink } from "@/domain/notification/link";
import { listOwnNotifications } from "@/domain/notification/read-service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

// 「我的通知」內容，不含外框。三個地方共用：
// - /teacher/notifications、/organizer/notifications：由各自專區的 layout 包導覽列，
//   從哪個專區點「通知」就留在哪個專區（同時是老師與團主的人不會被切到另一個專區）。
// - /notifications：學員與既有通知連結使用，由該頁自己決定外框。
// 呼叫端負責在未登入時導向登入頁；這裡的 requireUser() 只是保險。
export async function OwnNotificationsContent() {
  const currentUser = await requireUser();

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

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">我的通知</h1>
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
}
