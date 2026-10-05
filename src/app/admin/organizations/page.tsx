import Link from "next/link";
import { notFound } from "next/navigation";

import { listOrganizationsForAdmin } from "@/domain/organizer-profile/admin-service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { requireAdmin } from "@/lib/auth/session";
import { AdminSearchForm, AdminListResults } from "../_components/AdminSearchForm";
import { adminListHref, matchesAdminSearch, normalizeAdminListQuery, type AdminListQuery } from "../_lib/list-context";

export default async function AdminOrganizationsPage({ searchParams }: { searchParams?: Promise<AdminListQuery> }) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const organizations = await listOrganizationsForAdmin();
  const query = normalizeAdminListQuery("organizations", await searchParams);
  const searched = organizations.filter((item) => matchesAdminSearch(query.q, [item.name, item.contactName, item.contactEmail, ...item.organizers.map((organizer) => organizer.displayName)]));

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          團體
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          查看全平台所有團體，包含所屬團主與相關需求、課程數量。
        </p>
      </header>

      <AdminSearchForm kind="organizations" query={query} label="搜尋團體" hint="團體名稱、聯絡人、聯絡 email 或團主姓名" />
      <AdminListResults count={searched.length} query={query} />
      {searched.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">{query.q ? "沒有符合搜尋條件的團體。" : "目前沒有任何團體"}</h2>
        </section>
      ) : (
        <section className="grid gap-4">
          {searched.map((organization) => (
            <article
              className="grid min-w-0 gap-4 rounded-2xl border border-ink/15 bg-white p-5"
              key={organization.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 wrap-anywhere text-xl font-semibold text-ink">
                  {organization.name}
                </h2>
                <span className="w-fit rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink">
                  {organizationTypeLabels[organization.type]}
                </span>
              </div>

              <dl className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="font-medium text-ink">聯絡人</dt>
                  <dd className="mt-1 wrap-anywhere">
                    {organization.contactName ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-ink">聯絡 Email</dt>
                  <dd className="mt-1 wrap-anywhere">
                    {organization.contactEmail ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-ink">聯絡電話</dt>
                  <dd className="mt-1 wrap-anywhere">
                    {organization.contactPhone ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-ink">最後更新</dt>
                  <dd className="mt-1">{formatDateTime(organization.updatedAt)}</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="font-medium text-ink">團主</dt>
                  {organization.organizers.length > 0 ? (
                    <dd className="mt-1">
                      <ul className="grid gap-1">
                        {organization.organizers.map((organizer) => (
                          <li className="wrap-anywhere" key={organizer.id}>
                            {organizer.displayName}
                            {organizer.email ? `（${organizer.email}）` : ""}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  ) : (
                    <dd className="mt-1">無</dd>
                  )}
                </div>
              </dl>

              {/* 第三批票 09：數量 > 0 才給入口（不做死連結）；需求數只算非草稿，與限定列表「全部」一致。 */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-ink/10 pt-4 text-sm text-ink-soft">
                {organization.demandRequestCount > 0 ? (
                  <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref("demands", { status: "all", organizationId: organization.id })}>
                    查看需求（{organization.demandRequestCount}）
                  </Link>
                ) : (
                  <span>需求數：0</span>
                )}
                {organization.classSessionCount > 0 ? (
                  <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref("classes", { organizationId: organization.id })}>
                    查看課程（{organization.classSessionCount}）
                  </Link>
                ) : (
                  <span>課程數：0</span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
