import {
  isValidFrequency,
  isValidPreferredTimeSlot,
  isValidServiceType,
  isValidTargetLevel,
} from "./service-types";

export type DemandRequestApplicationInput = {
  title?: string | null;
  serviceType?: string | null;
  description?: string | null;
  targetLevel?: string | null;
  expectedParticipants?: number | null;
  preferredAreas?: string[] | null;
  preferredTimeSlots?: string[] | null;
  preferredStartDate?: Date | null;
  classLengthMinutes?: number | null;
  frequency?: string | null;
  budgetRange?: string | null;
};

// D10/D12：所有長度與數值界線皆為 PO 已確認之最終定案。
export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 100;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const EXPECTED_PARTICIPANTS_MIN = 1;
export const EXPECTED_PARTICIPANTS_MAX = 500;
export const CLASS_LENGTH_MINUTES_MIN = 30;
export const CLASS_LENGTH_MINUTES_MAX = 240;
export const PREFERRED_AREAS_MAX_ITEMS = 10;
export const PREFERRED_AREA_ITEM_MAX_LENGTH = 50;

export type DemandRequestValidationErrorCode =
  | "title_required"
  | "title_too_short"
  | "title_too_long"
  | "service_type_required"
  | "service_type_invalid"
  | "description_required"
  | "description_too_short"
  | "description_too_long"
  | "target_level_required"
  | "target_level_invalid"
  | "expected_participants_required"
  | "expected_participants_out_of_range"
  | "preferred_areas_required"
  | "preferred_areas_too_many"
  | "preferred_areas_item_too_long"
  | "preferred_time_slots_required"
  | "preferred_time_slots_invalid"
  | "class_length_minutes_required"
  | "class_length_minutes_out_of_range"
  | "frequency_required"
  | "frequency_invalid"
  | "preferred_start_date_in_past";

export type DemandRequestValidationError = {
  field:
    | "title"
    | "serviceType"
    | "description"
    | "targetLevel"
    | "expectedParticipants"
    | "preferredAreas"
    | "preferredTimeSlots"
    | "classLengthMinutes"
    | "frequency"
    | "preferredStartDate";
  code: DemandRequestValidationErrorCode;
  message: string;
};

export type DemandRequestValidationResult =
  | {
      valid: true;
      errors: [];
    }
  | {
      valid: false;
      errors: DemandRequestValidationError[];
    };

// D12：draft 比照 validateTeacherProfileDraft，幾乎 pass-through，
// 只靠 input.ts 的正規化保證型別可存，不要求必填齊全。
export function validateDemandRequestDraft(
  input: DemandRequestApplicationInput,
): DemandRequestValidationResult {
  void input;

  return createValidResult();
}

export function validateDemandRequestSubmit(
  input: DemandRequestApplicationInput,
): DemandRequestValidationResult {
  const errors: DemandRequestValidationError[] = [];

  if (isBlank(input.title)) {
    errors.push({
      field: "title",
      code: "title_required",
      message: "需求標題為送出必填欄位。",
    });
  } else if (input.title!.length < TITLE_MIN_LENGTH) {
    errors.push({
      field: "title",
      code: "title_too_short",
      message: `需求標題至少需要 ${TITLE_MIN_LENGTH} 個字。`,
    });
  } else if (input.title!.length > TITLE_MAX_LENGTH) {
    errors.push({
      field: "title",
      code: "title_too_long",
      message: `需求標題不可超過 ${TITLE_MAX_LENGTH} 個字。`,
    });
  }

  if (isBlank(input.serviceType)) {
    errors.push({
      field: "serviceType",
      code: "service_type_required",
      message: "服務類型為送出必填欄位。",
    });
  } else if (!isValidServiceType(input.serviceType as string)) {
    errors.push({
      field: "serviceType",
      code: "service_type_invalid",
      message: "服務類型不在允許的選項內。",
    });
  }

  if (isBlank(input.description)) {
    errors.push({
      field: "description",
      code: "description_required",
      message: "需求說明為送出必填欄位。",
    });
  } else if (input.description!.length < DESCRIPTION_MIN_LENGTH) {
    errors.push({
      field: "description",
      code: "description_too_short",
      message: `需求說明至少需要 ${DESCRIPTION_MIN_LENGTH} 個字。`,
    });
  } else if (input.description!.length > DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: "description",
      code: "description_too_long",
      message: `需求說明不可超過 ${DESCRIPTION_MAX_LENGTH} 個字。`,
    });
  }

  if (isBlank(input.targetLevel)) {
    errors.push({
      field: "targetLevel",
      code: "target_level_required",
      message: "適合對象為送出必填欄位。",
    });
  } else if (!isValidTargetLevel(input.targetLevel as string)) {
    errors.push({
      field: "targetLevel",
      code: "target_level_invalid",
      message: "適合對象不在允許的選項內。",
    });
  }

  if (!isValidNumber(input.expectedParticipants)) {
    errors.push({
      field: "expectedParticipants",
      code: "expected_participants_required",
      message: "預計參與人數為送出必填欄位。",
    });
  } else if (
    input.expectedParticipants! < EXPECTED_PARTICIPANTS_MIN ||
    input.expectedParticipants! > EXPECTED_PARTICIPANTS_MAX
  ) {
    errors.push({
      field: "expectedParticipants",
      code: "expected_participants_out_of_range",
      message: `預計參與人數需介於 ${EXPECTED_PARTICIPANTS_MIN}–${EXPECTED_PARTICIPANTS_MAX} 人之間。`,
    });
  }

  if (!hasAtLeastOneValue(input.preferredAreas)) {
    errors.push({
      field: "preferredAreas",
      code: "preferred_areas_required",
      message: "期望地區至少需要一項。",
    });
  } else if (input.preferredAreas!.length > PREFERRED_AREAS_MAX_ITEMS) {
    errors.push({
      field: "preferredAreas",
      code: "preferred_areas_too_many",
      message: `期望地區最多 ${PREFERRED_AREAS_MAX_ITEMS} 項。`,
    });
  } else if (
    input.preferredAreas!.some(
      (area) => area.length > PREFERRED_AREA_ITEM_MAX_LENGTH,
    )
  ) {
    errors.push({
      field: "preferredAreas",
      code: "preferred_areas_item_too_long",
      message: `每個期望地區不可超過 ${PREFERRED_AREA_ITEM_MAX_LENGTH} 個字。`,
    });
  }

  if (!hasAtLeastOneValue(input.preferredTimeSlots)) {
    errors.push({
      field: "preferredTimeSlots",
      code: "preferred_time_slots_required",
      message: "期望時段至少需要一項。",
    });
  } else if (
    !input.preferredTimeSlots!.every((slot) => isValidPreferredTimeSlot(slot))
  ) {
    errors.push({
      field: "preferredTimeSlots",
      code: "preferred_time_slots_invalid",
      message: "期望時段不在允許的選項內。",
    });
  }

  if (!isValidNumber(input.classLengthMinutes)) {
    errors.push({
      field: "classLengthMinutes",
      code: "class_length_minutes_required",
      message: "單堂課程長度為送出必填欄位。",
    });
  } else if (
    input.classLengthMinutes! < CLASS_LENGTH_MINUTES_MIN ||
    input.classLengthMinutes! > CLASS_LENGTH_MINUTES_MAX
  ) {
    errors.push({
      field: "classLengthMinutes",
      code: "class_length_minutes_out_of_range",
      message: `單堂課程長度需介於 ${CLASS_LENGTH_MINUTES_MIN}–${CLASS_LENGTH_MINUTES_MAX} 分鐘之間。`,
    });
  }

  if (isBlank(input.frequency)) {
    errors.push({
      field: "frequency",
      code: "frequency_required",
      message: "上課頻率為送出必填欄位。",
    });
  } else if (!isValidFrequency(input.frequency as string)) {
    errors.push({
      field: "frequency",
      code: "frequency_invalid",
      message: "上課頻率不在允許的選項內。",
    });
  }

  // D10：preferredStartDate 為建議欄位（非必填），但若填寫必須為今日以後。
  if (input.preferredStartDate != null && !isTodayOrLaterDate(input.preferredStartDate)) {
    errors.push({
      field: "preferredStartDate",
      code: "preferred_start_date_in_past",
      message: "期望開課日期不可早於今天。",
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

// D4：submit demand 前，organizer 綁定的 Organization 聯絡資訊必須齊全，
// 由 service 層呼叫此純函式檢查（schema 本身為 nullable，這是 application-layer 的權威把關）。
export type OrganizationContactCompletenessInput = {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function isOrganizationContactComplete(
  organization: OrganizationContactCompletenessInput,
): boolean {
  return (
    !isBlank(organization.contactName) &&
    !isBlank(organization.contactEmail) &&
    !isBlank(organization.contactPhone)
  );
}

export const REJECTION_REASON_MIN_LENGTH = 10;
export const REJECTION_REASON_MAX_LENGTH = 1000;

export type DemandRequestRejectionReasonErrorCode =
  | "rejection_reason_required"
  | "rejection_reason_too_short"
  | "rejection_reason_too_long";

export type DemandRequestRejectionReasonValidationResult =
  | {
      valid: true;
      normalizedReason: string;
    }
  | {
      valid: false;
      code: DemandRequestRejectionReasonErrorCode;
      message: string;
    };

// D11：rejection reason 以 trim 後值為單一基準，驗證且持久化 trim 後值，長度 10–1000 字，
// organizer-facing（比照 teacher-profile 的既有先例）。
export function validateDemandRequestRejectionReason(
  reason: string | null | undefined,
): DemandRequestRejectionReasonValidationResult {
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

function createValidResult(): DemandRequestValidationResult {
  return {
    valid: true,
    errors: [],
  };
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isValidNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function hasAtLeastOneValue(values: string[] | null | undefined): boolean {
  return Array.isArray(values) && values.some((value) => value.trim().length > 0);
}

function isTodayOrLaterDate(date: Date): boolean {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return date.getTime() >= startOfToday.getTime();
}
