import { parseAvailabilityExceptionDate } from "./date-format";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LOCATION_AREA_MAX_LENGTH = 100;
export const AVAILABILITY_EXCEPTION_REASON_MAX_LENGTH = 500;

export type TeacherAvailabilityInput = {
  dayOfWeek: number | null | undefined;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  locationArea?: string | null;
};

export type TeacherAvailabilityValidationErrorCode =
  | "day_of_week_invalid"
  | "start_time_invalid"
  | "end_time_invalid"
  | "time_range_invalid"
  | "location_area_too_long";

export type TeacherAvailabilityValidationError = {
  field: "dayOfWeek" | "startTime" | "endTime" | "locationArea";
  code: TeacherAvailabilityValidationErrorCode;
  message: string;
};

export type TeacherAvailabilityValidationResult =
  | {
      valid: true;
      normalized: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        locationArea: string | null;
      };
    }
  | { valid: false; errors: TeacherAvailabilityValidationError[] };

// D3/D11：dayOfWeek 0–6、startTime/endTime 為 HH:mm 且 startTime < endTime（字串比較即可，
// 因為零填補的 HH:mm 字典序等同時間序，但只在同一天內成立——不支援跨夜區間）。不做同一天
// 多筆記錄的重疊檢查（D3）。
export function validateTeacherAvailabilityInput(
  input: TeacherAvailabilityInput,
): TeacherAvailabilityValidationResult {
  const errors: TeacherAvailabilityValidationError[] = [];

  const dayOfWeek =
    typeof input.dayOfWeek === "number" ? input.dayOfWeek : Number(input.dayOfWeek);

  if (
    input.dayOfWeek === null ||
    input.dayOfWeek === undefined ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    errors.push({
      field: "dayOfWeek",
      code: "day_of_week_invalid",
      message: "請選擇星期幾。",
    });
  }

  const startTime = typeof input.startTime === "string" ? input.startTime.trim() : "";
  const endTime = typeof input.endTime === "string" ? input.endTime.trim() : "";

  if (!TIME_PATTERN.test(startTime)) {
    errors.push({
      field: "startTime",
      code: "start_time_invalid",
      message: "開始時間格式不正確。",
    });
  }

  if (!TIME_PATTERN.test(endTime)) {
    errors.push({
      field: "endTime",
      code: "end_time_invalid",
      message: "結束時間格式不正確。",
    });
  }

  if (
    TIME_PATTERN.test(startTime) &&
    TIME_PATTERN.test(endTime) &&
    startTime >= endTime
  ) {
    errors.push({
      field: "endTime",
      code: "time_range_invalid",
      message: "結束時間必須晚於開始時間（不支援跨夜區間）。",
    });
  }

  const normalizedLocationArea =
    typeof input.locationArea === "string" && input.locationArea.trim().length > 0
      ? input.locationArea.trim()
      : null;

  if (normalizedLocationArea && normalizedLocationArea.length > LOCATION_AREA_MAX_LENGTH) {
    errors.push({
      field: "locationArea",
      code: "location_area_too_long",
      message: `地區不可超過 ${LOCATION_AREA_MAX_LENGTH} 個字。`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    normalized: {
      dayOfWeek,
      startTime,
      endTime,
      locationArea: normalizedLocationArea,
    },
  };
}

export type AvailabilityExceptionInput = {
  date: string | null | undefined;
  type: string | null | undefined;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
};

export type AvailabilityExceptionValidationErrorCode =
  | "date_invalid"
  | "type_invalid"
  | "start_time_invalid"
  | "end_time_invalid"
  | "time_range_invalid"
  | "time_range_incomplete"
  | "reason_too_long";

export type AvailabilityExceptionValidationError = {
  field: "date" | "type" | "startTime" | "endTime" | "reason";
  code: AvailabilityExceptionValidationErrorCode;
  message: string;
};

export type AvailabilityExceptionValidationResult =
  | {
      valid: true;
      normalized: {
        date: Date;
        type: "blocked" | "extra_available";
        startTime: string | null;
        endTime: string | null;
        reason: string | null;
      };
    }
  | { valid: false; errors: AvailabilityExceptionValidationError[] };

// D4/D5/D11：startTime/endTime 必須同時提供或同時不提供（皆無代表整天），date 用
// parseAvailabilityExceptionDate 驗證（拒絕格式錯誤或不存在的日期，如 2026-02-31）。
export function validateAvailabilityExceptionInput(
  input: AvailabilityExceptionInput,
): AvailabilityExceptionValidationResult {
  const errors: AvailabilityExceptionValidationError[] = [];

  const parsedDate =
    typeof input.date === "string" ? parseAvailabilityExceptionDate(input.date) : null;

  if (!parsedDate) {
    errors.push({
      field: "date",
      code: "date_invalid",
      message: "請選擇正確的日期。",
    });
  }

  const type = input.type === "blocked" || input.type === "extra_available" ? input.type : null;

  if (!type) {
    errors.push({
      field: "type",
      code: "type_invalid",
      message: "請選擇類型。",
    });
  }

  const startTimeProvided = typeof input.startTime === "string" && input.startTime.trim().length > 0;
  const endTimeProvided = typeof input.endTime === "string" && input.endTime.trim().length > 0;
  const startTime = startTimeProvided ? (input.startTime as string).trim() : null;
  const endTime = endTimeProvided ? (input.endTime as string).trim() : null;

  if (startTimeProvided !== endTimeProvided) {
    errors.push({
      field: startTimeProvided ? "endTime" : "startTime",
      code: "time_range_incomplete",
      message: "開始時間與結束時間必須同時填寫，或都留空（代表整天）。",
    });
  } else if (startTime && endTime) {
    if (!TIME_PATTERN.test(startTime)) {
      errors.push({
        field: "startTime",
        code: "start_time_invalid",
        message: "開始時間格式不正確。",
      });
    }

    if (!TIME_PATTERN.test(endTime)) {
      errors.push({
        field: "endTime",
        code: "end_time_invalid",
        message: "結束時間格式不正確。",
      });
    }

    if (TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && startTime >= endTime) {
      errors.push({
        field: "endTime",
        code: "time_range_invalid",
        message: "結束時間必須晚於開始時間（不支援跨夜區間）。",
      });
    }
  }

  const normalizedReason =
    typeof input.reason === "string" && input.reason.trim().length > 0
      ? input.reason.trim()
      : null;

  if (normalizedReason && normalizedReason.length > AVAILABILITY_EXCEPTION_REASON_MAX_LENGTH) {
    errors.push({
      field: "reason",
      code: "reason_too_long",
      message: `原因不可超過 ${AVAILABILITY_EXCEPTION_REASON_MAX_LENGTH} 個字。`,
    });
  }

  if (errors.length > 0 || !parsedDate || !type) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    normalized: {
      date: parsedDate,
      type,
      startTime,
      endTime,
      reason: normalizedReason,
    },
  };
}
