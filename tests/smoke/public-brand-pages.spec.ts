import { expect, test } from "@playwright/test";

const publicPages = [
  { path: "/", heading: "連結好老師與真實需求的瑜伽團課 marketplace" },
  { path: "/about", heading: "讓自由與覺察，長成有品質的共同練習" },
  { path: "/faq", heading: "開始以前，先把重要的事說清楚" },
];

test.describe("public brand foundation", () => {
  for (const publicPage of publicPages) {
    test(`${publicPage.path} presents Traditional Chinese brand content without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(publicPage.path);

      expect(response?.ok()).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
      await expect(page.getByRole("heading", { level: 1, name: publicPage.heading })).toBeVisible();
      await expect(page.getByRole("link", { name: "FREE SOAR YOGA" })).toHaveAttribute("href", "/");

      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow.body).toBeLessThanOrEqual(1);
      expect(overflow.document).toBeLessThanOrEqual(1);
    });
  }

  test("home exposes the approved public entry points and metadata", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Free Soar Yoga｜瑜伽團課共創平台");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /品牌導向的瑜伽團課 marketplace/);
    await expect(page.getByRole("link", { name: "我是瑜伽老師" })).toHaveAttribute("href", "/teachers/join");
    await expect(page.getByRole("link", { name: "我想發起團課" })).toHaveAttribute("href", "/organizers/request");
    await expect(page.getByRole("link", { name: "關於我們" }).first()).toHaveAttribute("href", "/about");
    await expect(page.getByRole("link", { name: "常見問題" }).first()).toHaveAttribute("href", "/faq");
    await expect(page.getByRole("link", { name: "登入" })).toHaveAttribute("href", "/sign-in");
  });

  test("faq states the current trust boundary without payment or outcome promises", async ({ page }) => {
    await page.goto("/faq");

    await expect(page.getByText("目前 V1 不提供完整的線上付款與退款自動化。", { exact: false })).toBeAttached();
    await expect(page.getByText("不構成醫療建議、療效承諾或所有風險的保證。", { exact: false })).toBeAttached();
  });

  test("home remains readable across the RWD checklist widths", async ({ page }) => {
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasHorizontalOverflow, `unexpected horizontal overflow at ${width}px`).toBe(false);
    }
  });
});
