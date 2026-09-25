import { redirect } from "next/navigation";

import { isOrganizationContactComplete } from "@/domain/demand-request/validation";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import { ContactIncompleteBanner } from "../_components/ContactIncompleteBanner";
import { blankDemandRequestFormValues } from "../_components/form-values";
import { DemandRequestForm } from "../_components/DemandRequestForm";
import { saveNewDemandRequestDraftAction, submitNewDemandRequestAction } from "./actions";

export default async function NewDemandRequestPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    redirect("/organizer/profile");
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

      {organizerContext.organization !== null &&
      isOrganizationContactComplete(organizerContext.organization) ? null : (
        <ContactIncompleteBanner returnPath="/organizer/demands/new" />
      )}

      <DemandRequestForm
        initialDemandRequestId={null}
        initialValues={blankDemandRequestFormValues}
        onSaveDraft={saveNewDemandRequestDraftAction}
        onSubmit={submitNewDemandRequestAction}
      />
    </div>
  );
}
