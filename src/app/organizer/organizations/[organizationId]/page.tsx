import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getOwnOrganization } from "@/domain/organization/service";
import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";
import { getCurrentUser } from "@/lib/auth/session";

import { OrganizationForm } from "../_components/OrganizationForm";

type OrganizationPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

// organizer-usability-redesign 票 03：編輯自己的單一團體。不是自己的團體（含不存在、孤立團體）一律 404。
// 從需求表單等流程被帶來補資料時，returnTo 記住要回去的站內頁面，儲存成功後直接回去。
export default async function OrganizationPage({ params, searchParams }: OrganizationPageProps) {
  const currentUser = await getCurrentUser();
  const [{ organizationId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  if (!currentUser) {
    // 票 04：登入後回到同一個團體編輯頁，並保留流程的返回路徑。
    const returnToParam = sanitizeOrganizerReturnPath(resolvedSearchParams?.returnTo);
    const here = returnToParam
      ? `/organizer/organizations/${organizationId}?returnTo=${encodeURIComponent(returnToParam)}`
      : `/organizer/organizations/${organizationId}`;
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(here)}`);
  }

  const organization = await getOwnOrganization(organizationId);

  if (!organization) {
    notFound();
  }

  const returnTo = sanitizeOrganizerReturnPath(resolvedSearchParams?.returnTo);
  const missingContactLabels = [
    { label: "聯絡窗口姓名", value: organization.contactName },
    { label: "聯絡信箱", value: organization.contactEmail },
    { label: "聯絡電話", value: organization.contactPhone },
  ]
    .filter((field) => !field.value || field.value.trim().length === 0)
    .map((field) => field.label);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link className="text-sm text-ink-soft underline underline-offset-4" href="/organizer/organizations">
          回到我的團體
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          {organization.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          修改後，用這個團體提出的需求與課程都會顯示最新的名稱與聯絡方式。
        </p>
      </header>

      {missingContactLabels.length > 0 ? (
        <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
          還缺 {missingContactLabels.length} 項聯絡資料：{missingContactLabels.join("、")}。送出需求審核前需要補齊。
        </div>
      ) : null}

      <section className="rounded-2xl border border-ink/15 bg-white p-6">
        <OrganizationForm
          initialValues={{
            name: organization.name,
            type: organization.type,
            contactName: organization.contactName ?? "",
            contactEmail: organization.contactEmail ?? "",
            contactPhone: organization.contactPhone ?? "",
          }}
          organizationId={organization.id}
          returnTo={returnTo}
          submitLabel={returnTo ? "儲存並回到剛剛的頁面" : "儲存"}
        />
      </section>
    </div>
  );
}
