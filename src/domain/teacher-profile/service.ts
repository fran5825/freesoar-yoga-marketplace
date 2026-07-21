import { getCurrentUser, requireAdmin, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import type { TeacherProfileStatus } from "./state";
import {
  validateTeacherProfileApproveTransition,
  validateTeacherProfileRejectTransition,
  validateTeacherProfileSubmitTransition,
} from "./state";
import {
  type TeacherProfileApplicationInput,
  type TeacherProfileRejectionReasonErrorCode,
  type TeacherProfileValidationError,
  validateTeacherProfileDraft,
  validateTeacherProfileRejectionReason,
} from "./validation";

export type TeacherProfileDraftSaveProfile = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  teachingStyle: string | null;
  experienceYears: number | null;
  certifications: string[];
  specialties: string[];
  serviceAreas: string[];
  teachingFormats: string[];
  priceRange: string | null;
  profilePhotoUrl: string | null;
  status: TeacherProfileStatus;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TeacherProfileDraftSaveErrorCode =
  | "authentication_required"
  | "draft_validation_failed"
  | "submitted_profile_cannot_save_draft"
  | "approved_profile_cannot_save_draft"
  | "suspended_profile_cannot_save_draft"
  | "draft_save_failed";

export type TeacherProfileDraftSaveResult =
  | {
      ok: true;
      profile: TeacherProfileDraftSaveProfile;
    }
  | {
      ok: false;
      code: TeacherProfileDraftSaveErrorCode;
      message: string;
      validationErrors?: TeacherProfileValidationError[];
    };

export type TeacherProfileSubmitProfile = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  teachingStyle: string | null;
  experienceYears: number | null;
  certifications: string[];
  specialties: string[];
  serviceAreas: string[];
  teachingFormats: string[];
  priceRange: string | null;
  profilePhotoUrl: string | null;
  status: TeacherProfileStatus;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TeacherProfileSubmitErrorCode =
  | "authentication_required"
  | "teacher_profile_draft_required"
  | "submit_validation_failed"
  | "submitted_profile_cannot_submit_again"
  | "approved_profile_cannot_submit_again"
  | "suspended_profile_cannot_submit"
  | "teacher_profile_submit_failed";

export type TeacherProfileSubmitResult =
  | {
      ok: true;
      profile: TeacherProfileSubmitProfile;
    }
  | {
      ok: false;
      code: TeacherProfileSubmitErrorCode;
      message: string;
      validationErrors?: TeacherProfileValidationError[];
    };

export type TeacherProfileApplicationSnapshot = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  teachingStyle: string | null;
  experienceYears: number | null;
  certifications: string[];
  specialties: string[];
  serviceAreas: string[];
  teachingFormats: string[];
  priceRange: string | null;
  profilePhotoUrl: string | null;
  status: TeacherProfileStatus;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubmittedTeacherProfileApplication = TeacherProfileApplicationSnapshot & {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export type TeacherProfileApproveErrorCode =
  | "admin_permission_required"
  | "teacher_profile_not_found"
  | "teacher_profile_not_submitted"
  | "teacher_profile_approve_failed";

export type TeacherProfileApproveResult =
  | {
      ok: true;
      profile: TeacherProfileApplicationSnapshot;
    }
  | {
      ok: false;
      code: TeacherProfileApproveErrorCode;
      message: string;
    };

export type TeacherProfileRejectErrorCode =
  | "admin_permission_required"
  | "teacher_profile_not_found"
  | "teacher_profile_not_submitted"
  | "rejection_reason_invalid"
  | "teacher_profile_reject_failed";

export type TeacherProfileRejectResult =
  | {
      ok: true;
      profile: TeacherProfileApplicationSnapshot;
    }
  | {
      ok: false;
      code: TeacherProfileRejectErrorCode;
      message: string;
      rejectionReasonError?: TeacherProfileRejectionReasonErrorCode;
    };

const teacherProfileDraftSelect = {
  id: true,
  userId: true,
  displayName: true,
  bio: true,
  teachingStyle: true,
  experienceYears: true,
  certifications: true,
  specialties: true,
  serviceAreas: true,
  teachingFormats: true,
  priceRange: true,
  profilePhotoUrl: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

const submittedTeacherProfileApplicationSelect = {
  ...teacherProfileDraftSelect,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
} as const;

export async function getOwnTeacherProfileApplicationSnapshot(): Promise<TeacherProfileApplicationSnapshot | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  return prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: teacherProfileDraftSelect,
  });
}

export async function listSubmittedTeacherProfileApplicationsForAdmin(): Promise<
  SubmittedTeacherProfileApplication[]
> {
  await requireAdmin();

  return prisma.teacherProfile.findMany({
    where: { status: "submitted" },
    orderBy: { updatedAt: "asc" },
    select: submittedTeacherProfileApplicationSelect,
  });
}

export async function saveOwnTeacherProfileDraft(
  input: TeacherProfileApplicationInput,
): Promise<TeacherProfileDraftSaveResult> {
  const validation = validateTeacherProfileDraft(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "draft_validation_failed",
      message: "草稿資料格式需要調整後才能儲存。",
      validationErrors: validation.errors,
    };
  }

  try {
    const currentUser = await requireUser();
    const existingProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: teacherProfileDraftSelect,
    });

    if (!existingProfile) {
      const profile = await prisma.teacherProfile.create({
        data: {
          userId: currentUser.id,
          ...toTeacherProfileDraftData(input),
          status: "draft",
        },
        select: teacherProfileDraftSelect,
      });

      return {
        ok: true,
        profile,
      };
    }

    if (
      existingProfile.status === "draft" ||
      existingProfile.status === "rejected"
    ) {
      const profile = await prisma.teacherProfile.update({
        where: { userId: currentUser.id },
        data: toTeacherProfileDraftData(input),
        select: teacherProfileDraftSelect,
      });

      return {
        ok: true,
        profile,
      };
    }

    return createStatusBlockedResult(existingProfile.status);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再儲存老師申請草稿。",
      };
    }

    return {
      ok: false,
      code: "draft_save_failed",
      message: "草稿暫時無法儲存，請稍後再試。",
    };
  }
}

export async function submitOwnTeacherProfileApplication(
  input: TeacherProfileApplicationInput,
): Promise<TeacherProfileSubmitResult> {
  try {
    const currentUser = await requireUser();
    const existingProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: teacherProfileDraftSelect,
    });

    if (!existingProfile) {
      return {
        ok: false,
        code: "teacher_profile_draft_required",
        message: "請先建立老師申請草稿後再送出審核。",
      };
    }

    const transition = validateTeacherProfileSubmitTransition(
      existingProfile.status,
      input,
    );

    if (!transition.allowed) {
      if (transition.code === "submit_validation_failed") {
        return {
          ok: false,
          code: "submit_validation_failed",
          message: "送出審核前，請先補齊必填的老師申請資料。",
          validationErrors: transition.validationErrors,
        };
      }

      if (
        existingProfile.status === "submitted" ||
        existingProfile.status === "approved" ||
        existingProfile.status === "suspended"
      ) {
        return createSubmitStatusBlockedResult(existingProfile.status);
      }

      return {
        ok: false,
        code: "teacher_profile_submit_failed",
        message: "老師申請暫時無法送出，請稍後再試。",
      };
    }

    const profile = await prisma.teacherProfile.update({
      where: { userId: currentUser.id },
      data: {
        ...toTeacherProfileDraftData(input),
        status: "submitted",
        // D4: rejected → submitted 重新送審時清空舊退回原因，審核中不再顯示。
        rejectionReason: null,
      },
      select: teacherProfileDraftSelect,
    });

    return {
      ok: true,
      profile,
    };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再送出老師申請。",
      };
    }

    return {
      ok: false,
      code: "teacher_profile_submit_failed",
      message: "老師申請暫時無法送出，請稍後再試。",
    };
  }
}

export async function approveSubmittedTeacherProfileApplication(
  teacherProfileId: string,
): Promise<TeacherProfileApproveResult> {
  try {
    await requireAdmin();

    const approveResult = await prisma.teacherProfile.updateMany({
      where: {
        id: teacherProfileId,
        status: "submitted",
      },
      // D4: approve 時清空退回原因，避免已通過的老師殘留舊 rejectionReason。
      data: { status: "approved", rejectionReason: null },
    });

    if (approveResult.count === 0) {
      const existingProfile = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: teacherProfileDraftSelect,
      });

      if (!existingProfile) {
        return {
          ok: false,
          code: "teacher_profile_not_found",
          message: "TeacherProfile application was not found.",
        };
      }

      const transition = validateTeacherProfileApproveTransition(
        existingProfile.status,
      );

      if (!transition.allowed) {
        return {
          ok: false,
          code: "teacher_profile_not_submitted",
          message:
            "Only submitted TeacherProfile applications can be approved.",
        };
      }
    }

    const profile = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
      select: teacherProfileDraftSelect,
    });

    return {
      ok: true,
      profile,
    };
  } catch (error) {
    if (isAdminPermissionRequiredError(error)) {
      return {
        ok: false,
        code: "admin_permission_required",
        message: "Admin permission is required to approve TeacherProfile.",
      };
    }

    return {
      ok: false,
      code: "teacher_profile_approve_failed",
      message: "TeacherProfile application could not be approved.",
    };
  }
}

export async function rejectSubmittedTeacherProfileApplication(
  teacherProfileId: string,
  rejectionReason: string | null | undefined,
): Promise<TeacherProfileRejectResult> {
  try {
    await requireAdmin();

    // D3: reason 必填、以 trim 後值驗證且持久化（10–1000 字）；權限先於 reason 檢查。
    const reasonValidation =
      validateTeacherProfileRejectionReason(rejectionReason);

    if (!reasonValidation.valid) {
      return {
        ok: false,
        code: "rejection_reason_invalid",
        message: reasonValidation.message,
        rejectionReasonError: reasonValidation.code,
      };
    }

    const rejectResult = await prisma.teacherProfile.updateMany({
      where: {
        id: teacherProfileId,
        status: "submitted",
      },
      data: {
        status: "rejected",
        rejectionReason: reasonValidation.normalizedReason,
      },
    });

    if (rejectResult.count === 0) {
      const existingProfile = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: teacherProfileDraftSelect,
      });

      if (!existingProfile) {
        return {
          ok: false,
          code: "teacher_profile_not_found",
          message: "TeacherProfile application was not found.",
        };
      }

      const transition = validateTeacherProfileRejectTransition(
        existingProfile.status,
      );

      if (!transition.allowed) {
        return {
          ok: false,
          code: "teacher_profile_not_submitted",
          message:
            "Only submitted TeacherProfile applications can be rejected.",
        };
      }
    }

    const profile = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
      select: teacherProfileDraftSelect,
    });

    return {
      ok: true,
      profile,
    };
  } catch (error) {
    if (isAdminPermissionRequiredError(error)) {
      return {
        ok: false,
        code: "admin_permission_required",
        message: "Admin permission is required to reject TeacherProfile.",
      };
    }

    return {
      ok: false,
      code: "teacher_profile_reject_failed",
      message: "TeacherProfile application could not be rejected.",
    };
  }
}

function toTeacherProfileDraftData(input: TeacherProfileApplicationInput) {
  return {
    displayName: input.displayName ?? null,
    bio: input.bio ?? null,
    teachingStyle: input.teachingStyle ?? null,
    experienceYears: input.experienceYears ?? null,
    certifications: input.certifications ?? [],
    specialties: input.specialties ?? [],
    serviceAreas: input.serviceAreas ?? [],
    teachingFormats: input.teachingFormats ?? [],
    priceRange: input.priceRange ?? null,
    profilePhotoUrl: input.profilePhotoUrl ?? null,
  };
}

function createStatusBlockedResult(
  status: Exclude<TeacherProfileDraftSaveProfile["status"], "draft" | "rejected">,
): TeacherProfileDraftSaveResult {
  if (status === "submitted") {
    return {
      ok: false,
      code: "submitted_profile_cannot_save_draft",
      message: "申請已送審，目前不能儲存草稿。",
    };
  }

  if (status === "approved") {
    return {
      ok: false,
      code: "approved_profile_cannot_save_draft",
      message: "已通過審核的老師資料需要走正式編輯流程。",
    };
  }

  return {
    ok: false,
    code: "suspended_profile_cannot_save_draft",
    message: "帳號目前暫停中，暫時不能儲存老師申請草稿。",
  };
}

function createSubmitStatusBlockedResult(
  status: Exclude<TeacherProfileSubmitProfile["status"], "draft" | "rejected">,
): TeacherProfileSubmitResult {
  if (status === "submitted") {
    return {
      ok: false,
      code: "submitted_profile_cannot_submit_again",
      message: "老師申請已送審，不能重複送出。",
    };
  }

  if (status === "approved") {
    return {
      ok: false,
      code: "approved_profile_cannot_submit_again",
      message: "已通過審核的老師資料不能重新送出申請。",
    };
  }

  return {
    ok: false,
    code: "suspended_profile_cannot_submit",
    message: "帳號目前暫停中，暫時不能送出老師申請。",
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}

function isAdminPermissionRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Authentication required" ||
      error.message === "Admin access required")
  );
}
