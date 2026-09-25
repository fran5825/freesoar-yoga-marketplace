import Link from "next/link";
import { redirect } from "next/navigation";

import { getDemandNextStep } from "@/domain/demand-request/next-step";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import {
  getOwnDemandRequestList,
  type DemandRequestSnapshot,
} from "@/domain/demand-request/service";
import { isOrganizationContactComplete } from "@/domain/demand-request/validation";
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
      <div className="flex flex-col gap-8">
        <header className="border-b border-ink/15 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            我的總覽
          </h1>
        </header>

        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">
            請先建立團主資料
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            建立團主資料後，你就可以開始提出並管理團課需求。
          </p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/profile"
            >
              前往建立團主資料
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const [notifications, demandRequests] = await Promise.all([
    listOwnNotifications(),
    getOwnDemandRequestList(),
  ]);

  const isContactComplete =
    organizerContext.organization !== null &&
    isOrganizationContactComplete(organizerContext.organization);

  // 票 09：「待你處理」＝需要團主動手的需求（草稿未送、老師已回應待選、已媒合待建課程、被退回），
  // 文案與詳情頁共用同一個來源（getDemandNextStep）。
  const pendingActions = demandRequests
    .map((demandRequest) => ({
      demandRequest,
      nextStep: getDemandNextStep({ status: demandRequest.status }),
    }))
    .filter(({ nextStep }) => nextStep.kind === "action");
  // 草稿可能有好幾筆，而且下方「我的需求」已經逐筆列出，所以這裡只放一行摘要。
  const draftCount = pendingActions.filter(
    ({ demandRequest }) => demandRequest.status === "draft",
  ).length;
  const pendingNonDraftActions = pendingActions.filter(
    ({ demandRequest }) => demandRequest.status !== "draft",
  );

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
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          我的總覽
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          這裡彙整你最近的通知與需求狀態。
        </p>
      </header>

      {isContactComplete ? null : (
        <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
          送出需求前需要先補齊組織聯絡資訊（聯絡窗口、電話、信箱）。{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="/organizer/profile"
          >
            前往團主資料補齊
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">待你處理</h2>

        {pendingActions.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            目前沒有待處理事項。
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {draftCount > 0 ? (
              <Link
                className="grid gap-1 rounded-2xl border border-clay/30 bg-clay-tint p-4 transition hover:bg-sand"
                href="/organizer/demands?status=draft"
              >
                <p className="text-sm font-medium text-ink">
                  {draftCount} 筆草稿還沒送出
                </p>
                <p className="text-sm text-clay-deep">
                  補齊欄位後送出審核
                </p>
              </Link>
            ) : null}
            {pendingNonDraftActions.map(({ demandRequest, nextStep }) => (
              <Link
                className="grid gap-1 rounded-2xl border border-clay/30 bg-clay-tint p-4 transition hover:bg-sand"
                href={`/organizer/demands/${demandRequest.id}`}
                key={demandRequest.id}
              >
                <p className="min-w-0 break-words text-sm font-medium text-ink">
                  {demandRequest.title ?? "尚未命名的需求"}
                </p>
                <p className="text-sm text-clay-deep">{nextStep.shortMessage}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">近期通知</h2>
          <Link
            className="text-sm font-medium text-clay hover:underline"
            href="/notifications"
          >
            查看全部通知
          </Link>
        </div>

        {recentNotifications.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            目前沒有任何通知。重要狀態變更（例如需求公開、老師回應）都會顯示在這裡。
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

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">我的需求</h2>
          <Link
            className="text-sm font-medium text-clay hover:underline"
            href="/organizer/demands"
          >
            查看全部需求
          </Link>
        </div>

        {demandRequests.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-ink-soft">
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
                  className="grid gap-2 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:bg-sand"
                  href={`/organizer/demands/${demandRequest.id}`}
                  key={demandRequest.id}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="min-w-0 break-words text-sm font-medium text-ink">
                      {demandRequest.title ?? "尚未命名的需求"}
                    </p>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${demandRequestStatusToneClasses[demandRequest.status]}`}
                    >
                      {demandRequestStatusLabels[demandRequest.status]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-faint">
                    最後更新：{formatDemandRequestDateTime(demandRequest.updatedAt)}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
