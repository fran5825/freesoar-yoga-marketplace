import { requireApprovedTeacher } from "@/domain/teacher-profile/capability";
import { prisma } from "@/lib/prisma";

import {
  type AvailabilityExceptionInput,
  type AvailabilityExceptionValidationError,
  type TeacherAvailabilityInput,
  type TeacherAvailabilityValidationError,
  validateAvailabilityExceptionInput,
  validateTeacherAvailabilityInput,
} from "./validation";

export type CreateOwnTeacherAvailabilityErrorCode =
  | "authentication_required"
  | "approved_teacher_required"
  | "validation_failed"
  | "create_failed";

export type CreateOwnTeacherAvailabilityResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: CreateOwnTeacherAvailabilityErrorCode;
      message: string;
      validationErrors?: TeacherAvailabilityValidationError[];
    };

// D6/D7/D9：Teacher own-scoped，只有 approved 可以新增（新增可授課時段是對外的新承諾，
// 比照既有「suspended 不能回應新 demand request」的既有限制）。
export async function createOwnTeacherAvailability(
  input: TeacherAvailabilityInput,
): Promise<CreateOwnTeacherAvailabilityResult> {
  const validation = validateTeacherAvailabilityInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "新增前，請先確認以上資訊。",
      validationErrors: validation.errors,
    };
  }

  let teacherProfileId: string;

  try {
    const context = await requireApprovedTeacher();
    teacherProfileId = context.teacherProfileId;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再新增可授課時段。",
      };
    }

    return {
      ok: false,
      code: "approved_teacher_required",
      message: "需要通過審核的老師身份才能新增可授課時段。",
    };
  }

  try {
    const created = await prisma.teacherAvailability.create({
      data: {
        teacherProfileId,
        dayOfWeek: validation.normalized.dayOfWeek,
        startTime: validation.normalized.startTime,
        endTime: validation.normalized.endTime,
        locationArea: validation.normalized.locationArea,
      },
      select: { id: true },
    });

    return { ok: true, id: created.id };
  } catch {
    return {
      ok: false,
      code: "create_failed",
      message: "暫時無法新增，請稍後再試。",
    };
  }
}

export type DeleteOwnTeacherAvailabilityErrorCode =
  | "authentication_required"
  | "approved_teacher_required"
  | "not_found";

export type DeleteOwnTeacherAvailabilityResult =
  | { ok: true }
  | { ok: false; code: DeleteOwnTeacherAvailabilityErrorCode; message: string };

// D6/D7/D9：刪除比照既有 demand-response「withdraw」的既有限制，同樣只有 approved 可以做
// （suspended 可以查看既有資料，但不能新增或刪除，見 D9）。
export async function deleteOwnTeacherAvailability(
  availabilityId: string,
): Promise<DeleteOwnTeacherAvailabilityResult> {
  let teacherProfileId: string;

  try {
    const context = await requireApprovedTeacher();
    teacherProfileId = context.teacherProfileId;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再刪除可授課時段。",
      };
    }

    return {
      ok: false,
      code: "approved_teacher_required",
      message: "需要通過審核的老師身份才能刪除可授課時段。",
    };
  }

  const result = await prisma.teacherAvailability.deleteMany({
    where: { id: availabilityId, teacherProfileId },
  });

  if (result.count === 0) {
    return {
      ok: false,
      code: "not_found",
      message: "找不到這筆固定時段，或你沒有權限操作。",
    };
  }

  return { ok: true };
}

export type CreateOwnAvailabilityExceptionErrorCode =
  | "authentication_required"
  | "approved_teacher_required"
  | "validation_failed"
  | "create_failed";

export type CreateOwnAvailabilityExceptionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: CreateOwnAvailabilityExceptionErrorCode;
      message: string;
      validationErrors?: AvailabilityExceptionValidationError[];
    };

export async function createOwnAvailabilityException(
  input: AvailabilityExceptionInput,
): Promise<CreateOwnAvailabilityExceptionResult> {
  const validation = validateAvailabilityExceptionInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "新增前，請先確認以上資訊。",
      validationErrors: validation.errors,
    };
  }

  let teacherProfileId: string;

  try {
    const context = await requireApprovedTeacher();
    teacherProfileId = context.teacherProfileId;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再新增例外。",
      };
    }

    return {
      ok: false,
      code: "approved_teacher_required",
      message: "需要通過審核的老師身份才能新增例外。",
    };
  }

  try {
    const created = await prisma.availabilityException.create({
      data: {
        teacherProfileId,
        date: validation.normalized.date,
        type: validation.normalized.type,
        startTime: validation.normalized.startTime,
        endTime: validation.normalized.endTime,
        reason: validation.normalized.reason,
      },
      select: { id: true },
    });

    return { ok: true, id: created.id };
  } catch {
    return {
      ok: false,
      code: "create_failed",
      message: "暫時無法新增，請稍後再試。",
    };
  }
}

export type DeleteOwnAvailabilityExceptionErrorCode =
  | "authentication_required"
  | "approved_teacher_required"
  | "not_found";

export type DeleteOwnAvailabilityExceptionResult =
  | { ok: true }
  | { ok: false; code: DeleteOwnAvailabilityExceptionErrorCode; message: string };

export async function deleteOwnAvailabilityException(
  exceptionId: string,
): Promise<DeleteOwnAvailabilityExceptionResult> {
  let teacherProfileId: string;

  try {
    const context = await requireApprovedTeacher();
    teacherProfileId = context.teacherProfileId;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再刪除例外。",
      };
    }

    return {
      ok: false,
      code: "approved_teacher_required",
      message: "需要通過審核的老師身份才能刪除例外。",
    };
  }

  const result = await prisma.availabilityException.deleteMany({
    where: { id: exceptionId, teacherProfileId },
  });

  if (result.count === 0) {
    return {
      ok: false,
      code: "not_found",
      message: "找不到這筆例外，或你沒有權限操作。",
    };
  }

  return { ok: true };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
