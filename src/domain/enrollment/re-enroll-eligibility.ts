// enrollment-re-enrollment 票 02（spec 4.2、4.6）：單堂頁「這筆已取消的報名能不能重新報名」。
// 在 service layer 一次算好，頁面只依結果顯示，避免出現送出後必然失敗的表單；判斷條件對齊
// createEnrollmentForUser 的檢查（開放報名、未開始、期班只收整期、老師 approved、名額）。
import type { ClassSessionStatus, EnrollmentCancelledBy, EnrollmentStatus } from "@prisma/client";

export type ReEnrollBlockedReason = "teacher" | "admin" | "system" | "unknown" | "member_in_term" | "term_only";

export type ReEnrollState =
  | { state: "not_cancelled" }
  | { state: "available" }
  | { state: "full" }
  | { state: "teacher_unavailable" }
  | { state: "started" }
  | { state: "blocked"; reason: ReEnrollBlockedReason };

export function getSingleReEnrollState(input: {
  status: EnrollmentStatus;
  cancelledBy: EnrollmentCancelledBy | null;
  seriesEnrollmentId: string | null;
  classStatus: ClassSessionStatus | string;
  startAt: Date;
  capacity: number;
  activeEnrollmentCount: number;
  teacherApproved: boolean;
  termOnly: boolean;
  now?: Date;
}): ReEnrollState {
  if (input.status !== "cancelled") {
    return { state: "not_cancelled" };
  }

  if (input.cancelledBy !== "member") {
    return { state: "blocked", reason: input.cancelledBy ?? "unknown" };
  }

  if (input.seriesEnrollmentId !== null) {
    return { state: "blocked", reason: "member_in_term" };
  }

  if (input.classStatus !== "open_for_enrollment" || input.startAt.getTime() <= (input.now ?? new Date()).getTime()) {
    return { state: "started" };
  }

  if (input.termOnly) {
    return { state: "blocked", reason: "term_only" };
  }

  if (!input.teacherApproved) {
    return { state: "teacher_unavailable" };
  }

  return input.activeEnrollmentCount >= input.capacity ? { state: "full" } : { state: "available" };
}
