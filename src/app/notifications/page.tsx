import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { listOwnNotifications } from "@/domain/notification/read-service";
import { requireUser } from "@/lib/auth/session";

export default async function NotificationsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const notifications = await listOwnNotifications();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Notifications</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          我的通知
        </h1>
      </header>

      {notifications.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">目前沒有任何通知</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            重要狀態變更（例如媒合成立、報名成功）都會顯示在這裡。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {notifications.map((notification) => (
            <article
              className="grid gap-2 rounded border border-gray-200 bg-white p-5"
              key={notification.id}
            >
              <h2 className="text-lg font-medium text-gray-950">{notification.title}</h2>
              <p className="text-sm leading-6 text-gray-700">{notification.body}</p>
              <p className="text-xs text-gray-500">
                {formatTaipeiDatetime(notification.createdAt)}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
