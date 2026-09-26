import {
  EXPECTED_PARTICIPANTS_MAX,
  EXPECTED_PARTICIPANTS_MIN,
} from "@/domain/demand-request/validation";
import { isValidServiceType, MAX_SERVICE_TYPES } from "@/domain/demand-request/service-types";

import { parseTaipeiDatetimeLocal } from "./timezone";
import {
  checkYogaStyles,
  normalizeYogaStyles,
  YOGA_STYLES_ISSUE_MESSAGES,
  type YogaStylesIssue,
} from "./yoga-styles";

export type ClassSessionCreateInput = {
  title?: string | null;
  description?: string | null;
  serviceType?: string | null;
  // 課程風格（可多選，最多 3 個）；沒帶時退回單一 serviceType（團主媒合建課仍是單選）。
  serviceTypes?: string[] | null;
  // 瑜伽類型：老師建課必填（見 validateClassSessionCreate 的 requireYogaStyles），
  // 團主媒合建課不需要，維持原有流程。
  yogaStyles?: string[] | null;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  capacity?: number | null;
  isPublic?: boolean | null;
};

// D5：capacity 沿用既有 EXPECTED_PARTICIPANTS_MIN/MAX 先例（1–500）。
export const CAPACITY_MIN = EXPECTED_PARTICIPANTS_MIN;
export const CAPACITY_MAX = EXPECTED_PARTICIPANTS_MAX;
export const TITLE_MAX_LENGTH = 200;
export const LOCATION_MAX_LENGTH = 200;
// D3：description 選填，若提供上限比照 DemandRequest.description 的上限，
// 但不套用其下限（20 字），因為此欄位選填、不要求「具體」。
export const DESCRIPTION_MAX_LENGTH = 2000;

export type ClassSessionValidationErrorCode =
  | "title_required"
  | "title_too_long"
  | "description_too_long"
  | "service_type_required"
  | "service_type_invalid"
  | "service_type_too_many"
  | YogaStylesIssue
  | "location_required"
  | "location_too_long"
  | "capacity_required"
  | "capacity_out_of_range"
  | "start_at_invalid"
  | "start_at_in_past"
  | "end_at_invalid"
  | "end_at_not_after_start_at";

export type ClassSessionValidationError = {
  field:
    | "title"
    | "description"
    | "serviceType"
    | "yogaStyles"
    | "location"
    | "capacity"
    | "startAt"
    | "endAt";
  code: ClassSessionValidationErrorCode;
  message: string;
};

export type ClassSessionValidationResult =
  | {
      valid: true;
      normalized: {
        title: string;
        description: string | null;
        serviceType: string;
        serviceTypes: string[];
        yogaStyles: string[];
        startAt: Date;
        endAt: Date;
        location: string;
        capacity: number;
        isPublic: boolean;
      };
    }
  | {
      valid: false;
      errors: ClassSessionValidationError[];
    };

// D3/D4/D5/D6/D7/D13：建立當下一次到位驗證，沒有草稿階段可以放寬。
export function validateClassSessionCreate(
  input: ClassSessionCreateInput,
  options: { requireYogaStyles?: boolean } = {},
): ClassSessionValidationResult {
  const errors: ClassSessionValidationError[] = [];

  const normalizedTitle = typeof input.title === "string" ? input.title.trim() : "";
  const normalizedDescription =
    typeof input.description === "string" && input.description.trim().length > 0
      ? input.description.trim()
      : null;
  const normalizedServiceTypes = normalizeYogaStyles(
    input.serviceTypes && input.serviceTypes.length > 0
      ? input.serviceTypes
      : input.serviceType
        ? [input.serviceType]
        : [],
  );
  const normalizedServiceType = normalizedServiceTypes[0] ?? "";
  const normalizedLocation =
    typeof input.location === "string" ? input.location.trim() : "";
  const isPublic = input.isPublic === true;

  if (normalizedTitle.length === 0) {
    errors.push({ field: "title", code: "title_required", message: "課程名稱為必填。" });
  } else if (normalizedTitle.length > TITLE_MAX_LENGTH) {
    errors.push({
      field: "title",
      code: "title_too_long",
      message: `課程名稱不可超過 ${TITLE_MAX_LENGTH} 個字。`,
    });
  }

  if (normalizedDescription && normalizedDescription.length > DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: "description",
      code: "description_too_long",
      message: `課程說明不可超過 ${DESCRIPTION_MAX_LENGTH} 個字。`,
    });
  }

  // D4：serviceType 必填，即使是從 demand pre-fill 帶入，Organizer 也可能清空。
  // 2026-09-26：老師建課的課程風格可多選（1–3 個），第一個當作主要風格寫入 serviceType。
  if (normalizedServiceTypes.length === 0) {
    errors.push({
      field: "serviceType",
      code: "service_type_required",
      message: "課程風格為必填。",
    });
  } else if (!normalizedServiceTypes.every((value) => isValidServiceType(value))) {
    errors.push({
      field: "serviceType",
      code: "service_type_invalid",
      message: "課程風格須從受控清單中選擇。",
    });
  } else if (normalizedServiceTypes.length > MAX_SERVICE_TYPES) {
    errors.push({
      field: "serviceType",
      code: "service_type_too_many",
      message: `課程風格最多選 ${MAX_SERVICE_TYPES} 項。`,
    });
  }

  const normalizedYogaStyles = normalizeYogaStyles(input.yogaStyles);
  const yogaStylesIssue = checkYogaStyles(normalizedYogaStyles, {
    required: options.requireYogaStyles === true,
  });

  if (yogaStylesIssue) {
    errors.push({
      field: "yogaStyles",
      code: yogaStylesIssue,
      message: YOGA_STYLES_ISSUE_MESSAGES[yogaStylesIssue],
    });
  }

  if (normalizedLocation.length === 0) {
    errors.push({ field: "location", code: "location_required", message: "地點為必填。" });
  } else if (normalizedLocation.length > LOCATION_MAX_LENGTH) {
    errors.push({
      field: "location",
      code: "location_too_long",
      message: `地點不可超過 ${LOCATION_MAX_LENGTH} 個字。`,
    });
  }

  if (
    typeof input.capacity !== "number" ||
    !Number.isInteger(input.capacity)
  ) {
    errors.push({
      field: "capacity",
      code: "capacity_required",
      message: "名額上限為必填。",
    });
  } else if (input.capacity < CAPACITY_MIN || input.capacity > CAPACITY_MAX) {
    errors.push({
      field: "capacity",
      code: "capacity_out_of_range",
      message: `名額上限需介於 ${CAPACITY_MIN}–${CAPACITY_MAX} 人之間。`,
    });
  }

  const startAt =
    typeof input.startAt === "string" ? parseTaipeiDatetimeLocal(input.startAt) : null;
  const endAt =
    typeof input.endAt === "string" ? parseTaipeiDatetimeLocal(input.endAt) : null;

  if (!startAt) {
    errors.push({
      field: "startAt",
      code: "start_at_invalid",
      message: "開始時間格式不正確。",
    });
  } else if (startAt.getTime() <= Date.now()) {
    errors.push({
      field: "startAt",
      code: "start_at_in_past",
      message: "開始時間必須晚於現在。",
    });
  }

  if (!endAt) {
    errors.push({ field: "endAt", code: "end_at_invalid", message: "結束時間格式不正確。" });
  } else if (startAt && endAt.getTime() <= startAt.getTime()) {
    errors.push({
      field: "endAt",
      code: "end_at_not_after_start_at",
      message: "結束時間必須晚於開始時間。",
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    normalized: {
      title: normalizedTitle,
      description: normalizedDescription,
      serviceType: normalizedServiceType,
      serviceTypes: normalizedServiceTypes,
      yogaStyles: normalizedYogaStyles,
      startAt: startAt as Date,
      endAt: endAt as Date,
      location: normalizedLocation,
      capacity: input.capacity as number,
      isPublic,
    },
  };
}
