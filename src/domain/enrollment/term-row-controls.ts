// inline-member-actions 票 01（spec 3.1）：整期的某一堂那一列，要顯示「請假」「取消請假」還是說明文字。
// 在 service layer 一次算好，頁面只依結果顯示，三個地方（我的報名、期班頁、單堂頁的同系列列表）共用。
//
// 判斷依據分兩種：
//   - 有效報名（pending／confirmed）能不能請假：沿用 cancelOwnEnrollment 的資格——整期仍有效、課程沒取消也沒完成、尚未開始。
//   - 已請假的列（cancelled、cancelledBy = member）能不能取消請假：getReEnrollState（enrollment-re-enrollment spec 4.6）。
import type {
  ClassSessionStatus,
  EnrollmentCancelledBy,
  EnrollmentStatus,
  SeriesEnrollmentStatus,
  TermEnrollmentMode,
} from "@prisma/client";

import { getReEnrollState } from "./re-enroll-eligibility";

export type TermRowControl =
  | { kind: "none" }
  // 有效報名，可以請假。
  | { kind: "leave" }
  // 請假中：available＝可取消請假；其餘 note 是不能取消請假的原因文字。
  | { kind: "on_leave"; restore: "available" }
  | { kind: "on_leave"; restore: "unavailable"; note: string };

export type TermRowControlInput = {
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
};

export function getTermRowControl(input: TermRowControlInput): TermRowControl {
  if (input.seriesEnrollmentId === null) {
    return { kind: "none" };
  }

  const now = input.now ?? new Date();
  const seriesActive = input.seriesEnrollmentStatus === "pending" || input.seriesEnrollmentStatus === "confirmed";

  if (input.status === "pending" || input.status === "confirmed") {
    return seriesActive &&
      input.classStatus !== "cancelled" &&
      input.classStatus !== "completed" &&
      input.startAt.getTime() > now.getTime()
      ? { kind: "leave" }
      : { kind: "none" };
  }

  if (input.status !== "cancelled" || input.cancelledBy !== "member") {
    return { kind: "none" };
  }

  const state = getReEnrollState({
    status: input.status,
    cancelledBy: input.cancelledBy,
    seriesEnrollmentId: input.seriesEnrollmentId,
    seriesEnrollmentStatus: input.seriesEnrollmentStatus,
    termEnrollmentMode: input.termEnrollmentMode,
    classStatus: input.classStatus,
    startAt: input.startAt,
    capacity: input.capacity,
    occupiedCount: input.occupiedCount,
    teacherApproved: input.teacherApproved,
    now,
  });

  switch (state.state) {
    case "leave_available":
      return { kind: "on_leave", restore: "available" };
    case "leave_full":
      return { kind: "on_leave", restore: "unavailable", note: "這一堂名額已被報滿，請聯絡老師。" };
    case "teacher_unavailable":
      return { kind: "on_leave", restore: "unavailable", note: "這位老師目前無法接受新報名。" };
    case "started":
      return { kind: "on_leave", restore: "unavailable", note: "這堂課程已經開始或結束，無法取消請假。" };
    case "blocked":
      if (state.reason === "series_withdrawn") {
        return { kind: "on_leave", restore: "unavailable", note: "你已退出這一期，這一堂無法再報名。" };
      }

      if (state.reason === "series_declined") {
        return { kind: "on_leave", restore: "unavailable", note: "老師婉拒了你的整期報名，這一堂無法再報名。" };
      }

      return { kind: "on_leave", restore: "unavailable", note: "這一堂無法取消請假。" };
    default:
      return { kind: "on_leave", restore: "unavailable", note: "這一堂無法取消請假。" };
  }
}

// 有效整期仍可操作的請假（用來決定「我的報名」整期卡是否收進這一列）。
export function isActiveTermLeaveRow(input: { status: EnrollmentStatus; cancelledBy: EnrollmentCancelledBy | null; seriesEnrollmentStatus: SeriesEnrollmentStatus | null }): boolean {
  return (
    input.status === "cancelled" &&
    input.cancelledBy === "member" &&
    (input.seriesEnrollmentStatus === "pending" || input.seriesEnrollmentStatus === "confirmed")
  );
}
