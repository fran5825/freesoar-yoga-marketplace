"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildCheckboxGroupValue } from "@/app/teachers/join/_lib/application-fields";
import { normalizeTeacherProfileDraftInput } from "@/domain/teacher-profile/input";
import { setOwnPublicPageEnabled } from "@/domain/teacher-profile/public-page-settings";
import { updateOwnTeacherProfile } from "@/domain/teacher-profile/service";

export async function updateTeacherProfileAction(formData: FormData): Promise<void> {
  const input = normalizeTeacherProfileDraftInput({
    displayName: readFormString(formData, "displayName"),
    bio: readFormString(formData, "bio"),
    teachingStyle: readFormString(formData, "teachingStyle"),
    experienceYears: readFormString(formData, "experienceYears"),
    certifications: readFormString(formData, "certifications"),
    specialties: readCheckboxGroupValue(formData, "specialties", "specialtiesOther"),
    serviceAreas: readCheckboxGroupValue(formData, "serviceAreas", "serviceAreasOther"),
    teachingFormats: readCheckboxGroupValue(
      formData,
      "teachingFormats",
      "teachingFormatsOther",
    ),
    priceRange: readFormString(formData, "priceRange"),
    preferredSessionLengthMinutes: readFormString(
      formData,
      "preferredSessionLengthMinutes",
    ),
    preferredFrequency: readCheckboxGroupValue(
      formData,
      "preferredFrequency",
      "preferredFrequencyOther",
    ),
    preferredLocationType: readCheckboxGroupValue(
      formData,
      "preferredLocationType",
      "preferredLocationTypeOther",
    ),
    preferenceNotes: readFormString(formData, "preferenceNotes"),
  });

  const result = await updateOwnTeacherProfile(input);

  revalidatePath("/teacher/profile/info");
  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "老師資料已儲存。");
}

// teacher-showcase-photos 票 06：老師自己決定要不要公開老師頁（預設關閉，隨時可以關）。
// teacher-first-run 票 07：開關從「照片」分頁搬到這裡，操作本身不變。
export async function setPublicPageAction(formData: FormData): Promise<void> {
  const enabled = readFormString(formData, "enabled") === "yes";
  const result = await setOwnPublicPageEnabled(enabled);

  revalidatePath("/teacher/profile/info");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", enabled ? "已公開你的老師頁。" : "已關閉老師頁，訪客不會再看到。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readCheckboxGroupValue(
  formData: FormData,
  name: string,
  otherName: string,
): string {
  const selectedValues = formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");

  return buildCheckboxGroupValue(selectedValues, readFormString(formData, otherName));
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/profile/info?result=${result}&message=${encodeURIComponent(message)}`);
}
