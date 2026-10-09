// enrollment-re-enrollment 票 04（spec 4.1「顯示用的取消原因」）：已取消的報名顯示成什麼原因。
// 不另存，由取消者、是否屬於整期、整期報名狀態與課程狀態推導；管理員後台使用。
import type { ClassSessionStatus, EnrollmentCancelledBy, EnrollmentStatus, SeriesEnrollmentStatus } from "@prisma/client";

export function describeEnrollmentCancelReason(input: {
  status: EnrollmentStatus;
  cancelledBy: EnrollmentCancelledBy | null;
  seriesEnrollmentId: string | null;
  seriesEnrollmentStatus: SeriesEnrollmentStatus | null;
  classSessionStatus: ClassSessionStatus;
}): string | null {
  if (input.status !== "cancelled") {
    return null;
  }

  switch (input.cancelledBy) {
    case "member":
      return input.seriesEnrollmentId ? "學員請假" : "學員取消";
    case "teacher":
      return "老師婉拒";
    case "admin":
      return "管理員取消";
    case "system":
      if (input.classSessionStatus === "cancelled") return "老師停課／課程取消";
      if (input.seriesEnrollmentStatus === "withdrawn") return "學員退出整期";
      return "系統取消";
    default:
      return "原因未記錄";
  }
}
