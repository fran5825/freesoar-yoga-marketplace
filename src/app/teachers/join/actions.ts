"use server";

import {
  normalizeTeacherProfileDraftInput,
  type TeacherProfileDraftFormInput,
} from "@/domain/teacher-profile/input";
import {
  saveOwnTeacherProfileDraft,
  type TeacherProfileDraftSaveErrorCode,
  type TeacherProfileDraftSaveProfile,
} from "@/domain/teacher-profile/service";
import type { TeacherProfileValidationError } from "@/domain/teacher-profile/validation";

export type TeacherProfileDraftSaveActionProfile = Omit<
  TeacherProfileDraftSaveProfile,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type TeacherProfileDraftSaveActionResult =
  | {
      ok: true;
      profile: TeacherProfileDraftSaveActionProfile;
    }
  | {
      ok: false;
      code: TeacherProfileDraftSaveErrorCode;
      message: string;
      validationErrors?: TeacherProfileValidationError[];
    };

export async function saveTeacherProfileDraftAction(
  input: TeacherProfileDraftFormInput,
): Promise<TeacherProfileDraftSaveActionResult> {
  try {
    const normalizedInput = normalizeTeacherProfileDraftInput(input);
    const result = await saveOwnTeacherProfileDraft(normalizedInput);

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      profile: serializeTeacherProfileDraftSaveProfile(result.profile),
    };
  } catch {
    return {
      ok: false,
      code: "draft_save_failed",
      message: "草稿暫時無法儲存，請稍後再試。",
    };
  }
}

function serializeTeacherProfileDraftSaveProfile(
  profile: TeacherProfileDraftSaveProfile,
): TeacherProfileDraftSaveActionProfile {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
