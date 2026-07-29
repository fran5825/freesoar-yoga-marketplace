import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { cancelClassSessionForOrganizer } from "./__internal__/cancel-class-session-core";
import { createClassSessionForOrganizer } from "./__internal__/create-class-session-core";
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

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
