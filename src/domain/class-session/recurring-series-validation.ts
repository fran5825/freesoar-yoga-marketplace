// teacher-initiated-open-classes Slice B：RecurringClassSeries 建立輸入驗證。title／
// description／serviceType／location／capacity 這五個欄位的規則與上限，刻意直接沿用
// validation.ts（單堂建課）已經驗證過的常數與規則，不重新發明一份可能漂移的第二版規則。
// startTime／endTime 的 HH:mm 格式檢查比照 teacher-availability/validation.ts 的既有慣例。

import { isValidServiceType } from "@/domain/demand-request/service-types";
import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "./validation";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Gate G4 = A：手動生成，不做背景排程。單次生成上限刻意保守（約半年的每週課程），
// 避免一次點擊造成大量 conflict-check transaction 或大量通知。
export const WEEKLY_GENERATE_COUNT_MIN = 1;
export const WEEKLY_GENERATE_COUNT_MAX = 26;
export const FIXED_DATES_COUNT_MIN = 1;
export const FIXED_DATES_COUNT_MAX = 26;

export type RecurringSeriesInput = {
  title?: string | null;
  description?: string | null;
  serviceType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  capacity?: number | null;
  // 第 8 節（Gate G2/G3）：套用到這個系列底下生成的每一場，套用時機由 Slice C 決定，
  // schema 上的欄位（RecurringClassSeries.requiresApproval）第 5 節就已經定案。
  requiresApproval?: boolean | null;
  mode?: string | null;
  // mode === "weekly"
  dayOfWeek?: number | null;
  generateCount?: number | null;
  // mode === "fixed_dates"
  dates?: string[] | null;
};

export type RecurringSeriesValidationErrorCode =
  | "title_required"
  | "title_too_long"
  | "description_too_long"
  | "service_type_required"
  | "service_type_invalid"
  | "location_required"
  | "location_too_long"
  | "capacity_required"
  | "capacity_out_of_range"
  | "start_time_invalid"
  | "end_time_invalid"
  | "time_range_invalid"
  | "mode_invalid"
  | "day_of_week_invalid"
  | "generate_count_invalid"
  | "dates_invalid"
  | "dates_empty";

export type RecurringSeriesValidationError = {
  field:
    | "title"
    | "description"
    | "serviceType"
    | "location"
    | "capacity"
    | "startTime"
    | "endTime"
    | "mode"
    | "dayOfWeek"
    | "generateCount"
    | "dates";
  code: RecurringSeriesValidationErrorCode;
  message: string;
};

type NormalizedBaseFields = {
  title: string;
  description: string | null;
  serviceType: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  requiresApproval: boolean;
};

export type RecurringSeriesSchedule =
  | { mode: "weekly"; dayOfWeek: number; generateCount: number }
  | { mode: "fixed_dates"; dates: string[] };

export type RecurringSeriesValidationResult =
  | {
      valid: true;
      normalized: NormalizedBaseFields;
      schedule: RecurringSeriesSchedule;
    }
  | { valid: false; errors: RecurringSeriesValidationError[] };

export function validateRecurringSeriesInput(
  input: RecurringSeriesInput,
): RecurringSeriesValidationResult {
  const errors: RecurringSeriesValidationError[] = [];

  const normalizedTitle = typeof input.title === "string" ? input.title.trim() : "";
  const normalizedDescription =
    typeof input.description === "string" && input.description.trim().length > 0
      ? input.description.trim()
      : null;
  const normalizedServiceType =
    typeof input.serviceType === "string" ? input.serviceType.trim() : "";
  const normalizedLocation = typeof input.location === "string" ? input.location.trim() : "";
  const startTime = typeof input.startTime === "string" ? input.startTime.trim() : "";
  const endTime = typeof input.endTime === "string" ? input.endTime.trim() : "";

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

  if (normalizedServiceType.length === 0) {
    errors.push({
      field: "serviceType",
      code: "service_type_required",
      message: "課程類型為必填。",
    });
  } else if (!isValidServiceType(normalizedServiceType)) {
    errors.push({
      field: "serviceType",
      code: "service_type_invalid",
      message: "課程類型須從受控清單中選擇。",
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

  if (typeof input.capacity !== "number" || !Number.isInteger(input.capacity)) {
    errors.push({ field: "capacity", code: "capacity_required", message: "名額上限為必填。" });
  } else if (input.capacity < CAPACITY_MIN || input.capacity > CAPACITY_MAX) {
    errors.push({
      field: "capacity",
      code: "capacity_out_of_range",
      message: `名額上限需介於 ${CAPACITY_MIN}–${CAPACITY_MAX} 人之間。`,
    });
  }

  if (!TIME_PATTERN.test(startTime)) {
    errors.push({ field: "startTime", code: "start_time_invalid", message: "開始時間格式不正確。" });
  }

  if (!TIME_PATTERN.test(endTime)) {
    errors.push({ field: "endTime", code: "end_time_invalid", message: "結束時間格式不正確。" });
  }

  if (TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && startTime >= endTime) {
    errors.push({
      field: "endTime",
      code: "time_range_invalid",
      message: "結束時間必須晚於開始時間（不支援跨夜區間）。",
    });
  }

  let schedule: RecurringSeriesSchedule;

  if (input.mode === "weekly") {
    const dayOfWeek =
      typeof input.dayOfWeek === "number" ? input.dayOfWeek : Number(input.dayOfWeek);

    if (
      input.dayOfWeek === null ||
      input.dayOfWeek === undefined ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      errors.push({ field: "dayOfWeek", code: "day_of_week_invalid", message: "請選擇星期幾。" });
    }

    const generateCount =
      typeof input.generateCount === "number"
        ? input.generateCount
        : Number(input.generateCount);

    if (
      !Number.isInteger(generateCount) ||
      generateCount < WEEKLY_GENERATE_COUNT_MIN ||
      generateCount > WEEKLY_GENERATE_COUNT_MAX
    ) {
      errors.push({
        field: "generateCount",
        code: "generate_count_invalid",
        message: `首次生成場次數需介於 ${WEEKLY_GENERATE_COUNT_MIN}–${WEEKLY_GENERATE_COUNT_MAX} 之間。`,
      });
    }

    schedule = { mode: "weekly", dayOfWeek, generateCount };
  } else if (input.mode === "fixed_dates") {
    const rawDates = Array.isArray(input.dates) ? input.dates : [];
    const trimmedDates = rawDates.map((date) => (typeof date === "string" ? date.trim() : ""));
    const nonEmptyDates = trimmedDates.filter((date) => date.length > 0);

    if (nonEmptyDates.length === 0) {
      errors.push({ field: "dates", code: "dates_empty", message: "請至少提供一個日期。" });
    } else if (
      nonEmptyDates.length < FIXED_DATES_COUNT_MIN ||
      nonEmptyDates.length > FIXED_DATES_COUNT_MAX
    ) {
      errors.push({
        field: "dates",
        code: "dates_invalid",
        message: `日期數量需介於 ${FIXED_DATES_COUNT_MIN}–${FIXED_DATES_COUNT_MAX} 之間。`,
      });
    } else if (!nonEmptyDates.every((date) => DATE_PATTERN.test(date) && isValidCalendarDate(date))) {
      errors.push({ field: "dates", code: "dates_invalid", message: "日期格式不正確。" });
    }

    schedule = { mode: "fixed_dates", dates: nonEmptyDates };
  } else {
    errors.push({ field: "mode", code: "mode_invalid", message: "請選擇課程排程模式。" });
    schedule = { mode: "weekly", dayOfWeek: 0, generateCount: 0 };
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
      startTime,
      endTime,
      location: normalizedLocation,
      capacity: input.capacity as number,
      requiresApproval: input.requiresApproval === true,
    },
    schedule,
  };
}

// 不存在的日期（例如 2 月 31 號）不可被靜默捲成 3 月——比照 timezone.ts 的既有校驗手法，
// 逐欄位往返比對而不是直接信任 JS Date 建構結果。
function isValidCalendarDate(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
