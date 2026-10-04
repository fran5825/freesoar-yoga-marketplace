import { notFound } from "next/navigation";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import {
  listAllClassSessionsForAdmin,
  type AdminClassSessionSummary,
} from "@/domain/class-session/admin-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireAdmin } from "@/lib/auth/session";

import { AdminFilterBar, resolveActiveTab } from "../_components/AdminFilterBar";
import { AdminFlash, type AdminFlashParams } from "../_components/AdminFlash";
import { AdminListCard } from "../_components/AdminListCard";
import { AdminSearchForm, AdminListResults } from "../_components/AdminSearchForm";
import { adminDetailHref, adminListHref, matchesAdminSearch, normalizeAdminListQuery, sortAdminClasses } from "../_lib/list-context";

type ClassStatus = AdminClassSessionSummary["status"];

// D6（admin-class-enrollment-management）：ClassSession 從來不需要 Admin 核准才能推進
// 狀態，沒有天然的「待處理」子集，所以預設顯示「全部」；票 04 起用共用篩選列取代原本的分組長頁。
const statusTabs: { key: string; label: string; statuses: ClassStatus[] | null }[] = [
  { key: "all", label: "全部", statuses: null },
  { key: "open", label: "開放中", statuses: ["open_for_enrollment"] },
  { key: "completed", label: "已完成", statuses: ["completed"] },
  { key: "cancelled", label: "已取消", statuses: ["cancelled"] },
  { key: "draft", label: "草稿", statuses: ["draft"] },
];

type AdminClassesPageProps = {
  searchParams?: Promise<AdminFlashParams & { status?: string; q?: string }>;
};

export default async function AdminClassesPage({ searchParams }: AdminClassesPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [classSessions, resolvedSearchParams] = await Promise.all([
    listAllClassSessionsForAdmin(),
    searchParams,
  ]);

  const query = normalizeAdminListQuery("classes", resolvedSearchParams);
  const returnTo = adminListHref("classes", query);
  const searched = classSessions.filter((item) => matchesAdminSearch(query.q, [item.title, item.teacherDisplayName, item.organizerDisplayName, item.organizationName, item.location]));
  const processed = classSessions.find((item) => item.id === resolvedSearchParams?.item);
  const countOf = (statuses: ClassStatus[] | null) =>
    statuses
      ? searched.filter((classSession) => statuses.includes(classSession.status)).length
      : searched.length;
  const tabs = statusTabs.map((tab) => ({ ...tab, count: countOf(tab.statuses) }));
  const activeTab = resolveActiveTab(tabs, query.status);
  const visibleClassSessions = sortAdminClasses(activeTab.statuses
    ? searched.filter((classSession) => activeTab.statuses?.includes(classSession.status))
    : searched, new Date());

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">課程管理</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          查看全平台所有課程場次，並在必要時介入取消。
        </p>
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} detailHref={processed ? adminDetailHref("classes", processed.id, returnTo) : undefined} detailLabel={processed ? `查看 ${processed.title}` : undefined} />
      <AdminSearchForm kind="classes" query={query} label="搜尋課程" hint="標題、老師、團主、團體或地點" />
      <AdminFilterBar activeKey={activeTab.key} ariaLabel="課程狀態篩選" basePath="/admin/classes" tabs={tabs} q={query.q} />
      <AdminListResults count={visibleClassSessions.length} query={query} />

      {classSessions.length === 0 && !query.q ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有任何課程</h2>
        </section>
      ) : (
        <>
          {visibleClassSessions.length === 0 ? (
            <p className="rounded-2xl border border-ink/15 bg-white p-6 text-sm leading-6 text-ink-soft">
              {query.q ? "這個分類沒有符合搜尋條件的課程。" : "這個分類目前沒有課程。"}
            </p>
          ) : (
            <section className="grid gap-3">
              {visibleClassSessions.map((classSession) => (
                <AdminListCard
                  href={adminDetailHref("classes", classSession.id, returnTo)}
                  key={classSession.id}
                  lines={[
                    `${classSession.teacherDisplayName ?? "老師尚未填寫"}・${
                      classSession.organizationName ?? "（老師自建課程）"
                    }`,
                    `${formatTaipeiDatetime(classSession.startAt)}・已報名 ${classSession.confirmedEnrollmentCount} 人`,
                  ]}
                  statusLabel={classSessionStatusLabels[classSession.status]}
                  statusToneClass={classSessionStatusToneClasses[classSession.status]}
                  title={classSession.title}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
