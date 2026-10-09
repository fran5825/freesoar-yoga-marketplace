// teacher-class-scheduling 票 08：學員整期報名的 auth-resolving 外層。規則與鎖都在
// __internal__/create-series-enrollment-core.ts；這裡只把目前使用者解析成受信任的 userId，並把錯誤碼轉成文案。

import type { SeriesEnrollmentStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { addMakeupSessionForTeacher } from "@/domain/class-session/__internal__/add-makeup-session-core";
import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";

import {
  createSeriesEnrollmentForUser,
  type CreateSeriesEnrollmentErrorCode,
} from "./__internal__/create-series-enrollment-core";
import {
  confirmSeriesEnrollmentForTeacher,
  declineSeriesEnrollmentForTeacher,
} from "./__internal__/decide-series-enrollment-core";
import { withdrawSeriesEnrollmentForUser } from "./__internal__/withdraw-series-enrollment-core";
import { type EnrollmentCreateInput, validateEnrollmentCreate } from "./validation";

export type CreateOwnSeriesEnrollmentResult =
  | { ok: true; status: "pending" | "confirmed"; sessionCount: number }
  | {
      ok: false;
      code: CreateSeriesEnrollmentErrorCode | "authentication_required" | "validation_failed";
      message: string;
    };

export async function createOwnSeriesEnrollment(
  recurringClassSeriesId: string,
  input: EnrollmentCreateInput,
): Promise<CreateOwnSeriesEnrollmentResult> {
  const validation = validateEnrollmentCreate(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: ["報名前，請先確認以上資訊。", ...validation.errors.map((error) => error.message)].join(" "),
    };
  }

  let userId: string;

  try {
    userId = (await requireUser()).id;
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return { ok: false, code: "authentication_required", message: "請先登入後再報名整期。" };
    }

    throw error;
  }

  const result = await createSeriesEnrollmentForUser(userId, recurringClassSeriesId, validation.normalized);

  if (result.ok) {
    return { ok: true, status: result.status, sessionCount: result.sessionCount };
  }

  const at = result.sessionStartAt ? formatTaipeiShortDatetime(result.sessionStartAt) : "";
  const messages: Record<CreateSeriesEnrollmentErrorCode, string> = {
    series_not_found: "找不到這個期班。",
    series_not_term: "這個課程系列不是期班，請逐堂報名。",
    already_term_enrolled: "你已經報名過這一期，退出或被婉拒後不能再報整期。",
    term_no_remaining_sessions: "這一期的課都已經開始或結束了，無法再報整期。",
    term_not_fully_open: "這一期還有場次尚未開放報名，全部開放後才能報整期。",
    term_session_full: `${at} 那一堂已經額滿，暫時不能報整期。`,
    term_has_cancelled_enrollment: `你曾取消 ${at} 的報名，這一期無法再報整期。`,
    teacher_not_approved: "這位老師目前無法接受新報名。",
    create_failed: "整期報名暫時無法完成，請稍後再試。",
  };

  return { ok: false, code: result.code, message: messages[result.code] };
}

// teacher-class-scheduling 票 09：學員退出整期（本人）。
export type WithdrawOwnSeriesEnrollmentResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; message: string };

export async function withdrawOwnSeriesEnrollment(
  seriesEnrollmentId: string,
): Promise<WithdrawOwnSeriesEnrollmentResult> {
  let userId: string;

  try {
    userId = (await requireUser()).id;
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return { ok: false, message: "請先登入後再退出整期。" };
    }

    throw error;
  }

  const result = await withdrawSeriesEnrollmentForUser(userId, seriesEnrollmentId);

  if (result.ok) {
    return result;
  }

  return {
    ok: false,
    message:
      result.code === "series_enrollment_not_found"
        ? "找不到這筆整期報名，或你沒有權限操作。"
        : "這筆整期報名已經退出或被婉拒，不能再退出。",
  };
}

// teacher-class-scheduling 票 10：老師端的整期報名（own-scoped：系列必須是這位老師的）。
async function resolveTeacherProfileId(): Promise<string | null> {
  const currentUser = await requireUser();
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  return teacherProfile?.id ?? null;
}

export type DecideOwnSeriesEnrollmentResult = { ok: true; message: string } | { ok: false; message: string };

export async function decideSeriesEnrollmentAsTeacher(
  seriesEnrollmentId: string,
  decision: "confirm" | "decline",
): Promise<DecideOwnSeriesEnrollmentResult> {
  const teacherProfileId = await resolveTeacherProfileId();

  if (!teacherProfileId) {
    return { ok: false, message: "找不到你的老師資料。" };
  }

  const result =
    decision === "confirm"
      ? await confirmSeriesEnrollmentForTeacher(teacherProfileId, seriesEnrollmentId)
      : await declineSeriesEnrollmentForTeacher(teacherProfileId, seriesEnrollmentId);

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.code === "series_enrollment_not_found"
          ? "找不到這筆整期報名，或你沒有權限操作。"
          : "這筆整期報名已經處理過了。",
    };
  }

  if (decision === "confirm") {
    return { ok: true, message: `已確認整期報名，${result.affectedCount} 堂改為已報名。` };
  }

  return {
    ok: true,
    message:
      result.restoredSingleCount > 0
        ? `已婉拒整期報名，取消 ${result.affectedCount} 堂；學員原本單堂報名的 ${result.restoredSingleCount} 堂恢復為單堂。`
        : `已婉拒整期報名，取消 ${result.affectedCount} 堂。`,
  };
}

// teacher-class-scheduling 票 11：老師追加補課日期（規則與鎖在 add-makeup-session-core.ts）。
export async function addMakeupSessionAsTeacher(
  recurringClassSeriesId: string,
  date: string,
): Promise<DecideOwnSeriesEnrollmentResult> {
  const teacherProfileId = await resolveTeacherProfileId();

  if (!teacherProfileId) {
    return { ok: false, message: "找不到你的老師資料。" };
  }

  const result = await addMakeupSessionForTeacher(teacherProfileId, recurringClassSeriesId, date);

  if (result.ok) {
    const opened = result.openedForEnrollment ? "已開放報名" : "目前是草稿";
    return {
      ok: true,
      message:
        result.autoEnrolledCount > 0
          ? `已追加補課（${opened}），${result.autoEnrolledCount} 位整期學員自動報上並收到通知。`
          : `已追加補課（${opened}）。`,
    };
  }

  const messages: Record<typeof result.code, string> = {
    series_not_found: "找不到這個期班，或你沒有權限操作。",
    series_not_term: "只有期班可以追加補課日期；持續開課請用「生成更多」。",
    date_invalid: "請選擇補課日期。",
    date_not_future: "補課日期必須在未來。",
    too_many_sessions: "尚未開始的場次合計最多 26 堂，不能再追加。",
    capacity_below_term_members: `名額上限容不下全部 ${result.termMemberCount ?? 0} 位整期學員，請先調高人數上限再追加。`,
    teacher_schedule_conflict: result.conflictTitle
      ? `這個時段跟你的「${result.conflictTitle}」衝突，沒有建立。`
      : "這個時段跟你其他課程衝突，沒有建立。",
    teacher_not_approved: "老師資格暫停期間不能追加補課。",
  };

  return { ok: false, message: messages[result.code] };
}

export type TeacherTermEnrollmentView = {
  id: string;
  status: SeriesEnrollmentStatus;
  notes: string | null;
  memberLabel: string;
  // 尚未開始、仍有效的場次數；請假（已取消）的場次日期。
  activeUpcomingCount: number;
  leaveDates: Date[];
  // 婉拒時的影響：會取消幾堂（整期新增、未開始、有效），幾堂恢復為單堂（併入的）。
  declineCancelCount: number;
  declineRestoreCount: number;
};

export async function listOwnTermEnrollmentsForTeacher(
  recurringClassSeriesId: string,
): Promise<TeacherTermEnrollmentView[] | null> {
  const teacherProfileId = await resolveTeacherProfileId();

  if (!teacherProfileId) {
    return null;
  }

  const series = await prisma.recurringClassSeries.findFirst({
    where: { id: recurringClassSeriesId, teacherProfileId, kind: "term" },
    select: {
      seriesEnrollments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          notes: true,
          user: { select: { name: true, email: true } },
          enrollments: {
            select: {
              status: true,
              seriesEnrollmentSource: true,
              classSession: { select: { startAt: true } },
            },
          },
        },
      },
    },
  });

  if (!series) {
    return null;
  }

  const now = Date.now();

  return series.seriesEnrollments.map((seriesEnrollment) => {
    const upcoming = seriesEnrollment.enrollments.filter(
      (enrollment) => enrollment.classSession.startAt.getTime() > now,
    );
    const active = upcoming.filter(
      (enrollment) => enrollment.status === "pending" || enrollment.status === "confirmed",
    );

    return {
      id: seriesEnrollment.id,
      status: seriesEnrollment.status,
      notes: seriesEnrollment.notes,
      memberLabel: seriesEnrollment.user.name ?? seriesEnrollment.user.email ?? "會員",
      activeUpcomingCount: active.length,
      leaveDates: seriesEnrollment.enrollments
        .filter((enrollment) => enrollment.status === "cancelled")
        .map((enrollment) => enrollment.classSession.startAt)
        .sort((a, b) => a.getTime() - b.getTime()),
      declineCancelCount: active.filter((enrollment) => enrollment.seriesEnrollmentSource === "term_created")
        .length,
      declineRestoreCount: seriesEnrollment.enrollments.filter(
        (enrollment) => enrollment.seriesEnrollmentSource === "merged_single",
      ).length,
    };
  });
}
