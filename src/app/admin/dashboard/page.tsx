import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminDashboardKpis,
  listAdminPendingItems,
  type AdminPendingItem,
} from "@/domain/admin/dashboard-service";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { requireAdmin } from "@/lib/auth/session";

// admin-usability 票 03：最上方「待你處理」列出等最久的幾筆待審，整列可點；數字統計放在下面。
// 每一列直接連到該筆的審核詳情頁；「看全部」連到列表頁。
function PendingGroup({
  title,
  total,
  items,
  listHref,
  detailBasePath,
  kindLabel,
  now,
}: {
  title: string;
  total: number;
  items: AdminPendingItem[];
  listHref: string;
  detailBasePath: string;
  kindLabel: string;
  now: Date;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">
          {title}・{total}
        </h3>
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href={listHref}
        >
          {total > items.length ? `看全部 ${total} 筆 →` : "前往審核 →"}
        </Link>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              className="grid gap-1 rounded-xl border border-ink/15 bg-white px-4 py-3 transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
              href={`${detailBasePath}/${item.id}`}
            >
              <span className="min-w-0 break-words text-sm font-medium text-ink">
                {item.title}
                <span className="ml-2 font-normal text-ink-soft">
                  {item.subtitle ? `${item.subtitle}・` : ""}
                  {kindLabel}
                </span>
              </span>
              <span className="text-xs text-ink-faint">
                {formatRelativeTime(item.updatedAt, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminDashboardPage() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [kpis, pending] = await Promise.all([
    getAdminDashboardKpis(),
    listAdminPendingItems(),
  ]);
  const now = new Date();
  const hasPending =
    pending.teacherApplications.total > 0 || pending.demandRequests.total > 0;

  const stats = [
    { label: "已通過的老師", value: kpis.approvedTeachers },
    { label: "已公開的需求", value: kpis.publishedDemandRequests },
    { label: "已媒合的需求", value: kpis.matchedDemandRequests },
    { label: "即將開始的課程", value: kpis.upcomingClassSessions },
    { label: "已確認的報名", value: kpis.confirmedEnrollments },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">總覽</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          最上方是需要你審核的事，等最久的排在最前面。
        </p>
      </header>

      <section
        aria-labelledby="pending-title"
        className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-6"
      >
        <h2 className="text-xl font-semibold text-ink" id="pending-title">
          待你處理
        </h2>

        {hasPending ? (
          <>
            {pending.teacherApplications.total > 0 ? (
              <PendingGroup
                detailBasePath="/admin/teachers"
                items={pending.teacherApplications.items}
                kindLabel="老師申請"
                listHref="/admin/teachers"
                now={now}
                title="老師申請待審"
                total={pending.teacherApplications.total}
              />
            ) : null}
            {pending.demandRequests.total > 0 ? (
              <PendingGroup
                detailBasePath="/admin/demands"
                items={pending.demandRequests.items}
                kindLabel="需求待審"
                listHref="/admin/demands"
                now={now}
                title="需求待審"
                total={pending.demandRequests.total}
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink-soft">目前沒有待處理事項。</p>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold text-ink">數字概況</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              className="rounded-2xl border border-ink/15 bg-white p-5"
              key={stat.label}
            >
              <p className="text-sm font-medium text-ink">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
