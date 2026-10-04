import Link from "next/link";
import { redirect } from "next/navigation";

import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { OrganizationForm } from "../_components/OrganizationForm";

type NewOrganizationPageProps = {
  searchParams?: Promise<{ returnTo?: string }>;
};

// organizer-usability-redesign 票 03：新增團體。聯絡資料可以先不完整；需要團主資料才能新增，
// 還沒有團主資料的人先走 /organizer/profile 的一頁式首次建立。
export default async function NewOrganizationPage({ searchParams }: NewOrganizationPageProps) {
  const currentUser = await getCurrentUser();
  const returnTo = sanitizeOrganizerReturnPath((await searchParams)?.returnTo);

  if (!currentUser) {
    // 票 04：登入後回到同一個新增團體頁，並保留流程的返回路徑。
    const here = returnTo
      ? `/organizer/organizations/new?returnTo=${encodeURIComponent(returnTo)}`
      : "/organizer/organizations/new";
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(here)}`);
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    redirect("/organizer/profile");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link className="text-sm text-ink-soft underline underline-offset-4" href="/organizer/organizations">
          回到我的團體
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">新增團體</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          先填名稱與類型就能儲存；聯絡方式之後再補也可以。
        </p>
      </header>

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <OrganizationForm
          initialValues={{ name: "", type: "", contactName: "", contactEmail: "", contactPhone: "" }}
          organizationId={null}
          returnTo={returnTo}
          submitLabel={returnTo ? "儲存並回到剛剛的頁面" : "儲存團體"}
        />
      </section>
    </div>
  );
}
