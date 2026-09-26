// 課程的「瑜伽類型」（2026-09-26）：老師建立課程時說明這堂課是哪種瑜伽，可多選標籤，
// 也可以補一個自訂項目。選項清單來源同老師「擅長類型」（見 teachers/join 的 SPECIALTY_GROUPS），
// 但這裡不限定只能是清單內的值——自訂項目與日後新增的標籤都要能存，所以只驗證數量與長度。
export const YOGA_STYLES_MAX_COUNT = 10;
export const YOGA_STYLE_MAX_LENGTH = 50;

export type YogaStylesIssue =
  | "yoga_styles_required"
  | "yoga_styles_too_many"
  | "yoga_style_too_long";

// 去除前後空白、去掉空項目與重複項目，保留原本順序。
export function normalizeYogaStyles(input: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of input ?? []) {
    const trimmed = typeof item === "string" ? item.trim() : "";

    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}

export function checkYogaStyles(
  styles: readonly string[],
  { required }: { required: boolean },
): YogaStylesIssue | null {
  if (required && styles.length === 0) {
    return "yoga_styles_required";
  }

  if (styles.length > YOGA_STYLES_MAX_COUNT) {
    return "yoga_styles_too_many";
  }

  if (styles.some((style) => style.length > YOGA_STYLE_MAX_LENGTH)) {
    return "yoga_style_too_long";
  }

  return null;
}

export const YOGA_STYLES_ISSUE_MESSAGES: Record<YogaStylesIssue, string> = {
  yoga_styles_required: "請至少選擇一種瑜伽類型，或在「其他」填寫。",
  yoga_styles_too_many: `瑜伽類型最多 ${YOGA_STYLES_MAX_COUNT} 項。`,
  yoga_style_too_long: `每一項瑜伽類型不可超過 ${YOGA_STYLE_MAX_LENGTH} 個字。`,
};
