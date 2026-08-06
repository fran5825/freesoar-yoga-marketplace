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
  | "teacher_not_approved"
  | "enrollment_create_failed";

export type CreateOwnEnrollmentResult =
  | { ok: true; enrollmentId: string; status: "confirmed" | "pending" }
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
    return { ok: true, enrollmentId: result.enrollmentId, status: result.status };
  }

  if (result.code === "teacher_not_approved") {
    return {
      ok: false,
      code: "teacher_not_approved",
      message: "這位老師目前無法接受新報名。",
    };
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

// D8/D14 + teacher-initiated-open-classes 第 8 節：Member own-scoped 取消，只能在 startAt
// 之前自助取消——取消一堂已經開始的課程的報名會抹除「這位 member 曾經是 confirmed 報名者」
// 這筆歷史紀錄，且讓這筆 enrollment 永遠無法在未來銜接 confirmed → attended/no_show，不是
// 單純的「反悔空間」問題。status 條件放寬為 confirmed／pending：會員應該也能自助取消還在
// 等待老師審核中的報名，不必等老師 decline。
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
      status: { in: ["confirmed", "pending"] },
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

// teacher-initiated-open-classes 第 8 節（Gate G2/G3）：老師 own-scoped 確認/拒絕 pending
// 報名，own-scope 判斷透過 classSession.teacherProfileId（單一 updateMany + 分類錯誤，
// 沒有多方競爭同一資源的併發場景，不需要 __internal__ 核心，比照
// openOwnClassSessionForEnrollmentForTeacher 的既有慣例）。含 startAt 時間邊界：課程已經
// 開始後，老師不能再確認或拒絕還卡在 pending 的報名——這種情況理論上不該出現（
// createEnrollmentForUser 本身已經擋掉已開始課程的新報名），但既有 pending 報名如果一直沒被
// 處理、課程就這樣開始了，此時確認/拒絕都不再有意義，統一擋下比放行更安全。
export type ConfirmPendingEnrollmentForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "enrollment_not_found"
  | "enrollment_not_pending"
  | "class_session_already_started"
  | "confirm_failed";

export type ConfirmPendingEnrollmentForTeacherResult =
  | { ok: true }
  | { ok: false; code: ConfirmPendingEnrollmentForTeacherErrorCode; message: string };

export async function confirmPendingEnrollmentForTeacher(
  enrollmentId: string,
): Promise<ConfirmPendingEnrollmentForTeacherResult> {
  let teacherProfileId: string;

  try {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return {
        ok: false,
        code: "teacher_profile_required",
        message: "找不到你的老師資料。",
      };
    }

    teacherProfileId = teacherProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再確認報名。",
      };
    }

    throw error;
  }

  const updateResult = await prisma.enrollment.updateMany({
    where: {
      id: enrollmentId,
      status: "pending",
      classSession: { teacherProfileId, startAt: { gt: new Date() } },
    },
    data: { status: "confirmed" },
  });

  if (updateResult.count > 0) {
    try {
      const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { userId: true, classSession: { select: { title: true } } },
      });

      if (enrollment) {
        await notifyUsers(
          "enrollment_confirmed",
          [{ userId: enrollment.userId, role: "self" }],
          { classSessionTitle: enrollment.classSession.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] enrollment_confirmed trigger failed", notifyError);
    }

    return { ok: true };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, classSession: { teacherProfileId } },
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
      message: "這堂課程已經開始，無法確認報名。",
    };
  }

  if (enrollment.status !== "pending") {
    return {
      ok: false,
      code: "enrollment_not_pending",
      message: "這筆報名目前不是等待審核狀態。",
    };
  }

  return {
    ok: false,
    code: "confirm_failed",
    message: "確認報名暫時無法完成，請稍後再試。",
  };
}

export type DeclinePendingEnrollmentForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "enrollment_not_found"
  | "enrollment_not_pending"
  | "class_session_already_started"
  | "decline_failed";

export type DeclinePendingEnrollmentForTeacherResult =
  | { ok: true }
  | { ok: false; code: DeclinePendingEnrollmentForTeacherErrorCode; message: string };

export async function declinePendingEnrollmentForTeacher(
  enrollmentId: string,
): Promise<DeclinePendingEnrollmentForTeacherResult> {
  let teacherProfileId: string;

  try {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return {
        ok: false,
        code: "teacher_profile_required",
        message: "找不到你的老師資料。",
      };
    }

    teacherProfileId = teacherProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再拒絕報名。",
      };
    }

    throw error;
  }

  const updateResult = await prisma.enrollment.updateMany({
    where: {
      id: enrollmentId,
      status: "pending",
      classSession: { teacherProfileId, startAt: { gt: new Date() } },
    },
    data: { status: "cancelled" },
  });

  if (updateResult.count > 0) {
    try {
      const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { userId: true, classSession: { select: { title: true } } },
      });

      if (enrollment) {
        // 老師 decline 後發送既有 enrollment_cancelled，不是新的事件類型——對會員來說，
        // 「報名沒有成立」在結果上跟一般取消是同一種通知內容。
        await notifyUsers(
          "enrollment_cancelled",
          [{ userId: enrollment.userId, role: "self" }],
          { classSessionTitle: enrollment.classSession.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] enrollment_cancelled trigger failed", notifyError);
    }

    return { ok: true };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, classSession: { teacherProfileId } },
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
      message: "這堂課程已經開始，無法拒絕報名。",
    };
  }

  if (enrollment.status !== "pending") {
    return {
      ok: false,
      code: "enrollment_not_pending",
      message: "這筆報名目前不是等待審核狀態。",
    };
  }

  return {
    ok: false,
    code: "decline_failed",
    message: "拒絕報名暫時無法完成，請稍後再試。",
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
