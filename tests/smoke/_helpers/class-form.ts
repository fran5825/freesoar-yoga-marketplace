import type { Page } from "@playwright/test";

// 建課表單的「課程風格」是多選標籤（見 ClassSessionCreateForm 的 ServiceTypesField）。
export async function pickServiceType(page: Page, label: string) {
  await page.locator("#service-types-field").getByText(label, { exact: true }).click();
}

// 固定期課程的日期：在三個月的月曆上點選；日期不在畫面上時往後翻月。
export async function addFixedDate(page: Page, date: string) {
  const dayButton = page.locator(`#fixed-dates-field button[data-date="${date}"]`);

  for (let attempt = 0; attempt < 24 && (await dayButton.count()) === 0; attempt += 1) {
    await page.getByRole("button", { name: "往後一個月" }).click();
  }

  await dayButton.click();
}
