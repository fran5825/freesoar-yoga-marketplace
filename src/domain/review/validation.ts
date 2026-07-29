export type ReviewInput = {
  rating: number | null | undefined;
  comment?: string | null;
};

export const RATING_MIN = 1;
export const RATING_MAX = 5;
// D2：comment 選填、簡短備註等級，比照既有 Enrollment.notes 的既有先例
// （NOTES_MAX_LENGTH = 500），不是 DemandRequest.description 那種長文件等級。
export const COMMENT_MAX_LENGTH = 500;

export type ReviewValidationErrorCode =
  | "rating_required"
  | "rating_out_of_range"
  | "comment_too_long";

export type ReviewValidationError = {
  field: "rating" | "comment";
  code: ReviewValidationErrorCode;
  message: string;
};

export type ReviewValidationResult =
  | { valid: true; normalized: { rating: number; comment: string | null } }
  | { valid: false; errors: ReviewValidationError[] };

export function validateReviewInput(input: ReviewInput): ReviewValidationResult {
  const errors: ReviewValidationError[] = [];

  const rating = typeof input.rating === "number" ? input.rating : Number(input.rating);

  if (input.rating === null || input.rating === undefined || Number.isNaN(rating)) {
    errors.push({
      field: "rating",
      code: "rating_required",
      message: "請選擇星等。",
    });
  } else if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    errors.push({
      field: "rating",
      code: "rating_out_of_range",
      message: `星等必須介於 ${RATING_MIN} 到 ${RATING_MAX} 之間。`,
    });
  }

  const normalizedComment =
    typeof input.comment === "string" && input.comment.trim().length > 0
      ? input.comment.trim()
      : null;

  if (normalizedComment && normalizedComment.length > COMMENT_MAX_LENGTH) {
    errors.push({
      field: "comment",
      code: "comment_too_long",
      message: `評語不可超過 ${COMMENT_MAX_LENGTH} 個字。`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, normalized: { rating, comment: normalizedComment } };
}
