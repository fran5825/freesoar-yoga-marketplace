import { notFound } from "next/navigation";

import { listOrganizationsForAdmin } from "@/domain/organizer-profile/admin-service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminOrganizationsPage() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const organizations = await listOrganizationsForAdmin();

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

      {organizations.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有任何團體</h2>
        </section>
      ) : (
        <section className="grid gap-4">
          {organizations.map((organization) => (
            <article
              className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-5"
              key={organization.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-xl font-semibold text-ink">
                  {organization.name}
                </h2>
                <span className="w-fit rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink">
                  {organizationTypeLabels[organization.type]}
                </span>
              </div>

              <dl className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="font-medium text-ink">聯絡人</dt>
                  <dd className="mt-1 break-words">
                    {organization.contactName ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-ink">聯絡 Email</dt>
                  <dd className="mt-1 break-words">
                    {organization.contactEmail ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-ink">聯絡電話</dt>
                  <dd className="mt-1 break-words">
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
                    <ul className="mt-1 grid gap-1">
                      {organization.organizers.map((organizer) => (
                        <li className="break-words" key={organizer.id}>
                          {organizer.displayName}
                          {organizer.email ? `（${organizer.email}）` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <dd className="mt-1">無</dd>
                  )}
                </div>
              </dl>

              <div className="flex flex-wrap gap-4 border-t border-ink/10 pt-4 text-sm text-ink-soft">
                <span>需求數：{organization.demandRequestCount}</span>
                <span>課程數：{organization.classSessionCount}</span>
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
