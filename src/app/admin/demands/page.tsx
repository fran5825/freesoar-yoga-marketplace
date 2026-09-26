import { notFound } from "next/navigation";

import { listDemandRequestsForAdmin } from "@/domain/demand-request/admin-service";
import { getDemandServiceTypes } from "@/domain/demand-request/service-types";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { requireAdmin } from "@/lib/auth/session";

import { AdminFilterBar, resolveActiveTab } from "../_components/AdminFilterBar";
import { AdminFlash, type AdminFlashParams } from "../_components/AdminFlash";
import { AdminListCard } from "../_components/AdminListCard";
import { adminDemandStatusLabel, adminDemandStatusToneClass } from "./status-labels";

type DemandStatus = Awaited<ReturnType<typeof listDemandRequestsForAdmin>>[number]["status"];

// 票 07：預設停在「待審」。列表只放需求標題、狀態、團體、服務類型與多久前，完整內容與審核按鈕在
// 詳情頁。草稿是團主私人資料，管理員看不到，所以不在任何分頁。
const statusTabs: { key: string; label: string; statuses: DemandStatus[] | null }[] = [
  { key: "pending", label: "待審", statuses: ["submitted"] },
  { key: "published", label: "已公開", statuses: ["published", "teacher_responded"] },
  { key: "rejected", label: "已退回", statuses: ["rejected"] },
  { key: "all", label: "全部", statuses: null },
];

const emptyMessages: Record<string, string> = {
  pending: "目前沒有待審核的需求。",
  published: "目前沒有已公開的需求。",
  rejected: "目前沒有已退回的需求。",
  all: "目前沒有任何需求。",
};

type AdminDemandsPageProps = {
  searchParams?: Promise<AdminFlashParams & { status?: string }>;
};

export default async function AdminDemandsPage({ searchParams }: AdminDemandsPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [demandRequests, resolvedSearchParams] = await Promise.all([
    listDemandRequestsForAdmin(),
    searchParams,
  ]);
  const now = new Date();

  const tabs = statusTabs.map((tab) => ({
    ...tab,
    count: tab.statuses
      ? demandRequests.filter((demand) => tab.statuses?.includes(demand.status)).length
      : demandRequests.length,
  }));
  const activeTab = resolveActiveTab(tabs, resolvedSearchParams?.status);
  // 待審的排最久的在前（先處理等最久的）；其他狀態最近更新的在前。
  const visibleDemandRequests = (
    activeTab.statuses
      ? demandRequests.filter((demand) => activeTab.statuses?.includes(demand.status))
      : [...demandRequests]
  ).sort((a, b) =>
    activeTab.key === "pending"
      ? a.updatedAt.getTime() - b.updatedAt.getTime()
      : b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">需求審核</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          檢視團主送出的團課需求，公開合適的需求，或退回並說明原因。點進需求可以看完整內容並操作。
        </p>
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      <AdminFilterBar
        activeKey={activeTab.key}
        ariaLabel="需求狀態篩選"
        basePath="/admin/demands"
        tabs={tabs}
      />

      {visibleDemandRequests.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">{emptyMessages[activeTab.key]}</h2>
        </section>
      ) : (
        <section className="grid gap-3">
          {visibleDemandRequests.map((demand) => (
            <AdminListCard
              href={`/admin/demands/${demand.id}`}
              key={demand.id}
              lines={[
                `${demand.organization.name}・${getDemandServiceTypes(demand).join("、") || "尚未選服務類型"}`,
                `${demand.status === "submitted" ? "送審於" : "最後更新"} ${formatRelativeTime(demand.updatedAt, now)}`,
              ]}
              statusLabel={adminDemandStatusLabel(demand.status)}
              statusToneClass={adminDemandStatusToneClass(demand.status)}
              title={demand.title ?? "尚未命名的需求"}
            />
          ))}
        </section>
      )}
    </div>
  );
}
