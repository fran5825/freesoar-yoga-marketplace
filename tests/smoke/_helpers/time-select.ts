import type { Page } from "@playwright/test";

// 建課表單的時間是「時」「分」兩個 24 小時制下拉選單（見 ClassSessionCreateForm）。
// idPrefix：單堂 "single-"、常規 "weekly-"、固定期 "fixed-"。
export async function selectFormTime(
  page: Page,
  idPrefix: "single-" | "weekly-" | "fixed-",
  which: "start" | "end",
  time: string,
) {
  const [hour, minute] = time.split(":");
  const id = `#${idPrefix}${which}Time`;

  await page.locator(`${id}-hour`).selectOption(hour);
  await page.locator(`${id}-minute`).selectOption(minute);
}

// 「可授課時間」頁的 24 小時制時間欄位（TimeField24）：時、分兩個下拉選單。
// label 是「時」下拉選單對到的 <label> 全文（例如「開始時間」或「開始時間（選填，留空代表整天）」）。
export async function fillTime24(
  scope: Pick<Page, "getByLabel" | "locator">,
  label: string,
  time: string,
) {
  const [hour, minute] = time.split(":");
  const hourSelect = scope.getByLabel(label, { exact: true });

  await hourSelect.selectOption(hour);
  // 「分」的下拉選單 id 是「時」的 id 加上 -minute（同一頁可能有好幾組同名欄位，用 id 最準）。
  const hourId = await hourSelect.getAttribute("id");
  await scope.locator(`[id="${hourId}-minute"]`).selectOption(minute);
}
