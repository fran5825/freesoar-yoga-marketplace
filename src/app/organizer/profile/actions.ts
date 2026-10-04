"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  normalizeCreateOrganizerProfileInput,
  normalizeUpdateOwnOrganizerProfileInput,
} from "@/domain/organizer-profile/input";
import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";
import {
  createOwnOrganizerProfileWithOrganization,
  updateOwnOrganizerProfile,
} from "@/domain/organizer-profile/service";

// organizer-usability-redesign 票 03：表單改用 useActionState。失敗時回傳錯誤與使用者剛填的值，
// 留在原頁、不清空輸入；成功才導頁。
export type OrganizerFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  values: Record<string, string>;
};

const SIGNUP_FIELDS = [
  "displayName",
  "organizationName",
  "organizationType",
  "contactName",
  "contactEmail",
  "contactPhone",
] as const;

// 票 04：一頁式註冊，聯絡資料一起填；成功後直接進新需求表單（或 next 指定的頁面）。
export async function createOrganizerProfileAction(
  _previousState: OrganizerFormState,
  formData: FormData,
): Promise<OrganizerFormState> {
  const next = sanitizeOrganizerReturnPath(getStringField(formData, "next"));
  const values = pickValues(formData, SIGNUP_FIELDS);

  const normalizedInput = normalizeCreateOrganizerProfileInput({
    displayName: values.displayName,
    organizationName: values.organizationName,
    organizationType: values.organizationType,
    contactName: values.contactName,
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
  });

  const result = await createOwnOrganizerProfileWithOrganization(
    normalizedInput,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: buildErrorMessage(result.message, result.validationErrors),
      values,
    };
  }

  revalidatePath("/organizer/profile");
  redirect(next ?? "/organizer/demands/new");
}

// 票 03：團主資料頁只管理團主本人的顯示名稱；團體資料移到「我的團體」。
export async function saveOrganizerProfileAction(
  _previousState: OrganizerFormState,
  formData: FormData,
): Promise<OrganizerFormState> {
  const values = pickValues(formData, ["displayName"] as const);
  const profileInput = normalizeUpdateOwnOrganizerProfileInput({
    displayName: values.displayName,
  });

  if (!profileInput.displayName) {
    return { status: "error", message: "團主顯示名稱為必填欄位。", values };
  }

  const profileResult = await updateOwnOrganizerProfile(profileInput);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: buildErrorMessage(profileResult.message, profileResult.validationErrors),
      values,
    };
  }

  revalidatePath("/organizer/profile");

  return { status: "success", message: "團主資料已儲存。", values };
}

function pickValues<const T extends readonly string[]>(
  formData: FormData,
  fields: T,
): Record<T[number], string> {
  return Object.fromEntries(
    fields.map((field) => [field, getStringField(formData, field)]),
  ) as Record<T[number], string>;
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
