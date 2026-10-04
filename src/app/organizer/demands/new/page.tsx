import { redirect } from "next/navigation";

import { listOwnOrganizations } from "@/domain/organization/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import { blankDemandRequestFormValues } from "../_components/form-values";
import { DemandRequestForm } from "../_components/DemandRequestForm";
import {
  pickInitialOrganizationId,
  toDemandRequestOrganizationOptions,
  withOrganizationParam,
} from "../_components/organization-options";
import { saveNewDemandRequestDraftAction, submitNewDemandRequestAction } from "./actions";

type NewDemandRequestPageProps = {
  searchParams?: Promise<{ organizationId?: string }>;
};

// organizer-usability-redesign 票 04：新需求先選自己的團體（只有一個時預選）。第一次儲存草稿後，
// 網址會換成這筆草稿的編輯頁；聯絡資料的提醒與「儲存並補齊」都在表單裡依所選團體顯示。
export default async function NewDemandRequestPage({ searchParams }: NewDemandRequestPageProps) {
  const resolvedSearchParams = await searchParams;

  try {
    await requireUser();
  } catch {
    // 票 04：登入後回到同一個新需求表單；保留從新增團體返回的預選（登入後仍會以 owner 驗證）。
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(withOrganizationParam("/organizer/demands/new", resolvedSearchParams?.organizationId))}`,
    );
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    redirect("/organizer/profile");
  }

  const organizations = await listOwnOrganizations();
  const initialOrganizationId = pickInitialOrganizationId(
    organizations,
    resolvedSearchParams?.organizationId,
    null,
  );

  if (!initialOrganizationId) {
    redirect(`/organizer/organizations/new?returnTo=${encodeURIComponent("/organizer/demands/new")}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          建立新的團課需求
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          你可以先儲存草稿，不需要一次填完；準備好後再送出，平台會先審核再公開給合適的老師。
        </p>
      </header>

      <DemandRequestForm
        initialDemandRequestId={null}
        initialOrganizationId={initialOrganizationId}
        initialValues={blankDemandRequestFormValues}
        onSaveDraft={saveNewDemandRequestDraftAction}
        onSubmit={submitNewDemandRequestAction}
        organizations={toDemandRequestOrganizationOptions(organizations)}
        savedOrganizationId={null}
      />
    </div>
  );
}
