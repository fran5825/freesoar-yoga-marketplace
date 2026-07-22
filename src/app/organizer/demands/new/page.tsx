import { redirect } from "next/navigation";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

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
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-amber-700">
          Organizer demand request
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          建立新的團課需求
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          你可以先儲存草稿，不需要一次填完；準備好後再送出，平台會先審核再公開給合適的老師。
        </p>
      </header>

      <DemandRequestForm
        initialDemandRequestId={null}
        initialValues={blankDemandRequestFormValues}
        onSaveDraft={saveNewDemandRequestDraftAction}
        onSubmit={submitNewDemandRequestAction}
      />
    </main>
  );
}
