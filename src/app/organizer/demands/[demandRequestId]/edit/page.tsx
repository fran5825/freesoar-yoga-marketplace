import { notFound, redirect } from "next/navigation";

import { getOwnDemandRequestDetail } from "@/domain/demand-request/service";
import { listOwnOrganizations } from "@/domain/organization/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import { toDemandRequestFormValues } from "../../_components/form-values";
import { DemandRequestForm } from "../../_components/DemandRequestForm";
import {
  pickInitialOrganizationId,
  toDemandRequestOrganizationOptions,
  withOrganizationParam,
} from "../../_components/organization-options";
import {
  saveEditDemandRequestDraftAction,
  submitEditDemandRequestAction,
} from "./actions";

type EditDemandRequestPageProps = {
  params: Promise<{ demandRequestId: string }>;
  searchParams?: Promise<{ organizationId?: string; flash?: string }>;
};

export default async function EditDemandRequestPage({
  params,
  searchParams,
}: EditDemandRequestPageProps) {
  const [{ demandRequestId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  try {
    await requireUser();
  } catch {
    // 票 04：登入後回到同一筆草稿；保留從新增團體返回的預選（登入後仍會以 owner 驗證）。
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(
        withOrganizationParam(
          `/organizer/demands/${demandRequestId}/edit`,
          resolvedSearchParams?.organizationId,
        ),
      )}`,
    );
  }

  const organizerContext = await getOwnOrganizerContext();

  if (!organizerContext) {
    redirect("/organizer/profile");
  }

  const demandRequest = await getOwnDemandRequestDetail(demandRequestId);

  if (!demandRequest) {
    notFound();
  }

  if (demandRequest.status !== "draft") {
    redirect(`/organizer/demands/${demandRequestId}`);
  }

  // organizer-usability-redesign 票 03／04：團體選項只有自己擁有的團體；預設選這筆需求目前的團體，
  // 從「新增團體」回來時改選剛建立的團體（尚未儲存，表單會提醒）。聯絡資料提醒在表單裡依所選團體顯示。
  const organizations = await listOwnOrganizations();
  const initialOrganizationId = pickInitialOrganizationId(
    organizations,
    resolvedSearchParams?.organizationId,
    demandRequest.organizationId,
  );

  if (!initialOrganizationId) {
    redirect("/organizer/organizations");
  }

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

      <DemandRequestForm
        initialDemandRequestId={demandRequest.id}
        initialOrganizationId={initialOrganizationId}
        initialValues={toDemandRequestFormValues(demandRequest)}
        onSaveDraft={saveEditDemandRequestDraftAction}
        onSubmit={submitEditDemandRequestAction}
        organizations={toDemandRequestOrganizationOptions(organizations)}
        initialFeedback={toInitialFeedback(resolvedSearchParams?.flash)}
        savedOrganizationId={demandRequest.organizationId}
      />
    </div>
  );
}

// 票 04：新需求第一次存檔（或送出前先存成草稿）後換到這一頁時，顯示一次結果提示。
// 只接受固定的代碼，不把網址上的文字直接顯示出來。
function toInitialFeedback(
  flash: string | undefined,
): { kind: "success" | "error"; message: string } | null {
  switch (flash) {
    case "saved":
      return { kind: "success", message: "草稿已儲存。" };
    case "organization_contact_incomplete":
      return {
        kind: "error",
        message: "草稿已儲存，但這個團體的聯絡資料還沒補齊，請先補齊聯絡資料，才能送出需求。",
      };
    case undefined:
      return null;
    default:
      return { kind: "error", message: "草稿已儲存，但需求暫時無法送出，請確認內容後再試一次。" };
  }
}
