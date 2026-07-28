import { notifyUsers } from "@/domain/notification/create";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { createEnrollmentForUser } from "./__internal__/create-enrollment-core";
import {
  type EnrollmentCreateInput,
  type EnrollmentValidationError,
  validateEnrollmentCreate,
} from "./validation";

export type CreateOwnEnrollmentErrorCode =
  | "authentication_required"
  | "validation_failed"
  | "class_session_not_found"
  | "class_session_not_open"
  | "class_session_already_started"
  | "class_session_full"
  | "already_enrolled"
  | "enrollment_create_failed";

export type CreateOwnEnrollmentResult =
  | { ok: true; enrollmentId: string }
  | {
      ok: false;
      code: CreateOwnEnrollmentErrorCode;
      message: string;
      validationErrors?: EnrollmentValidationError[];
    };

// D1/D5：Member own-scoped 建立，直接 confirmed（跳過 pending）。實際的鎖／原子
// capacity／重複報名檢查都在 __internal__ 的 pure 核心，這裡只負責把目前使用者
// 解析成受信任的 userId。
export async function createOwnEnrollment(
  classSessionId: string,
  input: EnrollmentCreateInput,
): Promise<CreateOwnEnrollmentResult> {
  const validation = validateEnrollmentCreate(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "報名前，請先確認以上資訊。",
      validationErrors: validation.errors,
    };
  }

  let userId: string;

  try {
    const currentUser = await requireUser();
    userId = currentUser.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再報名。",
      };
    }

    throw error;
  }

  const result = await createEnrollmentForUser(
    userId,
    classSessionId,
    validation.normalized,
  );

  if (result.ok) {
    return { ok: true, enrollmentId: result.enrollmentId };
  }

  if (result.code === "class_session_not_found") {
    return {
      ok: false,
      code: "class_session_not_found",
      message: "找不到這堂課程。",
    };
  }

  if (result.code === "class_session_not_open") {
    return {
      ok: false,
      code: "class_session_not_open",
      message: "這堂課程目前無法報名。",
    };
  }

  if (result.code === "class_session_already_started") {
    return {
      ok: false,
      code: "class_session_already_started",
      message: "這堂課程已經開始，無法報名。",
    };
  }

  if (result.code === "class_session_full") {
    return {
      ok: false,
      code: "class_session_full",
      message: "這堂課程名額已滿。",
    };
  }

  if (result.code === "already_enrolled") {
    return {
      ok: false,
      code: "already_enrolled",
      message: "你已經報名過這堂課程了。",
    };
  }

  return {
    ok: false,
    code: "enrollment_create_failed",
    message: "報名暫時無法完成，請稍後再試。",
  };
}

export type CancelOwnEnrollmentErrorCode =
  | "authentication_required"
  | "enrollment_not_found"
  | "class_session_already_started"
  | "enrollment_cancel_failed";

export type CancelOwnEnrollmentResult =
  | { ok: true }
  | {
      ok: false;
      code: CancelOwnEnrollmentErrorCode;
      message: string;
    };

// D8/D14：Member own-scoped 取消，只能在 startAt 之前自助取消——取消一堂已經開始的
// 課程的報名會抹除「這位 member 曾經是 confirmed 報名者」這筆歷史紀錄，且讓這筆
// enrollment 永遠無法在未來銜接 confirmed → attended/no_show，不是單純的「反悔空間」問題。
export async function cancelOwnEnrollment(
  enrollmentId: string,
): Promise<CancelOwnEnrollmentResult> {
  let userId: string;

  try {
    const currentUser = await requireUser();
    userId = currentUser.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再取消報名。",
      };
    }

    throw error;
  }

  const updateResult = await prisma.enrollment.updateMany({
    where: {
      id: enrollmentId,
      userId,
      status: "confirmed",
      classSession: { startAt: { gt: new Date() } },
    },
    data: { status: "cancelled" },
  });

  if (updateResult.count > 0) {
    try {
      const classSession = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { classSession: { select: { title: true } } },
      });

      await notifyUsers(
        "enrollment_cancelled",
        [{ userId, role: "self" }],
        { classSessionTitle: classSession?.classSession.title },
      );
    } catch (notifyError) {
      console.error("[notification] enrollment_cancelled trigger failed", notifyError);
    }

    return { ok: true };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, userId },
    select: { status: true, classSession: { select: { startAt: true } } },
  });

  if (!enrollment) {
    return {
      ok: false,
      code: "enrollment_not_found",
      message: "找不到這筆報名紀錄，或你沒有權限操作。",
    };
  }

  if (enrollment.classSession.startAt.getTime() <= Date.now()) {
    return {
      ok: false,
      code: "class_session_already_started",
      message: "這堂課程已經開始，無法取消報名。",
    };
  }

  return {
    ok: false,
    code: "enrollment_cancel_failed",
    message: "這筆報名目前狀態不允許取消。",
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
