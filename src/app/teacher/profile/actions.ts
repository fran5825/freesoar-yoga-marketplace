"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildCheckboxGroupValue } from "@/app/teachers/join/_lib/application-fields";
import { normalizeTeacherProfileDraftInput } from "@/domain/teacher-profile/input";
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
    profilePhotoUrl: readFormString(formData, "profilePhotoUrl"),
    preferredSessionLengthMinutes: readFormString(
      formData,
      "preferredSessionLengthMinutes",
    ),
    preferredFrequency: readFormString(formData, "preferredFrequency"),
    preferredLocationType: readFormString(formData, "preferredLocationType"),
    preferenceNotes: readFormString(formData, "preferenceNotes"),
  });

  const result = await updateOwnTeacherProfile(input);

  revalidatePath("/teacher/profile");
  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "老師資料已儲存。");
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
  redirect(`/teacher/profile?result=${result}&message=${encodeURIComponent(message)}`);
}
