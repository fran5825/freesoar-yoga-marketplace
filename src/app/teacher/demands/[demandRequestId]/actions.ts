"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeDemandResponseSubmitInput } from "@/domain/demand-response/input";
import {
  submitOwnDemandResponse,
  withdrawOwnDemandResponse,
} from "@/domain/demand-response/service";

export async function submitDemandResponseAction(
  formData: FormData,
): Promise<void> {
  const demandRequestId = readFormString(formData, "demandRequestId");
  const normalizedInput = normalizeDemandResponseSubmitInput({
    message: readFormString(formData, "message"),
    proposedTimeSlots: formData.getAll("proposedTimeSlots").map(String),
    proposedPrice: readFormString(formData, "proposedPrice"),
  });

  const result = await submitOwnDemandResponse(demandRequestId, normalizedInput);

  revalidatePath(`/teacher/demands/${demandRequestId}`);

  if (!result.ok) {
    redirectWithFeedback(
      demandRequestId,
      "error",
      buildErrorMessage(result.message, result.validationErrors),
    );
  }

  redirectWithFeedback(demandRequestId, "success", "回應已送出。");
}

export async function withdrawDemandResponseAction(
  formData: FormData,
): Promise<void> {
  const demandRequestId = readFormString(formData, "demandRequestId");
  const demandResponseId = readFormString(formData, "demandResponseId");

  const result = await withdrawOwnDemandResponse(demandResponseId);

  revalidatePath(`/teacher/demands/${demandRequestId}`);

  if (!result.ok) {
    redirectWithFeedback(demandRequestId, "error", result.message);
  }

  redirectWithFeedback(demandRequestId, "success", "回應已撤回。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function buildErrorMessage(
  message: string,
  validationErrors?: { message: string }[],
): string {
  if (!validationErrors || validationErrors.length === 0) {
    return message;
  }

  return [message, ...validationErrors.map((error) => error.message)].join(" ");
}

function redirectWithFeedback(
  demandRequestId: string,
  result: "success" | "error",
  message: string,
): never {
  redirect(
    `/teacher/demands/${demandRequestId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
