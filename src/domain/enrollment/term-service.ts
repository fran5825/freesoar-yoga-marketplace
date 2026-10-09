// teacher-class-scheduling 票 08：學員整期報名的 auth-resolving 外層。規則與鎖都在
// __internal__/create-series-enrollment-core.ts；這裡只把目前使用者解析成受信任的 userId，並把錯誤碼轉成文案。

import { requireUser } from "@/lib/auth/session";

import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";

import {
  createSeriesEnrollmentForUser,
  type CreateSeriesEnrollmentErrorCode,
} from "./__internal__/create-series-enrollment-core";
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
