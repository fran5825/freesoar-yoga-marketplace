export type EnrollmentCreateInput = {
  notes?: string | null;
  basicConsent?: boolean | null;
};

// D7：notes 選填，較保守的上限（簡短備註，不需要 DemandRequest.description 等級的長度）。
export const NOTES_MAX_LENGTH = 500;

export type EnrollmentValidationErrorCode =
  | "notes_too_long"
  | "basic_consent_required";

export type EnrollmentValidationError = {
  field: "notes" | "basicConsent";
  code: EnrollmentValidationErrorCode;
  message: string;
};

export type EnrollmentValidationResult =
  | {
      valid: true;
      normalized: { notes: string | null };
    }
  | {
      valid: false;
      errors: EnrollmentValidationError[];
    };

// D6：basicConsent 是 UX 防誤觸 checkbox（不通過直接拒絕，不進入建立流程），
// 通過後由 __internal__ core 寫入 consentedAt，這裡不負責持久化。
export function validateEnrollmentCreate(
  input: EnrollmentCreateInput,
): EnrollmentValidationResult {
  const errors: EnrollmentValidationError[] = [];

  const normalizedNotes =
    typeof input.notes === "string" && input.notes.trim().length > 0
      ? input.notes.trim()
      : null;

  if (normalizedNotes && normalizedNotes.length > NOTES_MAX_LENGTH) {
    errors.push({
      field: "notes",
      code: "notes_too_long",
      message: `備註不可超過 ${NOTES_MAX_LENGTH} 個字。`,
    });
  }

  if (input.basicConsent !== true) {
    errors.push({
      field: "basicConsent",
      code: "basic_consent_required",
      message: "請先勾選確認了解此課程非醫療行為。",
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, normalized: { notes: normalizedNotes } };
}
