"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  normalizeCreateOrganizerProfileInput,
  normalizeUpdateOwnOrganizationInput,
  normalizeUpdateOwnOrganizerProfileInput,
} from "@/domain/organizer-profile/input";
import {
  createOwnOrganizerProfileWithOrganization,
  updateOwnOrganization,
  updateOwnOrganizerProfile,
} from "@/domain/organizer-profile/service";

export async function createOrganizerProfileAction(
  formData: FormData,
): Promise<void> {
  const normalizedInput = normalizeCreateOrganizerProfileInput({
    displayName: getStringField(formData, "displayName"),
    organizationName: getStringField(formData, "organizationName"),
    organizationType: getStringField(formData, "organizationType"),
  });

  const result = await createOwnOrganizerProfileWithOrganization(
    normalizedInput,
  );

  if (!result.ok) {
    redirectWithFeedback("error", buildErrorMessage(result.message, result.validationErrors));
  }

  revalidatePath("/organizer/profile");
  redirectWithFeedback("success", "團主資料已建立，你可以開始整理需求。");
}

export async function updateOrganizerProfileAction(
  formData: FormData,
): Promise<void> {
  const normalizedInput = normalizeUpdateOwnOrganizerProfileInput({
    displayName: getStringField(formData, "displayName"),
  });

  const result = await updateOwnOrganizerProfile(normalizedInput);

  if (!result.ok) {
    redirectWithFeedback("error", buildErrorMessage(result.message, result.validationErrors));
  }

  revalidatePath("/organizer/profile");
  redirectWithFeedback("success", "團主顯示名稱已更新。");
}

export async function updateOrganizationAction(
  formData: FormData,
): Promise<void> {
  const normalizedInput = normalizeUpdateOwnOrganizationInput({
    name: getStringField(formData, "name"),
    type: getStringField(formData, "type"),
    contactName: getStringField(formData, "contactName"),
    contactEmail: getStringField(formData, "contactEmail"),
    contactPhone: getStringField(formData, "contactPhone"),
  });

  const result = await updateOwnOrganization(normalizedInput);

  if (!result.ok) {
    redirectWithFeedback("error", buildErrorMessage(result.message, result.validationErrors));
  }

  revalidatePath("/organizer/profile");
  redirectWithFeedback("success", "組織資訊已更新。");
}

function getStringField(formData: FormData, name: string): string {
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

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(
    `/organizer/profile?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
