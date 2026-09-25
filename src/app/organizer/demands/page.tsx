import Link from "next/link";
import { redirect } from "next/navigation";

import { getDemandNextStep } from "@/domain/demand-request/next-step";
import {
  getOwnDemandRequestList,
  type DemandRequestSnapshot,
} from "@/domain/demand-request/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import {
  demandRequestStatusLabels,
  demandRequestStatusToneClasses,
  formatDemandRequestDateTime,
} from "./_components/status-labels";

type DemandStatus = DemandRequestSnapshot["status"];

// 票 10：狀態篩選。把細分的狀態收成團主看得懂的幾組；「全部」不篩選。
const filterTabs: { key: string; label: string; statuses: DemandStatus[] | null }[] = [
  { key: "all", label: "全部", statuses: null },
  { key: "draft", label: "草稿", statuses: ["draft"] },
  { key: "reviewing", label: "審核中", statuses: ["submitted", "under_review"] },
  { key: "published", label: "已公開", statuses: ["published", "teacher_responded"] },
  {
    key: "matched",
    label: "已成案",
    statuses: ["matched", "converted_to_class", "completed"],
  },
  { key: "closed", label: "已結束", statuses: ["cancelled", "expired", "rejected"] },
];

type OrganizerDemandsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function OrganizerDemandsPage({
  searchParams,
}: OrganizerDemandsPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [organizerContext, demandRequests, resolvedSearchParams] =
    await Promise.all([
      getOwnOrganizerContext(),
      getOwnDemandRequestList(),
      searchParams,
    ]);

  const activeTab =
    filterTabs.find((tab) => tab.key === resolvedSearchParams?.status) ??
    filterTabs[0];
  const visibleDemandRequests = activeTab.statuses
    ? demandRequests.filter((demandRequest) =>
        activeTab.statuses?.includes(demandRequest.status),
      )
    : demandRequests;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          我的需求
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          這裡列出你提出過的所有團課需求，點進去可以看進度與下一步。
        </p>
      </header>

      {!organizerContext ? (
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
      ) : demandRequests.length === 0 ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">
            尚未提出任何需求
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            你可以先建立一筆需求草稿，準備好後再送出審核。
          </p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/demands/new"
            >
              建立新的需求
            </Link>
          </div>
        </section>
      ) : (
        <>
          <nav aria-label="需求狀態篩選" className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => {
              const count = tab.statuses
                ? demandRequests.filter((demandRequest) =>
                    tab.statuses?.includes(demandRequest.status),
                  ).length
                : demandRequests.length;
              const isActive = tab.key === activeTab.key;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isActive
                      ? "border-pine bg-pine-tint font-medium text-pine"
                      : "border-ink/20 text-ink-soft hover:border-ink/40"
                  }`}
                  href={
                    tab.key === "all"
                      ? "/organizer/demands"
                      : `/organizer/demands?status=${tab.key}`
                  }
                  key={tab.key}
                >
                  {tab.label}・{count}
                </Link>
              );
            })}
          </nav>

          {visibleDemandRequests.length === 0 ? (
            <p className="rounded-2xl border border-ink/15 bg-white p-6 text-sm leading-6 text-ink-soft">
              這個分類目前沒有需求。
            </p>
          ) : (
            <section className="grid gap-3">
              {visibleDemandRequests.map((demandRequest) => {
                const nextStep = getDemandNextStep({
                  status: demandRequest.status,
                });

                return (
                  <Link
                    className="grid gap-2 rounded-2xl border border-ink/15 bg-white p-5 transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                    href={`/organizer/demands/${demandRequest.id}`}
                    key={demandRequest.id}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="min-w-0 break-words text-lg font-semibold text-ink">
                        {demandRequest.title ?? "尚未命名的需求"}
                      </h2>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${demandRequestStatusToneClasses[demandRequest.status]}`}
                      >
                        {demandRequestStatusLabels[demandRequest.status]}
                      </span>
                    </div>
                    <p
                      className={`text-sm ${nextStep.kind === "action" ? "font-medium text-clay-deep" : "text-ink-soft"}`}
                    >
                      {nextStep.shortMessage}
                    </p>
                    <p className="text-xs text-ink-faint">
                      最後更新：
                      {formatDemandRequestDateTime(demandRequest.updatedAt)}
                    </p>
                  </Link>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
