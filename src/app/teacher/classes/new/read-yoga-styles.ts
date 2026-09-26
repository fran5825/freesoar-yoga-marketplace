// 建課表單送出的瑜伽風格：勾選的標籤（多個 name="yogaStyles"）加上「其他」自訂文字
// （name="yogaStylesOther"，可用頓號、逗號或換行分隔多項）。整理與驗證在 domain 層的 yoga-styles.ts。
export function readYogaStylesFromForm(formData: FormData): string[] {
  const selected = formData
    .getAll("yogaStyles")
    .filter((value): value is string => typeof value === "string");
  const otherValue = formData.get("yogaStylesOther");
  const other =
    typeof otherValue === "string"
      ? otherValue.split(/[、,，\n]/).map((item) => item.trim())
      : [];

  return [...selected, ...other];
}

// 課程風格（可多選）：勾選的標籤用多個 name="serviceTypes" 帶出；第一個是主要風格。
export function readServiceTypesFromForm(formData: FormData): string[] {
  return formData
    .getAll("serviceTypes")
    .filter((value): value is string => typeof value === "string");
}
