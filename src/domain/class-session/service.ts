import { notifyUsers } from "@/domain/notification/create";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { cancelClassSessionForOrganizer } from "./__internal__/cancel-class-session-core";
import { cancelClassSessionForTeacher } from "./__internal__/cancel-class-session-core-for-teacher";
import {
  openClassSessionForEnrollmentForTeacher,
  type OpenClassSessionForTeacherErrorCode,
} from "./__internal__/open-class-session-core-for-teacher";
import { completeClassSessionForTeacher } from "./__internal__/complete-class-session-core-for-teacher";
import { createClassSessionForOrganizer } from "./__internal__/create-class-session-core";
import {
  createClassSessionForTeacher,
  type CreateTeacherClassSessionInput,
} from "./__internal__/create-teacher-class-session-core";
import {
  generateOccurrencesForSeries,
  type OccurrenceSkip,
} from "./__internal__/generate-recurring-occurrences-core";
import { cancelSeriesFromOccurrenceForTeacherProfile } from "./__internal__/cancel-series-from-occurrence-core";
import {
  editSeriesFromOccurrenceForTeacher,
  type EditSeriesFromOccurrenceInput,
} from "./__internal__/edit-series-from-occurrence-core";
import {
  editClassSessionForTeacher,
  type EditClassSessionForTeacherErrorCode,
  type EditClassSessionForTeacherInput,
} from "./__internal__/edit-class-session-core-for-teacher";
import {
  openAllDraftOccurrencesForTeacherProfile,
  type OpenAllDraftOccurrencesForTeacherResult,
} from "./__internal__/open-all-draft-occurrences-core";
import {
  computeNextWeeklyOccurrenceDates,
  weeklyAfterDateForStartDate,
} from "./recurring-series-dates";
import { formatTaipeiShortDatetime } from "./timezone";
import {
  WEEKLY_GENERATE_COUNT_MAX,
  WEEKLY_GENERATE_COUNT_MIN,
  validateRecurringSeriesInput,
  type RecurringSeriesInput,
  type RecurringSeriesValidationError,
} from "./recurring-series-validation";
import {
  type ClassSessionCreateInput,
  type ClassSessionValidationError,
  validateClassSessionCreate,
} from "./validation";

export type CreateOwnClassSessionErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "validation_failed"
  | "demand_not_found"
  | "demand_not_matched"
  | "demand_not_ready"
  | "class_session_already_exists"
  | "teacher_schedule_conflict"
  | "class_session_create_failed";

export type CreateOwnClassSessionResult =
  | { ok: true; classSessionId: string }
  | {
      ok: false;
      code: CreateOwnClassSessionErrorCode;
      message: string;
      validationErrors?: ClassSessionValidationError[];
    };

// D1/D2：Organizer own-scoped，一次到位建立。實際的鎖／原子建立／converted_to_class
// 邏輯都在 __internal__ 的 pure 核心，這裡只負責把目前使用者解析成受信任的 organizerProfileId。
export async function createOwnClassSession(
  demandRequestId: string,
  input: ClassSessionCreateInput,
): Promise<CreateOwnClassSessionResult> {
  const validation = validateClassSessionCreate(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "建立課程前，請先補齊必填欄位。",
      validationErrors: validation.errors,
    };
  }

  let organizerProfileId: string;

  try {
    const currentUser = await requireUser();

    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!organizerProfile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "找不到你的團主資料。",
      };
    }

    organizerProfileId = organizerProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再建立課程。",
      };
    }

    throw error;
  }

  const result = await createClassSessionForOrganizer(
    organizerProfileId,
    demandRequestId,
    validation.normalized,
  );

  if (result.ok) {
    return { ok: true, classSessionId: result.classSessionId };
  }

  if (result.code === "demand_not_found") {
    return {
      ok: false,
      code: "demand_not_found",
      message: "找不到這則需求，或你沒有權限操作。",
    };
  }

  if (result.code === "class_session_already_exists") {
    return {
      ok: false,
      code: "class_session_already_exists",
      message: "這則需求已經建立過課程了。",
    };
  }

  if (result.code === "demand_not_matched") {
    return {
      ok: false,
      code: "demand_not_matched",
      message: "這則需求目前狀態不允許建立課程。",
    };
  }

  if (result.code === "demand_not_ready") {
    return {
      ok: false,
      code: "demand_not_ready",
      message: "這則需求尚未選定老師，請稍後再試。",
    };
  }

  if (result.code === "teacher_schedule_conflict") {
    return {
      ok: false,
      code: "teacher_schedule_conflict",
      message: "這位老師在這個時段已經有其他課程。",
    };
  }

  return {
    ok: false,
    code: "class_session_create_failed",
    message: "課程暫時無法建立，請稍後再試。",
  };
}

export type OpenOwnClassSessionForEnrollmentErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "class_session_not_found"
  | "class_session_not_draft"
  | "class_session_already_started";

export type OpenOwnClassSessionForEnrollmentResult =
  | { ok: true }
  | {
      ok: false;
      code: OpenOwnClassSessionForEnrollmentErrorCode;
      message: string;
    };

// D2：Organizer own-scoped，單一狀態轉換 guard。這是單一 organizer 對自己單一 class
// session 的操作，沒有多方競爭同一資源的併發場景，不需要 __internal__ pure-core + hooks
// 架構（比較 createEnrollmentForUser，見 enrollment domain）。
// D14：`startAt` 已過的 class session 不可開放報名，guard 直接寫進 updateMany 的 where，
// 不額外查詢。
export async function openOwnClassSessionForEnrollment(
  classSessionId: string,
): Promise<OpenOwnClassSessionForEnrollmentResult> {
  let organizerProfileId: string;

  try {
    const currentUser = await requireUser();

    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!organizerProfile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "找不到你的團主資料。",
      };
    }

    organizerProfileId = organizerProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再開放報名。",
      };
    }

    throw error;
  }

  const updateResult = await prisma.classSession.updateMany({
    where: {
      id: classSessionId,
      organizerProfileId,
      status: "draft",
      startAt: { gt: new Date() },
    },
    data: { status: "open_for_enrollment" },
  });

  if (updateResult.count > 0) {
    return { ok: true };
  }

  const classSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, organizerProfileId },
    select: { status: true, startAt: true },
  });

  if (!classSession) {
    return {
      ok: false,
      code: "class_session_not_found",
      message: "找不到這堂課程，或你沒有權限操作。",
    };
  }

  if (classSession.startAt.getTime() <= Date.now()) {
    return {
      ok: false,
      code: "class_session_already_started",
      message: "這堂課程已經開始，無法開放報名。",
    };
  }

  return {
    ok: false,
    code: "class_session_not_draft",
    message: "這堂課程目前狀態不允許開放報名。",
  };
}

export type CancelOwnClassSessionErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "class_session_not_found"
  | "class_session_already_cancelled"
  | "class_session_already_started"
  | "class_session_not_cancellable"
  | "class_session_cancel_failed";

export type CancelOwnClassSessionResult =
  | { ok: true }
  | {
      ok: false;
      code: CancelOwnClassSessionErrorCode;
      message: string;
    };

// D1/D2/D3：Organizer own-scoped。實際的鎖／原子狀態轉換／連帶取消 Enrollment 邏輯都在
// __internal__ 的 pure 核心（跟 createEnrollmentForUser 搶同一個 ClassSession 鎖，見
// D3），這裡只負責把目前使用者解析成受信任的 organizerProfileId。
export async function cancelOwnClassSession(
  classSessionId: string,
): Promise<CancelOwnClassSessionResult> {
  let organizerProfileId: string;

  try {
    const currentUser = await requireUser();

    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!organizerProfile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "找不到你的團主資料。",
      };
    }

    organizerProfileId = organizerProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再取消課程。",
      };
    }

    throw error;
  }

  const result = await cancelClassSessionForOrganizer(organizerProfileId, classSessionId);

  if (result.ok) {
    return { ok: true };
  }

  if (result.code === "class_session_not_found") {
    return {
      ok: false,
      code: "class_session_not_found",
      message: "找不到這堂課程，或你沒有權限操作。",
    };
  }

  if (result.code === "class_session_already_cancelled") {
    return {
      ok: false,
      code: "class_session_already_cancelled",
      message: "這堂課程已經取消過了。",
    };
  }

  if (result.code === "class_session_already_started") {
    return {
      ok: false,
      code: "class_session_already_started",
      message: "這堂課程已經開始，無法取消。",
    };
  }

  if (result.code === "class_session_not_cancellable") {
    return {
      ok: false,
      code: "class_session_not_cancellable",
      message: "這堂課程目前狀態不允許取消。",
    };
  }

  return {
    ok: false,
    code: "class_session_cancel_failed",
    message: "課程暫時無法取消，請稍後再試。",
  };
}

export type CompleteOwnClassSessionErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "class_session_not_found"
  | "class_session_already_completed"
  | "class_session_not_completable"
  | "class_session_not_ended"
  | "class_session_complete_failed";

export type CompleteOwnClassSessionResult =
  | { ok: true }
  | {
      ok: false;
      code: CompleteOwnClassSessionErrorCode;
      message: string;
    };

// D1/D2/D4 修正版：Organizer own-scoped，單一狀態轉換，比照 openOwnClassSessionForEnrollment
// 的既有形狀（單一 updateMany + count===0 時再查一次分類錯誤原因），不需要 __internal__
// pure-core（沒有多方競爭同一資源的併發場景）。只能從 open_for_enrollment 觸發，且 endAt
// 必須已經過去。跟 openOwnClassSessionForEnrollment 的既有寫法不同：這裡只在函式最開頭
// 呼叫一次 `new Date()`，同時用於 updateMany 的 guard 與失敗後分類查詢的比較，避免兩次
// 獨立取時在極端邊界下互相矛盾（codex round 1 指出的問題）。
export async function completeOwnClassSession(
  classSessionId: string,
): Promise<CompleteOwnClassSessionResult> {
  let organizerProfileId: string;

  try {
    const currentUser = await requireUser();

    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!organizerProfile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "找不到你的團主資料。",
      };
    }

    organizerProfileId = organizerProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再標記課程完成。",
      };
    }

    throw error;
  }

  const now = new Date();

  const updateResult = await prisma.classSession.updateMany({
    where: {
      id: classSessionId,
      organizerProfileId,
      status: "open_for_enrollment",
      endAt: { lte: now },
    },
    data: { status: "completed" },
  });

  if (updateResult.count > 0) {
    // D5（class-session-review-plan）：兌現 class-session-completion D5 的既有承諾——
    // 「已完成」本身不值得單獨通知，但結合「邀請留下評價」就有價值了。tx commit 之後才
    // 執行，try/catch 隔離失敗，不影響已經成功的狀態轉換（比照既有先例）。
    try {
      const detail = await prisma.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          title: true,
          enrollments: {
            where: { status: "confirmed" },
            select: { userId: true },
          },
        },
      });

      if (detail && detail.enrollments.length > 0) {
        await notifyUsers(
          "class_session_completed",
          detail.enrollments.map((enrollment) => ({
            userId: enrollment.userId,
            role: "affected_member" as const,
          })),
          { classSessionTitle: detail.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] class_session_completed trigger failed", notifyError);
    }

    return { ok: true };
  }

  const classSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, organizerProfileId },
    select: { status: true, endAt: true },
  });

  if (!classSession) {
    return {
      ok: false,
      code: "class_session_not_found",
      message: "找不到這堂課程，或你沒有權限操作。",
    };
  }

  if (classSession.status === "completed") {
    return {
      ok: false,
      code: "class_session_already_completed",
      message: "這堂課程已經標記完成過了。",
    };
  }

  if (classSession.status !== "open_for_enrollment") {
    return {
      ok: false,
      code: "class_session_not_completable",
      message: "這堂課程目前狀態不允許標記完成。",
    };
  }

  if (classSession.endAt.getTime() > now.getTime()) {
    return {
      ok: false,
      code: "class_session_not_ended",
      message: "這堂課程尚未結束，無法標記完成。",
    };
  }

  return {
    ok: false,
    code: "class_session_complete_failed",
    message: "標記完成暫時無法完成，請稍後再試。",
  };
}

// teacher-initiated-open-classes Slice A：老師直接建課，own-scoped 對外函式，命名與既有
// Organizer 版本對稱。單堂建立重用既有 validateClassSessionCreate（欄位與規則完全相同，
// 驗證邏輯不因擁有權模式而不同，只有建立核心的擁有權寫入不同，見 create-teacher-class-
// session-core.ts）；常規／固定期課程的 recurringClassSeriesId 留給 Slice B。
export type CreateOwnClassSessionForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "validation_failed"
  | "teacher_not_approved"
  | "recurring_series_not_found"
  | "teacher_schedule_conflict"
  | "class_session_create_failed";

export type CreateOwnClassSessionForTeacherResult =
  | { ok: true; classSessionId: string }
  | {
      ok: false;
      code: CreateOwnClassSessionForTeacherErrorCode;
      message: string;
      validationErrors?: ClassSessionValidationError[];
    };

export async function createOwnClassSessionForTeacher(
  input: ClassSessionCreateInput & {
    recurringClassSeriesId?: string;
    requiresApproval?: boolean;
  },
): Promise<CreateOwnClassSessionForTeacherResult> {
  // 老師自己建課一律要說明瑜伽風格（團主媒合建課不需要）。
  const validation = validateClassSessionCreate(input, { requireYogaStyles: true });

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "建立課程前，請先補齊必填欄位。",
      validationErrors: validation.errors,
    };
  }

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
        message: "請先登入後再建立課程。",
      };
    }

    throw error;
  }

  const teacherInput: CreateTeacherClassSessionInput = {
    ...validation.normalized,
    recurringClassSeriesId: input.recurringClassSeriesId,
    requiresApproval: input.requiresApproval === true,
  };

  const result = await createClassSessionForTeacher(teacherProfileId, teacherInput);

  if (result.ok) {
    return { ok: true, classSessionId: result.classSessionId };
  }

  if (result.code === "teacher_not_approved") {
    return {
      ok: false,
      code: "teacher_not_approved",
      message: "只有審核通過的老師才能建立課程。",
    };
  }

  if (result.code === "recurring_series_not_found") {
    return {
      ok: false,
      code: "recurring_series_not_found",
      message: "找不到這個常規課程系列，或你沒有權限操作。",
    };
  }

  if (result.code === "teacher_schedule_conflict") {
    return {
      ok: false,
      code: "teacher_schedule_conflict",
      message: "你在這個時段已經有其他課程。",
    };
  }

  return {
    ok: false,
    code: "class_session_create_failed",
    message: "課程暫時無法建立，請稍後再試。",
  };
}

export type OpenOwnClassSessionForEnrollmentForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "class_session_not_found"
  | "class_session_not_draft"
  | "class_session_already_started"
  | "teacher_not_approved";

export type OpenOwnClassSessionForEnrollmentForTeacherResult =
  | { ok: true }
  | {
      ok: false;
      code: OpenOwnClassSessionForEnrollmentForTeacherErrorCode;
      message: string;
    };

const openClassSessionForTeacherErrorMessages: Record<OpenClassSessionForTeacherErrorCode, string> = {
  class_session_not_found: "找不到這堂課程，或你沒有權限操作。",
  teacher_not_approved: "老師資格暫停期間不能開放報名。",
  class_session_already_started: "這堂課程已經開始，無法開放報名。",
  class_session_not_draft: "這堂課程目前狀態不允許開放報名。",
};

// 比照既有 openOwnClassSessionForEnrollment：own-scope 判斷改成 teacherProfileId 的單一
// updateMany + 分類錯誤。organizer-usability-redesign 票 09：判斷與寫入抽到 __internal__ 核心
// （只允許 teacher_initiated），這裡只由登入身分找出 teacherProfileId。
export async function openOwnClassSessionForEnrollmentForTeacher(
  classSessionId: string,
): Promise<OpenOwnClassSessionForEnrollmentForTeacherResult> {
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
        message: "請先登入後再開放報名。",
      };
    }

    throw error;
  }

  const result = await openClassSessionForEnrollmentForTeacher(teacherProfileId, classSessionId);

  if (result.ok) {
    return { ok: true };
  }

  return {
    ok: false,
    code: result.code,
    message: openClassSessionForTeacherErrorMessages[result.code],
  };
}

export type EditOwnClassSessionForTeacherResult =
  | { ok: true; notifiedMemberCount: number }
  | {
      ok: false;
      code: EditClassSessionForTeacherErrorCode | "authentication_required" | "teacher_profile_required";
      message: string;
      validationErrors?: ClassSessionValidationError[];
    };

const editErrorMessages: Record<EditClassSessionForTeacherErrorCode, string> = {
  class_session_not_found: "找不到這堂課程，或你沒有權限操作。",
  class_session_not_editable: "這堂課目前不能修改。只有你自己開的單堂課，在草稿或開放報名中才能修改。",
  class_session_already_started: "這堂課已經開始，不能再修改。",
  teacher_not_approved: "老師資格暫停期間不能修改課程。",
  validation_failed: "修改前，請先補齊必填欄位。",
  teacher_schedule_conflict: "這個時段跟你的其他課程重疊，請換一個時間。",
  capacity_below_enrolled: "人數上限不能少於目前已報名的人數。",
};

// teacher-class-scheduling 票 04：老師改課（單堂）。核心在 __internal__/edit-class-session-core-for-teacher.ts。
export async function editOwnClassSessionForTeacher(
  classSessionId: string,
  input: EditClassSessionForTeacherInput,
): Promise<EditOwnClassSessionForTeacherResult> {
  let teacherProfileId: string;

  try {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return { ok: false, code: "teacher_profile_required", message: "找不到你的老師資料。" };
    }

    teacherProfileId = teacherProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return { ok: false, code: "authentication_required", message: "請先登入後再修改課程。" };
    }

    throw error;
  }

  const result = await editClassSessionForTeacher(teacherProfileId, classSessionId, input);

  if (result.ok) {
    return { ok: true, notifiedMemberCount: result.notifiedMemberCount };
  }

  return {
    ok: false,
    code: result.code,
    message:
      result.code === "capacity_below_enrolled" && result.enrolledCount !== undefined
        ? `目前已報名（含待確認）${result.enrolledCount} 人，人數上限不能少於 ${result.enrolledCount}。`
        : editErrorMessages[result.code],
    validationErrors: result.validationErrors,
  };
}

export type EditOwnSeriesFromOccurrenceForTeacherResult =
  | { ok: true; updatedCount: number; notifiedMemberCount: number }
  | {
      ok: false;
      code: string;
      message: string;
      validationErrors?: ClassSessionValidationError[];
    };

// teacher-class-scheduling 票 05：系列改課「改這場和之後所有場次」。核心在
// __internal__/edit-series-from-occurrence-core.ts（鎖系列 → 場次 → 老師，整批成功或整批不改）。
export async function editOwnSeriesFromOccurrenceForTeacher(
  recurringClassSeriesId: string,
  fromClassSessionId: string,
  input: EditSeriesFromOccurrenceInput,
): Promise<EditOwnSeriesFromOccurrenceForTeacherResult> {
  let teacherProfileId: string;

  try {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return { ok: false, code: "teacher_profile_required", message: "找不到你的老師資料。" };
    }

    teacherProfileId = teacherProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return { ok: false, code: "authentication_required", message: "請先登入後再修改課程。" };
    }

    throw error;
  }

  const result = await editSeriesFromOccurrenceForTeacher(
    teacherProfileId,
    recurringClassSeriesId,
    fromClassSessionId,
    input,
  );

  if (result.ok) {
    return result;
  }

  // 整批不改時指出是哪一天，老師才知道要調整哪裡。
  const day = result.failedStartAt ? formatTaipeiShortDatetime(result.failedStartAt) : null;
  const message =
    result.code === "teacher_schedule_conflict" && day
      ? `${day} 那一場會跟你的其他課程時段重疊，這次所有場次都沒有修改。`
      : result.code === "capacity_below_enrolled" && day
        ? `${day} 那一場已報名（含待確認）${result.enrolledCount ?? 0} 人，人數上限不能少於這個數字，這次所有場次都沒有修改。`
        : result.code === "series_not_found"
          ? "找不到這個課程系列，或你沒有權限操作。"
          : result.code === "class_session_not_found"
            ? "找不到這一場課程，或它不屬於這個系列。"
            : editErrorMessages[result.code as EditClassSessionForTeacherErrorCode] ?? "這次沒有修改任何場次。";

  return { ok: false, code: result.code, message, validationErrors: result.validationErrors };
}

export type CancelOwnClassSessionForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "class_session_not_found"
  | "class_session_already_cancelled"
  | "class_session_already_started"
  | "class_session_not_cancellable"
  | "cancel_failed";

export type CancelOwnClassSessionForTeacherResult =
  | { ok: true }
  | {
      ok: false;
      code: CancelOwnClassSessionForTeacherErrorCode;
      message: string;
    };

const cancelClassSessionForTeacherErrorMessages: Record<
  Exclude<CancelOwnClassSessionForTeacherErrorCode, "authentication_required" | "teacher_profile_required">,
  string
> = {
  class_session_not_found: "找不到這堂課程，或你沒有權限操作。",
  class_session_already_cancelled: "這堂課程已經取消過了。",
  class_session_already_started: "這堂課程已經開始，無法取消。",
  class_session_not_cancellable: "這堂課程目前狀態不允許取消。",
  cancel_failed: "課程暫時無法取消，請稍後再試。",
};

export async function cancelOwnClassSessionForTeacher(
  classSessionId: string,
): Promise<CancelOwnClassSessionForTeacherResult> {
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
        message: "請先登入後再取消課程。",
      };
    }

    throw error;
  }

  const result = await cancelClassSessionForTeacher(teacherProfileId, classSessionId);

  if (result.ok) {
    return result;
  }

  return {
    ok: false,
    code: result.code,
    message: cancelClassSessionForTeacherErrorMessages[result.code],
  };
}

export type CompleteOwnClassSessionForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "class_session_not_found"
  | "class_session_already_completed"
  | "class_session_not_completable"
  | "class_session_not_ended"
  | "class_session_complete_failed";

export type CompleteOwnClassSessionForTeacherResult =
  | { ok: true }
  | {
      ok: false;
      code: CompleteOwnClassSessionForTeacherErrorCode;
      message: string;
    };

const completeClassSessionForTeacherErrorMessages: Record<
  Exclude<CompleteOwnClassSessionForTeacherErrorCode, "authentication_required" | "teacher_profile_required">,
  string
> = {
  class_session_not_found: "找不到這堂課程，或你沒有權限操作。",
  class_session_already_completed: "這堂課程已經標記完成過了。",
  class_session_not_completable: "這堂課程目前狀態不允許標記完成。",
  class_session_not_ended: "這堂課程尚未結束，無法標記完成。",
  class_session_complete_failed: "標記完成暫時無法完成，請稍後再試。",
};

export async function completeOwnClassSessionForTeacher(
  classSessionId: string,
): Promise<CompleteOwnClassSessionForTeacherResult> {
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
        message: "請先登入後再標記課程完成。",
      };
    }

    throw error;
  }

  const result = await completeClassSessionForTeacher(teacherProfileId, classSessionId);

  if (result.ok) {
    return result;
  }

  return {
    ok: false,
    code: result.code,
    message: completeClassSessionForTeacherErrorMessages[result.code],
  };
}

// teacher-initiated-open-classes Slice B：常規／固定期課程系列。G1 = A（materialize）——
// 建立 series 之後立刻依 schedule 生成第一批獨立 ClassSession row，之後只能靠
// generateMoreOccurrencesForTeacher 手動延伸（Gate G4 = A，沒有背景排程）。
export type CreateOwnRecurringClassSeriesForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "validation_failed"
  | "teacher_not_approved"
  | "series_create_failed";

export type CreateOwnRecurringClassSeriesForTeacherResult =
  | {
      ok: true;
      recurringClassSeriesId: string;
      createdClassSessionIds: string[];
      skipped: OccurrenceSkip[];
    }
  | {
      ok: false;
      code: CreateOwnRecurringClassSeriesForTeacherErrorCode;
      message: string;
      validationErrors?: RecurringSeriesValidationError[];
    };

// teacher-class-scheduling 票 01：options.openForEnrollment 為 true 時，生成的場次建立後直接開放報名。
export async function createOwnRecurringClassSeriesForTeacher(
  input: RecurringSeriesInput,
  options: { openForEnrollment?: boolean } = {},
): Promise<CreateOwnRecurringClassSeriesForTeacherResult> {
  const validation = validateRecurringSeriesInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "建立課程系列前，請先補齊必填欄位。",
      validationErrors: validation.errors,
    };
  }

  let teacherProfileId: string;

  try {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true, status: true },
    });

    if (!teacherProfile) {
      return {
        ok: false,
        code: "teacher_profile_required",
        message: "找不到你的老師資料。",
      };
    }

    if (teacherProfile.status !== "approved") {
      return {
        ok: false,
        code: "teacher_not_approved",
        message: "只有審核通過的老師才能建立課程系列。",
      };
    }

    teacherProfileId = teacherProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再建立課程系列。",
      };
    }

    throw error;
  }

  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title: validation.normalized.title,
      description: validation.normalized.description,
      serviceType: validation.normalized.serviceType,
      serviceTypes: validation.normalized.serviceTypes,
      yogaStyles: validation.normalized.yogaStyles,
      dayOfWeek: validation.schedule.mode === "weekly" ? validation.schedule.dayOfWeek : null,
      startTime: validation.normalized.startTime,
      endTime: validation.normalized.endTime,
      location: validation.normalized.location,
      capacity: validation.normalized.capacity,
      requiresApproval: validation.normalized.requiresApproval,
      isPublic: validation.normalized.isPublic,
    },
    select: { id: true },
  });

  const dates =
    validation.schedule.mode === "weekly"
      ? computeNextWeeklyOccurrenceDates(
          validation.schedule.dayOfWeek,
          validation.schedule.generateCount,
          validation.schedule.startDate
            ? weeklyAfterDateForStartDate(validation.schedule.startDate)
            : undefined,
        )
      : validation.schedule.dates;

  const generateResult = await generateOccurrencesForSeries(teacherProfileId, series.id, dates, {
    openForEnrollment: options.openForEnrollment === true,
  });

  if (!generateResult.ok) {
    // series 本身已經建立成功，即使第一批生成失敗（例如老師剛好在這個瞬間被 suspend）也
    // 不回滾 series——老師之後審核通過可以在系列管理頁重新生成，不需要重新建立整個系列。
    return {
      ok: false,
      code:
        generateResult.code === "teacher_not_approved" ? "teacher_not_approved" : "series_create_failed",
      message:
        generateResult.code === "teacher_not_approved"
          ? "只有審核通過的老師才能建立課程系列。"
          : "課程系列已建立，但生成場次時發生問題，請稍後在系列管理頁重試。",
    };
  }

  return {
    ok: true,
    recurringClassSeriesId: series.id,
    createdClassSessionIds: generateResult.createdClassSessionIds,
    skipped: generateResult.skipped,
  };
}

export type GenerateMoreOccurrencesForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "series_not_found"
  | "series_not_recurring"
  | "teacher_not_approved"
  | "generate_count_invalid";

export type GenerateMoreOccurrencesForTeacherResult =
  | { ok: true; createdClassSessionIds: string[]; skipped: OccurrenceSkip[] }
  | { ok: false; code: GenerateMoreOccurrencesForTeacherErrorCode; message: string };

// 「生成更多」只對常規（dayOfWeek 不是 null）系列有意義——固定期課程的日期清單在建立當下
// 就已經一次到位，沒有「延伸」的概念。從該系列目前已生成的最晚一場 startAt 之後開始算，
// 確保新生成的日期一律晚於既有場次，不會跟已生成的（即使已取消的）日期重複。
//
// teacher-class-scheduling 票 01：「最晚一場」的讀取與日期計算移進系列鎖內（resolver），
// 兩次同時按「生成更多」時，第二次會等第一次 commit 後才讀到新的最晚一場，不會產生重複日期。
export async function generateMoreOccurrencesForTeacher(
  recurringClassSeriesId: string,
  count: number,
  options: { openForEnrollment?: boolean } = {},
): Promise<GenerateMoreOccurrencesForTeacherResult> {
  if (
    !Number.isInteger(count) ||
    count < WEEKLY_GENERATE_COUNT_MIN ||
    count > WEEKLY_GENERATE_COUNT_MAX
  ) {
    return {
      ok: false,
      code: "generate_count_invalid",
      message: `生成場次數需介於 ${WEEKLY_GENERATE_COUNT_MIN}–${WEEKLY_GENERATE_COUNT_MAX} 之間。`,
    };
  }

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
        message: "請先登入後再生成更多場次。",
      };
    }

    throw error;
  }

  const series = await prisma.recurringClassSeries.findFirst({
    where: { id: recurringClassSeriesId, teacherProfileId },
  });

  if (!series) {
    return {
      ok: false,
      code: "series_not_found",
      message: "找不到這個課程系列，或你沒有權限操作。",
    };
  }

  if (series.dayOfWeek === null) {
    return {
      ok: false,
      code: "series_not_recurring",
      message: "固定期課程系列不支援「生成更多」，日期在建立當下已經一次到位。",
    };
  }

  const dayOfWeek = series.dayOfWeek;

  const result = await generateOccurrencesForSeries(
    teacherProfileId,
    recurringClassSeriesId,
    async (tx) => {
      const latestOccurrence = await tx.classSession.findFirst({
        where: { recurringClassSeriesId },
        orderBy: { startAt: "desc" },
        select: { startAt: true },
      });

      return computeNextWeeklyOccurrenceDates(dayOfWeek, count, latestOccurrence?.startAt);
    },
    { openForEnrollment: options.openForEnrollment === true },
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code === "teacher_not_approved" ? "teacher_not_approved" : "series_not_found",
      message:
        result.code === "teacher_not_approved"
          ? "只有審核通過的老師才能生成更多場次。"
          : "找不到這個課程系列，或你沒有權限操作。",
    };
  }

  return { ok: true, createdClassSessionIds: result.createdClassSessionIds, skipped: result.skipped };
}

export type {
  OpenAllDraftOccurrencesForTeacherErrorCode,
  OpenAllDraftOccurrencesForTeacherResult,
} from "./__internal__/open-all-draft-occurrences-core";

// teacher-class-scheduling 票 01：系列頁「全部開放報名」。把本人系列底下所有尚未開始的草稿
// 場次一次改成 open_for_enrollment；已開始、已取消、已開放的場次不受影響。
// 資格：只有已通過審核的老師可以開放（不能沿用現行單場開放——它沒有檢查老師狀態，補強在票 04）。
// 鎖定：先鎖系列列（序列化邊界，見規格第 6 節），鎖內再確認老師狀態，然後 updateMany。
export async function openAllDraftOccurrencesForTeacher(
  recurringClassSeriesId: string,
): Promise<OpenAllDraftOccurrencesForTeacherResult> {
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
        message: "請先登入後再開放報名。",
      };
    }

    throw error;
  }

  return openAllDraftOccurrencesForTeacherProfile(teacherProfileId, recurringClassSeriesId);
}

export type CancelSeriesFromOccurrenceForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "series_not_found"
  | "class_session_not_found";

export type CancelSeriesFromOccurrenceForTeacherResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; code: CancelSeriesFromOccurrenceForTeacherErrorCode; message: string };

// teacher-class-scheduling 票 03：「從這場以後全部取消」。核心在
// __internal__/cancel-series-from-occurrence-core.ts（鎖系列、鎖內重讀、同一 transaction 逐場取消）。
export async function cancelSeriesFromOccurrenceForTeacher(
  recurringClassSeriesId: string,
  fromClassSessionId: string,
): Promise<CancelSeriesFromOccurrenceForTeacherResult> {
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
        message: "請先登入後再取消課程。",
      };
    }

    throw error;
  }

  const result = await cancelSeriesFromOccurrenceForTeacherProfile(
    teacherProfileId,
    recurringClassSeriesId,
    fromClassSessionId,
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message:
        result.code === "series_not_found"
          ? "找不到這個課程系列，或你沒有權限操作。"
          : "找不到這一場課程，或它不屬於這個系列。",
    };
  }

  return result;
}

export type CancelRecurringClassSeriesForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "series_not_found";

export type CancelRecurringClassSeriesForTeacherResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; code: CancelRecurringClassSeriesForTeacherErrorCode; message: string };

// 只取消該系列底下尚未開始、狀態在可取消集合內的場次（已開始或已完成的場次不受影響）。
// 逐筆呼叫既有的 teacher 版單堂取消核心，而不是自己重寫一份 cascade SQL——同一段已經測試過
// 的 transaction 形狀（含連帶取消 Enrollment、發送通知），逐場呼叫即可涵蓋，不需要額外的
// 批次邏輯。RecurringClassSeries 本身沒有 status 欄位（第 5 節資料模型已 Codex 核准，不在
// 這裡擅自加欄位）；「取消系列」等同於「取消它底下所有還來得及取消的場次」，series 這一列
// 本身仍會保留，之後仍可用 generateMoreOccurrencesForTeacher 生成新的未來場次。
export async function cancelRecurringClassSeriesForTeacher(
  recurringClassSeriesId: string,
): Promise<CancelRecurringClassSeriesForTeacherResult> {
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
        message: "請先登入後再取消課程系列。",
      };
    }

    throw error;
  }

  const series = await prisma.recurringClassSeries.findFirst({
    where: { id: recurringClassSeriesId, teacherProfileId },
    select: { id: true },
  });

  if (!series) {
    return {
      ok: false,
      code: "series_not_found",
      message: "找不到這個課程系列，或你沒有權限操作。",
    };
  }

  const cancellableSessions = await prisma.classSession.findMany({
    where: {
      recurringClassSeriesId,
      status: { in: ["draft", "open_for_enrollment"] },
      startAt: { gt: new Date() },
    },
    select: { id: true },
  });

  let cancelledCount = 0;

  for (const classSession of cancellableSessions) {
    const result = await cancelClassSessionForTeacher(teacherProfileId, classSession.id);

    if (result.ok) {
      cancelledCount += 1;
    }
  }

  return { ok: true, cancelledCount };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
