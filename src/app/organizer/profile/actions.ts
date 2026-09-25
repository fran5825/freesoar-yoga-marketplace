"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  normalizeCreateOrganizerProfileInput,
  normalizeUpdateOwnOrganizationInput,
  normalizeUpdateOwnOrganizerProfileInput,
} from "@/domain/organizer-profile/input";
import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";
import {
  createOwnOrganizerProfileWithOrganization,
  updateOwnOrganization,
  updateOwnOrganizerProfile,
} from "@/domain/organizer-profile/service";

// 票 04：一頁式註冊，聯絡資料一起填；成功後直接進新需求表單（或 next 指定的頁面）。
export async function createOrganizerProfileAction(
  formData: FormData,
): Promise<void> {
  const next = sanitizeOrganizerReturnPath(getStringField(formData, "next"));

  const normalizedInput = normalizeCreateOrganizerProfileInput({
    displayName: getStringField(formData, "displayName"),
    organizationName: getStringField(formData, "organizationName"),
    organizationType: getStringField(formData, "organizationType"),
    contactName: getStringField(formData, "contactName"),
    contactEmail: getStringField(formData, "contactEmail"),
    contactPhone: getStringField(formData, "contactPhone"),
  });

  const result = await createOwnOrganizerProfileWithOrganization(
    normalizedInput,
  );

  if (!result.ok) {
    redirectWithFeedback(
      "error",
      buildErrorMessage(result.message, result.validationErrors),
      next,
    );
  }

  revalidatePath("/organizer/profile");
  redirect(next ?? "/organizer/demands/new");
}

// 票 05：資料頁單一「儲存」，顯示名稱與組織資訊一次存。
// 先確認顯示名稱不是空的，再存組織，避免「組織存了、名稱沒存」的一半狀態。
export async function saveOrganizerProfileAction(
  formData: FormData,
): Promise<void> {
  const next = sanitizeOrganizerReturnPath(getStringField(formData, "next"));

  const profileInput = normalizeUpdateOwnOrganizerProfileInput({
    displayName: getStringField(formData, "displayName"),
  });

  if (!profileInput.displayName) {
    redirectWithFeedback("error", "團主顯示名稱為必填欄位。", next);
  }

  const organizationInput = normalizeUpdateOwnOrganizationInput({
    name: getStringField(formData, "name"),
    type: getStringField(formData, "type"),
    contactName: getStringField(formData, "contactName"),
    contactEmail: getStringField(formData, "contactEmail"),
    contactPhone: getStringField(formData, "contactPhone"),
  });

  const organizationResult = await updateOwnOrganization(organizationInput);

  if (!organizationResult.ok) {
    redirectWithFeedback(
      "error",
      buildErrorMessage(
        organizationResult.message,
        organizationResult.validationErrors,
      ),
      next,
    );
  }

  const profileResult = await updateOwnOrganizerProfile(profileInput);

  if (!profileResult.ok) {
    redirectWithFeedback(
      "error",
      buildErrorMessage(profileResult.message, profileResult.validationErrors),
      next,
    );
  }

  revalidatePath("/organizer/profile");

  if (next) {
    redirect(next);
  }

  redirectWithFeedback("success", "團主資料已儲存。", null);
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

function redirectWithFeedback(
  result: "success" | "error",
  message: string,
  next: string | null,
): never {
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";

  redirect(
    `/organizer/profile?result=${result}&message=${encodeURIComponent(message)}${nextParam}`,
  );
}
