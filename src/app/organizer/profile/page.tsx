import Link from "next/link";
import { redirect } from "next/navigation";

import { listOwnOrganizations } from "@/domain/organization/service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { OrganizerNameForm } from "./_components/OrganizerNameForm";
import { OrganizerSignupForm } from "./_components/OrganizerSignupForm";

type OrganizerProfilePageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

// 2026-09-25 organizer-usability 票 04：還沒有團主資料時，一頁填完（顯示名稱、第一個團體、聯絡方式），
// 送出後直接進新需求表單。
// organizer-usability-redesign 票 03：已有團主資料時，這頁只管團主本人的顯示名稱，團體資料移到「我的團體」。
// 舊的 `?next=` 補資料連結轉到預設團體的編輯頁，帶同一個返回路徑，流程不中斷。
export default async function OrganizerProfilePage({
  searchParams,
}: OrganizerProfilePageProps) {
  const [currentUser, resolvedSearchParams] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);
  const next = sanitizeOrganizerReturnPath(resolvedSearchParams?.next);

  // 票 10：未登入時登入後回到這頁，並保留要接著前往的流程。
  if (!currentUser) {
    const here = next ? `/organizer/profile?next=${encodeURIComponent(next)}` : "/organizer/profile";
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(here)}`);
  }

  const organizerContext = await getOwnOrganizerContext();

  if (organizerContext && next) {
    const target = organizerContext.organization
      ? `/organizer/organizations/${organizerContext.organization.id}`
      : "/organizer/organizations/new";
    redirect(`${target}?returnTo=${encodeURIComponent(next)}`);
  }

  const organizations = organizerContext ? await listOwnOrganizations() : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          團主資料
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {organizerContext
            ? "這裡是你本人的團主資料；你代表的團體與聯絡方式在「我的團體」管理。"
            : next?.startsWith("/organizer/class-proposals/")
              ? "填好這一頁就能接著安排課程、邀請合作老師，之後不用再補其他資料。"
              : "填好這一頁就能開始整理團課需求，之後不用再補其他資料。"}
        </p>
      </header>

      {!organizerContext ? (
        <section className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              建立你的團主資料
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              每位使用者僅能建立一組團主資料，之後可以再新增其他團體。平台不會事先審核你的身分，需求送出後才會審核。
            </p>
          </div>

          <OrganizerSignupForm
            defaultEmail={currentUser.email ?? ""}
            defaultName={currentUser.name ?? ""}
            next={next}
          />
        </section>
      ) : (
        <>
          <section className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-6">
            <h2 className="text-xl font-semibold text-ink">你的稱呼</h2>
            <OrganizerNameForm displayName={organizerContext.organizerProfile.displayName} />
          </section>

          <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">我的團體</h2>
              <Link
                className="text-sm font-medium text-pine underline underline-offset-4"
                href="/organizer/organizations"
              >
                管理我的團體
              </Link>
            </div>
            {organizations.length === 0 ? (
              <p className="text-sm leading-6 text-ink-soft">目前還沒有團體。</p>
            ) : (
              <ul className="grid gap-2">
                {organizations.map((organization) => (
                  <li
                    className="flex flex-wrap items-center gap-2 text-sm leading-6 text-ink"
                    key={organization.id}
                  >
                    <Link
                      className="min-w-0 max-w-full font-medium underline underline-offset-4 [overflow-wrap:anywhere]"
                      href={`/organizer/organizations/${organization.id}`}
                    >
                      {organization.name}
                    </Link>
                    <span className="text-ink-soft">
                      {organizationTypeLabels[organization.type]}
                    </span>
                    {organization.isContactComplete ? null : (
                      <span className="rounded-full bg-clay-tint px-3 py-0.5 text-xs font-medium text-clay-deep">
                        還需要補聯絡資料
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
