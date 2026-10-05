import Link from "next/link";
import { redirect } from "next/navigation";

import { listOwnOrganizations } from "@/domain/organization/service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

type OrganizationsPageProps = {
  searchParams?: Promise<{ saved?: string }>;
};

// organizer-usability-redesign 票 03：「我的團體」列表。只列出自己擁有的團體（owner 判斷），
// 首屏就能新增；每筆顯示聯絡資料是否完整，點進去編輯。不提供刪除、移交或共管。
export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/organizer/organizations")}`);
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    redirect("/organizer/profile");
  }

  const [organizations, resolvedSearchParams] = await Promise.all([
    listOwnOrganizations(),
    searchParams,
  ]);
  const savedOrganization = organizations.find(
    (organization) => organization.id === resolvedSearchParams?.saved,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-ink/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">我的團體</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            你代表的公司、社團或社區都可以放在這裡。提出需求或安排課程時，再選擇是為哪個團體開團。
          </p>
        </div>
        <Link
          className="inline-flex w-full justify-center rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto"
          href="/organizer/organizations/new"
        >
          ＋ 新增團體
        </Link>
      </header>

      {savedOrganization ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900 [overflow-wrap:anywhere]"
        >
          已儲存「{savedOrganization.name}」。
        </p>
      ) : null}

      {organizations.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6 text-sm leading-6 text-ink-soft">
          目前還沒有團體。新增一個團體，就能開始為它整理團課需求。
        </section>
      ) : (
        <ul className="grid gap-4">
          {organizations.map((organization) => (
            <li key={organization.id}>
              <Link
                className="block rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-pine/30"
                href={`/organizer/organizations/${organization.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 max-w-full text-lg font-semibold text-ink [overflow-wrap:anywhere]">
                    {organization.name}
                  </h2>
                  <span className="rounded-full bg-sand px-3 py-1 text-xs text-ink-soft">
                    {organizationTypeLabels[organization.type]}
                  </span>
                  {organization.isContactComplete ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                      聯絡資料完整
                    </span>
                  ) : (
                    <span className="rounded-full bg-clay-tint px-3 py-1 text-xs font-medium text-clay-deep">
                      還需要補聯絡資料
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
                  {organization.contactName ?? "尚未填寫聯絡窗口"}
                  {organization.contactEmail ? `・${organization.contactEmail}` : ""}
                </p>
                <span className="mt-3 inline-block text-sm font-medium text-pine">
                  編輯團體資料
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
