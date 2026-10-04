import { notFound, redirect } from "next/navigation";

import { getOwnDemandRequestDetail } from "@/domain/demand-request/service";
import { getOwnOrganization } from "@/domain/organization/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import { ContactIncompleteBanner } from "../../_components/ContactIncompleteBanner";
import { toDemandRequestFormValues } from "../../_components/form-values";
import { DemandRequestForm } from "../../_components/DemandRequestForm";
import {
  saveEditDemandRequestDraftAction,
  submitEditDemandRequestAction,
} from "./actions";

type EditDemandRequestPageProps = {
  params: Promise<{ demandRequestId: string }>;
};

export default async function EditDemandRequestPage({
  params,
}: EditDemandRequestPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    redirect("/organizer/profile");
  }

  const { demandRequestId } = await params;
  const demandRequest = await getOwnDemandRequestDetail(demandRequestId);

  if (!demandRequest) {
    notFound();
  }

  if (demandRequest.status !== "draft") {
    redirect(`/organizer/demands/${demandRequestId}`);
  }

  // organizer-usability-redesign 票 03：聯絡資料完整度看這筆需求自己的團體（經 owner 驗證），
  // 與送審時的檢查、補資料連結指向同一個團體。
  const demandOrganization = await getOwnOrganization(demandRequest.organizationId);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          繼續編輯需求草稿
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          你可以繼續補齊這筆需求草稿，準備好後再送出審核。
        </p>
      </header>

      {demandOrganization?.isContactComplete ? null : (
        <ContactIncompleteBanner
          organizationId={demandOrganization?.id ?? null}
          returnPath={`/organizer/demands/${demandRequestId}/edit`}
        />
      )}

      <DemandRequestForm
        initialDemandRequestId={demandRequest.id}
        initialValues={toDemandRequestFormValues(demandRequest)}
        onSaveDraft={saveEditDemandRequestDraftAction}
        onSubmit={submitEditDemandRequestAction}
      />
    </div>
  );
}
