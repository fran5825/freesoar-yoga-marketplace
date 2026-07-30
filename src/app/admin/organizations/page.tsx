import { notFound } from "next/navigation";

import { AdminNav } from "@/app/admin/_components/admin-nav";
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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Admin</p>
        <AdminNav />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Organizations
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          查看全平台所有團體，包含所屬團主與相關需求、課程數量。
        </p>
      </header>

      {organizations.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">目前沒有任何團體</h2>
        </section>
      ) : (
        <section className="grid gap-4">
          {organizations.map((organization) => (
            <article
              className="grid gap-4 rounded border border-gray-200 bg-white p-5"
              key={organization.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-xl font-semibold text-gray-950">
                  {organization.name}
                </h2>
                <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                  {organizationTypeLabels[organization.type]}
                </span>
              </div>

              <dl className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">Contact name</dt>
                  <dd className="mt-1 break-words">
                    {organization.contactName ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">Contact email</dt>
                  <dd className="mt-1 break-words">
                    {organization.contactEmail ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">Contact phone</dt>
                  <dd className="mt-1 break-words">
                    {organization.contactPhone ?? "未提供"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">Last updated</dt>
                  <dd className="mt-1">{formatDateTime(organization.updatedAt)}</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="font-medium text-gray-950">Organizers</dt>
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

              <div className="flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
                <span>需求數：{organization.demandRequestCount}</span>
                <span>課程數：{organization.classSessionCount}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
