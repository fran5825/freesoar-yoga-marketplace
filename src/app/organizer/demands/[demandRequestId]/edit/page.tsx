import { notFound, redirect } from "next/navigation";

import { getOwnDemandRequestDetail } from "@/domain/demand-request/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-amber-700">
          Organizer demand request
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          繼續編輯需求草稿
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          你可以繼續補齊這筆需求草稿，準備好後再送出審核。
        </p>
      </header>

      <DemandRequestForm
        initialDemandRequestId={demandRequest.id}
        initialValues={toDemandRequestFormValues(demandRequest)}
        onSaveDraft={saveEditDemandRequestDraftAction}
        onSubmit={submitEditDemandRequestAction}
      />
    </main>
  );
}
