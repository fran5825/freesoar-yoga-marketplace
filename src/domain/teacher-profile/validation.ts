export type TeacherProfileApplicationInput = {
  displayName?: string | null;
  bio?: string | null;
  teachingStyle?: string | null;
  experienceYears?: number | null;
  certifications?: string[] | null;
  specialties?: string[] | null;
  serviceAreas?: string[] | null;
  teachingFormats?: string[] | null;
  priceRange?: string | null;
  profilePhotoUrl?: string | null;
};

export type TeacherProfileValidationErrorCode =
  | "display_name_required"
  | "bio_required"
  | "teaching_style_required"
  | "experience_years_required"
  | "specialties_required"
  | "service_areas_required"
  | "teaching_formats_required";

export type TeacherProfileValidationError = {
  field:
    | "displayName"
    | "bio"
    | "teachingStyle"
    | "experienceYears"
    | "specialties"
    | "serviceAreas"
    | "teachingFormats";
  code: TeacherProfileValidationErrorCode;
  message: string;
};

export type TeacherProfileValidationResult =
  | {
      valid: true;
      errors: [];
    }
  | {
      valid: false;
      errors: TeacherProfileValidationError[];
    };

export function validateTeacherProfileDraft(
  input: TeacherProfileApplicationInput,
): TeacherProfileValidationResult {
  void input;

  return createValidResult();
}

export function validateTeacherProfileSubmit(
  input: TeacherProfileApplicationInput,
): TeacherProfileValidationResult {
  const errors: TeacherProfileValidationError[] = [];

  if (isBlank(input.displayName)) {
    errors.push({
      field: "displayName",
      code: "display_name_required",
      message: "公開顯示名稱為送審必填欄位。",
    });
  }

  if (isBlank(input.bio)) {
    errors.push({
      field: "bio",
      code: "bio_required",
      message: "老師簡介為送審必填欄位。",
    });
  }

  if (isBlank(input.teachingStyle)) {
    errors.push({
      field: "teachingStyle",
      code: "teaching_style_required",
      message: "教學風格為送審必填欄位。",
    });
  }

  if (!hasExperienceYears(input.experienceYears)) {
    errors.push({
      field: "experienceYears",
      code: "experience_years_required",
      message: "教學年資為送審必填欄位。",
    });
  }

  if (!hasAtLeastOneValue(input.specialties)) {
    errors.push({
      field: "specialties",
      code: "specialties_required",
      message: "擅長類型至少需要一項。",
    });
  }

  if (!hasAtLeastOneValue(input.serviceAreas)) {
    errors.push({
      field: "serviceAreas",
      code: "service_areas_required",
      message: "可服務區域至少需要一項。",
    });
  }

  if (!hasAtLeastOneValue(input.teachingFormats)) {
    errors.push({
      field: "teachingFormats",
      code: "teaching_formats_required",
      message: "授課形式至少需要一項。",
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return createValidResult();
}

function createValidResult(): TeacherProfileValidationResult {
  return {
    valid: true,
    errors: [],
  };
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function hasExperienceYears(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasAtLeastOneValue(values: string[] | null | undefined): boolean {
  return Array.isArray(values) && values.some((value) => value.trim().length > 0);
}

export const REJECTION_REASON_MIN_LENGTH = 10;
export const REJECTION_REASON_MAX_LENGTH = 1000;

export type TeacherProfileRejectionReasonErrorCode =
  | "rejection_reason_required"
  | "rejection_reason_too_short"
  | "rejection_reason_too_long";

export type TeacherProfileRejectionReasonValidationResult =
  | {
      valid: true;
      normalizedReason: string;
    }
  | {
      valid: false;
      code: TeacherProfileRejectionReasonErrorCode;
      message: string;
    };

// D3: rejection reason 以 trim 後值為單一基準，驗證且持久化 trim 後值，長度 10–1000 字。
export function validateTeacherProfileRejectionReason(
  reason: string | null | undefined,
): TeacherProfileRejectionReasonValidationResult {
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";

  if (normalizedReason.length === 0) {
    return {
      valid: false,
      code: "rejection_reason_required",
      message: "退回原因為必填。",
    };
  }

  if (normalizedReason.length < REJECTION_REASON_MIN_LENGTH) {
    return {
      valid: false,
      code: "rejection_reason_too_short",
      message: `退回原因至少需要 ${REJECTION_REASON_MIN_LENGTH} 個字。`,
    };
  }

  if (normalizedReason.length > REJECTION_REASON_MAX_LENGTH) {
    return {
      valid: false,
      code: "rejection_reason_too_long",
      message: `退回原因不可超過 ${REJECTION_REASON_MAX_LENGTH} 個字。`,
    };
  }

  return {
    valid: true,
    normalizedReason,
  };
}

export const SUSPENSION_REASON_MIN_LENGTH = 10;
export const SUSPENSION_REASON_MAX_LENGTH = 1000;

export type TeacherProfileSuspensionReasonErrorCode =
  | "suspension_reason_required"
  | "suspension_reason_too_short"
  | "suspension_reason_too_long";

export type TeacherProfileSuspensionReasonValidationResult =
  | {
      valid: true;
      normalizedReason: string;
    }
  | {
      valid: false;
      code: TeacherProfileSuspensionReasonErrorCode;
      message: string;
    };

// D1: suspension reason 比照既有 rejection reason 的既有形狀——trim 後值為單一基準，
// 驗證且持久化 trim 後值，長度 10–1000 字；獨立欄位，不 reuse rejectionReason（理由見 plan D1）。
export function validateTeacherProfileSuspensionReason(
  reason: string | null | undefined,
): TeacherProfileSuspensionReasonValidationResult {
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";

  if (normalizedReason.length === 0) {
    return {
      valid: false,
      code: "suspension_reason_required",
      message: "暫停原因為必填。",
    };
  }

  if (normalizedReason.length < SUSPENSION_REASON_MIN_LENGTH) {
    return {
      valid: false,
      code: "suspension_reason_too_short",
      message: `暫停原因至少需要 ${SUSPENSION_REASON_MIN_LENGTH} 個字。`,
    };
  }

  if (normalizedReason.length > SUSPENSION_REASON_MAX_LENGTH) {
    return {
      valid: false,
      code: "suspension_reason_too_long",
      message: `暫停原因不可超過 ${SUSPENSION_REASON_MAX_LENGTH} 個字。`,
    };
  }

  return {
    valid: true,
    normalizedReason,
  };
}
