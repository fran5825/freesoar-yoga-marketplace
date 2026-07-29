import { requireAdmin } from "@/lib/auth/session";

import {
  cancelEnrollmentForAdminCore,
  type CancelEnrollmentForAdminResult as CoreCancelEnrollmentForAdminResult,
} from "./__internal__/cancel-enrollment-for-admin-core";

export type CancelEnrollmentForAdminErrorCode =
  | "admin_permission_required"
  | Extract<CoreCancelEnrollmentForAdminResult, { ok: false }>["code"];

export type CancelEnrollmentForAdminResult =
  | { ok: true }
  | { ok: false; code: CancelEnrollmentForAdminErrorCode; message: string };

const cancelEnrollmentErrorMessages: Record<
  Extract<CancelEnrollmentForAdminErrorCode, string>,
  string
> = {
  admin_permission_required: "需要 Admin 權限才能取消報名。",
  enrollment_not_found: "找不到這筆報名紀錄。",
  class_session_already_started: "這堂課程已經開始，無法取消報名。",
  enrollment_cancel_failed: "這筆報名目前狀態不允許取消。",
};

// D4/D5：Admin-scoped 取消單一 enrollment，資格條件跟既有 cancelOwnEnrollment 完全相同
// （status="confirmed" 且 classSession.startAt 尚未到達），只是拿掉 userId 過濾。
export async function cancelEnrollmentForAdmin(
  enrollmentId: string,
): Promise<CancelEnrollmentForAdminResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (isAdminPermissionRequiredError(error)) {
      return {
        ok: false,
        code: "admin_permission_required",
        message: cancelEnrollmentErrorMessages.admin_permission_required,
      };
    }

    throw error;
  }

  const result = await cancelEnrollmentForAdminCore(enrollmentId);

  if (result.ok) {
    return result;
  }

  return { ok: false, code: result.code, message: cancelEnrollmentErrorMessages[result.code] };
}

function isAdminPermissionRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Authentication required" || error.message === "Admin access required")
  );
}
