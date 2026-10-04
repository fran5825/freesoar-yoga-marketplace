"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createOwnOrganization, updateOwnOrganization } from "@/domain/organization/service";
import { normalizeUpdateOwnOrganizationInput } from "@/domain/organizer-profile/input";
import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";

import type { OrganizerFormState } from "../profile/actions";

const ORGANIZATION_FIELDS = [
  "name",
  "type",
  "contactName",
  "contactEmail",
  "contactPhone",
] as const;

// organizer-usability-redesign 票 03：新增或編輯自己的團體。owner 由 server 判斷，
// organizationId 只用來指定要改哪一筆，不是自己的團體會被 service 擋下。
// 失敗時留在原頁並保留輸入；成功後回到 returnTo（允許的站內路徑）或我的團體列表。
export async function saveOrganizationAction(
  _previousState: OrganizerFormState,
  formData: FormData,
): Promise<OrganizerFormState> {
  const organizationId = getStringField(formData, "organizationId");
  const returnTo = sanitizeOrganizerReturnPath(getStringField(formData, "returnTo"));
  const values = Object.fromEntries(
    ORGANIZATION_FIELDS.map((field) => [field, getStringField(formData, field)]),
  ) as Record<(typeof ORGANIZATION_FIELDS)[number], string>;

  const input = normalizeUpdateOwnOrganizationInput(values);
  const result = organizationId
    ? await updateOwnOrganization(organizationId, input)
    : await createOwnOrganization(input);

  if (!result.ok) {
    const details = result.validationErrors?.map((error) => error.message) ?? [];
    return {
      status: "error",
      message: [result.message, ...details].join(" "),
      values,
    };
  }

  revalidatePath("/organizer/organizations");
  revalidatePath("/organizer/profile");

  redirect(returnTo ?? `/organizer/organizations?saved=${encodeURIComponent(result.organizationId)}`);
}

function getStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
