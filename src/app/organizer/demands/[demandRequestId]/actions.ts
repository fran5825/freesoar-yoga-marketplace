"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { selectDemandResponse } from "@/domain/demand-response/organizer-select-service";

export async function selectDemandResponseAction(
  formData: FormData,
): Promise<void> {
  const demandRequestId = readFormString(formData, "demandRequestId");
  const demandResponseId = readFormString(formData, "demandResponseId");

  const result = await selectDemandResponse(demandResponseId);

  revalidatePath(`/organizer/demands/${demandRequestId}`);

  if (!result.ok) {
    redirectWithFeedback(demandRequestId, "error", result.message);
  }

  redirectWithFeedback(demandRequestId, "success", "已選定這位老師。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(
  demandRequestId: string,
  result: "success" | "error",
  message: string,
): never {
  redirect(
    `/organizer/demands/${demandRequestId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
