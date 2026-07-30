"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeTeacherProfileDraftInput } from "@/domain/teacher-profile/input";
import { updateOwnTeacherProfile } from "@/domain/teacher-profile/service";

export async function updateTeacherProfileAction(formData: FormData): Promise<void> {
  const input = normalizeTeacherProfileDraftInput({
    displayName: readFormString(formData, "displayName"),
    bio: readFormString(formData, "bio"),
    teachingStyle: readFormString(formData, "teachingStyle"),
    experienceYears: readFormString(formData, "experienceYears"),
    certifications: readFormString(formData, "certifications"),
    specialties: readFormString(formData, "specialties"),
    serviceAreas: readFormString(formData, "serviceAreas"),
    teachingFormats: readFormString(formData, "teachingFormats"),
    priceRange: readFormString(formData, "priceRange"),
    profilePhotoUrl: readFormString(formData, "profilePhotoUrl"),
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

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/profile?result=${result}&message=${encodeURIComponent(message)}`);
}
