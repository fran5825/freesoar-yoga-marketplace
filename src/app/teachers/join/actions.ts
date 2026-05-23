"use server";

import {
  normalizeTeacherProfileDraftInput,
  type TeacherProfileDraftFormInput,
} from "@/domain/teacher-profile/input";
import {
  saveOwnTeacherProfileDraft,
  type TeacherProfileDraftSaveErrorCode,
  type TeacherProfileDraftSaveProfile,
  submitOwnTeacherProfileApplication,
  type TeacherProfileSubmitErrorCode,
  type TeacherProfileSubmitProfile,
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

export type TeacherProfileSubmitActionProfile = Omit<
  TeacherProfileSubmitProfile,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type TeacherProfileSubmitActionResult =
  | {
      ok: true;
      profile: TeacherProfileSubmitActionProfile;
    }
  | {
      ok: false;
      code: TeacherProfileSubmitErrorCode;
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

export async function submitTeacherProfileApplicationAction(
  input: TeacherProfileDraftFormInput,
): Promise<TeacherProfileSubmitActionResult> {
  try {
    const normalizedInput = normalizeTeacherProfileDraftInput(input);
    const result = await submitOwnTeacherProfileApplication(normalizedInput);

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      profile: serializeTeacherProfileSubmitProfile(result.profile),
    };
  } catch {
    return {
      ok: false,
      code: "teacher_profile_submit_failed",
      message: "老師申請暫時無法送出，請稍後再試。",
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

function serializeTeacherProfileSubmitProfile(
  profile: TeacherProfileSubmitProfile,
): TeacherProfileSubmitActionProfile {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
