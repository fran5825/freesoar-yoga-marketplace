// 建課表單送出後的結果（teacher-usability-redesign 票 01 單堂、票 02 系列）。
// 失敗時 Server Action 回傳這個物件，不再導回空白表單；表單內容存在 client state，所以原輸入會保留。
// 成功時 Server Action 直接 redirect 到課程詳情頁，不會回到這裡。

export type CreateClassFormField =
  | "title"
  | "serviceTypes"
  | "yogaStyles"
  | "date"
  | "time"
  | "location"
  | "capacity"
  | "description"
  | "dayOfWeek"
  | "startDate"
  | "generateCount"
  | "dates";

export type CreateClassFormState =
  | { status: "idle" }
  | {
      status: "error";
      // 哪一種排程送出的：系列兩種模式共用同一個 action，錯誤只顯示在送出的那個表單。
      mode: "single" | "weekly" | "fixed_dates";
      code: string;
      message: string;
      fieldErrors: Partial<Record<CreateClassFormField, string[]>>;
    };

export const initialCreateClassFormState: CreateClassFormState = { status: "idle" };

// 欄位在畫面上的順序：錯誤時把焦點帶到最前面那個可以修正的欄位。
export const CREATE_CLASS_FIELD_ORDER: CreateClassFormField[] = [
  "title",
  "serviceTypes",
  "yogaStyles",
  "description",
  "date",
  "dayOfWeek",
  "startDate",
  "generateCount",
  "dates",
  "time",
  "location",
  "capacity",
];

// domain 驗證錯誤的欄位名稱 → 表單欄位。startAt／endAt（單堂）、startTime／endTime（系列）在表單上都是
// 時、分下拉選單，統一指到時間。
export function formFieldForValidationField(field: string): CreateClassFormField | null {
  switch (field) {
    case "title":
    case "location":
    case "capacity":
    case "description":
    case "yogaStyles":
    case "dayOfWeek":
    case "startDate":
    case "generateCount":
    case "dates":
      return field;
    case "serviceType":
    case "serviceTypes":
      return "serviceTypes";
    case "startAt":
    case "endAt":
    case "startTime":
    case "endTime":
      return "time";
    default:
      return null;
  }
}

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export function dayOfWeekLabel(dayOfWeek: number): string {
  return dayOfWeekLabels[dayOfWeek] ?? "";
}

// YYYY-MM-DD 是星期幾（0＝週日）。只看日曆日期本身，不經過時區換算。
export function weekdayOfDateString(date: string): number | null {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatDateWithWeekday(date: string): string {
  const weekday = weekdayOfDateString(date);

  return weekday === null ? date : `${date}（${dayOfWeekLabels[weekday]}）`;
}

export function buildCreateClassFieldErrors(
  validationErrors?: { field: string; message: string }[],
): Partial<Record<CreateClassFormField, string[]>> {
  const fieldErrors: Partial<Record<CreateClassFormField, string[]>> = {};

  for (const error of validationErrors ?? []) {
    const field = formFieldForValidationField(error.field);

    if (field) {
      fieldErrors[field] = [...(fieldErrors[field] ?? []), error.message];
    }
  }

  return fieldErrors;
}
