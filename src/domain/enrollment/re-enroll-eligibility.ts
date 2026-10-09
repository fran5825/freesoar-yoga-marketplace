// enrollment-re-enrollment 票 02、03（spec 4.2、4.3、4.6）：單堂頁「這筆已取消的報名能不能重新報名／取消請假」。
// 在 service layer 一次算好，頁面只依結果顯示，避免出現送出後必然失敗的表單；判斷條件對齊
// createEnrollmentForUser 與 restoreLeaveForUser 的檢查（開放報名、未開始、期班只收整期、老師 approved、名額、整期仍有效）。
import type {
  ClassSessionStatus,
  EnrollmentCancelledBy,
  EnrollmentStatus,
  SeriesEnrollmentStatus,
  TermEnrollmentMode,
} from "@prisma/client";

export type ReEnrollBlockedReason =
  | "teacher"
  | "admin"
  | "system"
  | "unknown"
  | "term_only"
  | "series_withdrawn"
  | "series_declined";

export type ReEnrollState =
  | { state: "not_cancelled" }
  // 單堂報名：可以重新報名／名額已滿。
  | { state: "available" }
  | { state: "full" }
  // 整期請假：可以取消請假／term_and_single 名額已被單堂報滿。
  | { state: "leave_available" }
  | { state: "leave_full" }
  | { state: "teacher_unavailable" }
  | { state: "started" }
  | { state: "blocked"; reason: ReEnrollBlockedReason };

export function getReEnrollState(input: {
  status: EnrollmentStatus;
  cancelledBy: EnrollmentCancelledBy | null;
  seriesEnrollmentId: string | null;
  seriesEnrollmentStatus: SeriesEnrollmentStatus | null;
  termEnrollmentMode: TermEnrollmentMode | null;
  classStatus: ClassSessionStatus | string;
  startAt: Date;
  capacity: number;
  // 占用名額（見 seat-occupancy.ts）。
  occupiedCount: number;
  teacherApproved: boolean;
  now?: Date;
}): ReEnrollState {
  if (input.status !== "cancelled") {
    return { state: "not_cancelled" };
  }

  if (input.cancelledBy !== "member") {
    return { state: "blocked", reason: input.cancelledBy ?? "unknown" };
  }

  const inTerm = input.seriesEnrollmentId !== null;

  if (inTerm) {
    // R8：整期退出或被婉拒之後沒有地方可以「回到」。
    if (input.seriesEnrollmentStatus === "withdrawn") {
      return { state: "blocked", reason: "series_withdrawn" };
    }

    if (input.seriesEnrollmentStatus === "declined") {
      return { state: "blocked", reason: "series_declined" };
    }

    if (input.seriesEnrollmentStatus !== "pending" && input.seriesEnrollmentStatus !== "confirmed") {
      return { state: "blocked", reason: "unknown" };
    }
  }

  if (input.classStatus !== "open_for_enrollment" || input.startAt.getTime() <= (input.now ?? new Date()).getTime()) {
    return { state: "started" };
  }

  if (!inTerm && input.termEnrollmentMode === "term_only") {
    return { state: "blocked", reason: "term_only" };
  }

  if (!input.teacherApproved) {
    return { state: "teacher_unavailable" };
  }

  if (inTerm) {
    // term_only 的請假名額一直保留，不需要名額檢查；term_and_single 的名額可能已被單堂報滿。
    return input.termEnrollmentMode !== "term_only" && input.occupiedCount >= input.capacity
      ? { state: "leave_full" }
      : { state: "leave_available" };
  }

  return input.occupiedCount >= input.capacity ? { state: "full" } : { state: "available" };
}
