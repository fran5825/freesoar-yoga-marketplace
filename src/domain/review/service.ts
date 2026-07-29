import { requireUser } from "@/lib/auth/session";

import { submitReviewForUser } from "./__internal__/submit-review-core";
import {
  type ReviewValidationError,
  type ReviewInput,
  validateReviewInput,
} from "./validation";

export type SubmitOwnReviewErrorCode =
  | "authentication_required"
  | "validation_failed"
  | "review_not_eligible"
  | "review_already_exists"
  | "review_submit_failed";

export type SubmitOwnReviewResult =
  | { ok: true; reviewId: string }
  | {
      ok: false;
      code: SubmitOwnReviewErrorCode;
      message: string;
      validationErrors?: ReviewValidationError[];
    };

// D1：只負責 requireUser() 把關與輸入驗證，實際的資格檢查（confirmed enrollment +
// completed class session）、原子寫入與通知都在 __internal__ 的 pure 核心，理由見該檔案
// 開頭註解（讓決定性測試可以在 Node context 直接呼叫）。
export async function submitOwnReview(
  classSessionId: string,
  input: ReviewInput,
): Promise<SubmitOwnReviewResult> {
  let userId: string;

  try {
    const currentUser = await requireUser();
    userId = currentUser.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再留下評價。",
      };
    }

    throw error;
  }

  const validation = validateReviewInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "請先確認評價內容。",
      validationErrors: validation.errors,
    };
  }

  const result = await submitReviewForUser(userId, classSessionId, validation.normalized);

  if (result.ok) {
    return { ok: true, reviewId: result.reviewId };
  }

  if (result.code === "review_not_eligible") {
    return {
      ok: false,
      code: "review_not_eligible",
      message: "這堂課程目前無法留下評價。",
    };
  }

  if (result.code === "review_already_exists") {
    return {
      ok: false,
      code: "review_already_exists",
      message: "你已經對這堂課程留下評價了。",
    };
  }

  return {
    ok: false,
    code: "review_submit_failed",
    message: "評價暫時無法送出，請稍後再試。",
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
