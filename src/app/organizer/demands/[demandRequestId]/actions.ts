"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createOwnClassSession } from "@/domain/class-session/service";
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

export async function createClassSessionAction(formData: FormData): Promise<void> {
  const demandRequestId = readFormString(formData, "demandRequestId");

  const result = await createOwnClassSession(demandRequestId, {
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    serviceType: readFormString(formData, "serviceType"),
    startAt: readFormString(formData, "startAt"),
    endAt: readFormString(formData, "endAt"),
    location: readFormString(formData, "location"),
    capacity: readFormNumber(formData, "capacity"),
    isPublic: formData.get("isPublic") === "yes",
  });

  revalidatePath(`/organizer/demands/${demandRequestId}`);

  if (!result.ok) {
    redirectWithFeedback(
      demandRequestId,
      "error",
      buildErrorMessage(result.message, result.validationErrors),
    );
  }

  revalidatePath("/organizer/classes");
  redirect(
    `/organizer/classes/${result.classSessionId}?result=success&message=${encodeURIComponent("課程已建立。")}`,
  );
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readFormNumber(formData: FormData, name: string): number | null {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
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
    `/organizer/demands/${demandRequestId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
