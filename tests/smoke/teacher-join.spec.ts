import { expect, test } from "@playwright/test";

test.describe("/teachers/join smoke", () => {
  test("shows teacher application controls and submit confirmation", async ({
    page,
  }) => {
    await page.goto("/teachers/join");

    await expect(
      page.getByRole("heading", {
        name: "與我們一起建立更清楚、更安心的瑜伽團課合作",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存草稿" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "檢查準備狀態" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "送出審核" }).click();

    await expect(page.getByText("確認送出審核").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認送出審核" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "先回來調整" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "先回來調整" }).click();

    await expect(page.getByText("確認送出審核").first()).toBeHidden();
  });
});
