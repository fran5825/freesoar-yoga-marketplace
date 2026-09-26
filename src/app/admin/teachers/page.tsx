import { notFound } from "next/navigation";

import {
  listApprovedAndSuspendedTeacherProfilesForAdmin,
  listSubmittedTeacherProfileApplicationsForAdmin,
} from "@/domain/teacher-profile/service";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { requireAdmin } from "@/lib/auth/session";

import { AdminFilterBar, resolveActiveTab } from "../_components/AdminFilterBar";
import { AdminFlash, type AdminFlashParams } from "../_components/AdminFlash";
import { AdminListCard } from "../_components/AdminListCard";
import {
  adminTeacherStatusLabels,
  adminTeacherStatusToneClasses,
} from "./status-labels";

type TeacherStatus = keyof typeof adminTeacherStatusLabels;

// 票 06：預設停在「待審」，因為老師審核是管理員每天最常做的事；列表只放名稱、狀態、多久前、
// 服務地區，完整資料與審核按鈕都在詳情頁。列表只涵蓋 submitted／approved／suspended
// （草稿是老師私人資料、退回的申請不再需要處理，這兩種本來就不在列表裡）。
const statusTabs: { key: string; label: string; statuses: TeacherStatus[] | null }[] = [
  { key: "pending", label: "待審", statuses: ["submitted"] },
  { key: "approved", label: "已通過", statuses: ["approved"] },
  { key: "suspended", label: "已暫停", statuses: ["suspended"] },
  { key: "all", label: "全部", statuses: null },
];

const emptyMessages: Record<string, string> = {
  pending: "目前沒有待審核的老師申請。",
  approved: "目前沒有已通過的老師。",
  suspended: "目前沒有暫停中的老師。",
  all: "目前沒有任何老師。",
};

type AdminTeachersPageProps = {
  searchParams?: Promise<AdminFlashParams & { status?: string }>;
};

export default async function AdminTeachersPage({ searchParams }: AdminTeachersPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [submitted, approvedAndSuspended, resolvedSearchParams] = await Promise.all([
    listSubmittedTeacherProfileApplicationsForAdmin(),
    listApprovedAndSuspendedTeacherProfilesForAdmin(),
    searchParams,
  ]);

  const teachers = [...submitted, ...approvedAndSuspended];
  const now = new Date();

  const tabs = statusTabs.map((tab) => ({
    ...tab,
    count: tab.statuses
      ? teachers.filter((teacher) => tab.statuses?.includes(teacher.status)).length
      : teachers.length,
  }));
  const activeTab = resolveActiveTab(tabs, resolvedSearchParams?.status);
  // 待審的排最久的在前（先處理等最久的）；其他狀態最近更新的在前。
  const visibleTeachers = (
    activeTab.statuses
      ? teachers.filter((teacher) => activeTab.statuses?.includes(teacher.status))
      : teachers
  ).sort((a, b) => {
    if (activeTab.key === "pending") {
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">老師審核</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          審核老師申請，並管理已通過老師的狀態。點進老師可以看完整資料並操作。
        </p>
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      <AdminFilterBar
        activeKey={activeTab.key}
        ariaLabel="老師狀態篩選"
        basePath="/admin/teachers"
        tabs={tabs}
      />

      {visibleTeachers.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">{emptyMessages[activeTab.key]}</h2>
        </section>
      ) : (
        <section className="grid gap-3">
          {visibleTeachers.map((teacher) => (
            <AdminListCard
              href={`/admin/teachers/${teacher.id}`}
              key={teacher.id}
              lines={[
                `${teacher.serviceAreas.length > 0 ? teacher.serviceAreas.join("、") : "尚未填服務地區"}${
                  typeof teacher.experienceYears === "number"
                    ? `・教學 ${teacher.experienceYears} 年`
                    : ""
                }`,
                `${teacher.status === "submitted" ? "送審於" : "最後更新"} ${formatRelativeTime(teacher.updatedAt, now)}`,
              ]}
              statusLabel={adminTeacherStatusLabels[teacher.status]}
              statusToneClass={adminTeacherStatusToneClasses[teacher.status]}
              title={teacher.displayName ?? "未填顯示名稱"}
            />
          ))}
        </section>
      )}
    </div>
  );
}
