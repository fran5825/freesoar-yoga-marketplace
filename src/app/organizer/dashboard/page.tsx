import Link from "next/link";
import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import {
  getOwnDemandRequestList,
  type DemandRequestSnapshot,
} from "@/domain/demand-request/service";
import { listOwnNotifications } from "@/domain/notification/read-service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import {
  demandRequestStatusLabels,
  demandRequestStatusToneClasses,
  formatDemandRequestDateTime,
} from "../demands/_components/status-labels";

const RECENT_NOTIFICATIONS_LIMIT = 5;
const RECENT_DEMAND_REQUESTS_LIMIT = 5;

export default async function OrganizerDashboardPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        <header className="border-b border-gray-200 pb-6">
          <p className="text-sm font-medium text-amber-700">Organizer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            我的總覽
          </h1>
        </header>

        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-gray-950">
            請先建立團主資料
          </h2>
          <p className="text-sm leading-6 text-gray-600">
            建立團主資料後，你就可以開始提出並管理團課需求。
          </p>
          <div>
            <Link
              className="inline-flex rounded bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              href="/organizer/profile"
            >
              前往建立團主資料
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [notifications, demandRequests] = await Promise.all([
    listOwnNotifications(),
    getOwnDemandRequestList(),
  ]);

  const recentNotifications = notifications.slice(0, RECENT_NOTIFICATIONS_LIMIT);
  const recentDemandRequests = demandRequests.slice(
    0,
    RECENT_DEMAND_REQUESTS_LIMIT,
  );

  const statusCounts = new Map<DemandRequestSnapshot["status"], number>();
  for (const demandRequest of demandRequests) {
    statusCounts.set(
      demandRequest.status,
      (statusCounts.get(demandRequest.status) ?? 0) + 1,
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="grid gap-3 border-b border-gray-200 pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-700">Organizer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            我的總覽
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            這裡彙整你最近的通知與需求狀態。
          </p>
        </div>
        <Link
          className="inline-flex justify-center rounded bg-gray-950 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-gray-800"
          href="/organizer/demands/new"
        >
          建立新的需求
        </Link>
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
            目前沒有任何通知。重要狀態變更（例如需求公開、老師回應）都會顯示在這裡。
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
          <h2 className="text-lg font-semibold text-gray-950">我的需求</h2>
          <Link
            className="text-sm font-medium text-sky-700 hover:underline"
            href="/organizer/demands"
          >
            查看全部需求
          </Link>
        </div>

        {demandRequests.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-gray-600">
            尚未提出任何需求。你可以先建立一筆需求草稿，準備好後再送出審核。
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from(statusCounts.entries()).map(([status, count]) => (
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${demandRequestStatusToneClasses[status]}`}
                  key={status}
                >
                  {demandRequestStatusLabels[status]}・{count}
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-3">
              {recentDemandRequests.map((demandRequest) => (
                <Link
                  className="grid gap-2 rounded border border-gray-100 bg-gray-50 p-4 transition hover:bg-gray-100"
                  href={`/organizer/demands/${demandRequest.id}`}
                  key={demandRequest.id}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="min-w-0 break-words text-sm font-medium text-gray-950">
                      {demandRequest.title ?? "尚未命名的需求"}
                    </p>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${demandRequestStatusToneClasses[demandRequest.status]}`}
                    >
                      {demandRequestStatusLabels[demandRequest.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    最後更新：{formatDemandRequestDateTime(demandRequest.updatedAt)}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
