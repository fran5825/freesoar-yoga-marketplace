import { expect, test } from "@playwright/test";

const publicRoutes = [
  {
    path: "/",
    heading: "連結好老師與真實需求的瑜伽團課 marketplace",
    title: "Free Soar Yoga｜瑜伽團課共創平台",
  },
  {
    path: "/about",
    heading: "讓自由與覺察，長成有品質的共同練習",
    title: "關於我們｜Free Soar Yoga",
  },
  {
    path: "/faq",
    heading: "開始以前，先把重要的事說清楚",
    title: "常見問題｜Free Soar Yoga",
  },
  {
    path: "/teachers/join",
    heading: "與我們一起建立更清楚、更安心的瑜伽團課合作",
    title: "Free Soar Yoga｜瑜伽團課共創平台",
  },
  {
    path: "/organizers/request",
    heading: "為公司社團與社區，找到適合的瑜伽老師",
    title: "Free Soar Yoga｜瑜伽團課共創平台",
  },
] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth);
  expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.docClientWidth);
}

test.describe("public trust pages", () => {
  for (const route of publicRoutes) {
    test(`renders ${route.path} with the shared public shell`, async ({ page }) => {
      const response = await page.goto(route.path);

      expect(response?.ok()).toBeTruthy();
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
      await expect(page).toHaveTitle(route.title);
      await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: "Free Soar Yoga" })).toHaveAttribute("href", "/");
      await expect(page.locator("header").getByRole("link", { name: "關於我們" })).toHaveAttribute("href", "/about");
      await expect(page.locator("header").getByRole("link", { name: "常見問題" })).toHaveAttribute("href", "/faq");
      await expect(page.locator("header").getByRole("link", { name: "我是老師" })).toHaveAttribute("href", "/teachers/join");
      await expect(page.locator("header").getByRole("link", { name: "我是主辦人" })).toHaveAttribute("href", "/organizers/request");
      await expect(page.locator("header").getByRole("link", { name: "登入" })).toHaveAttribute("href", "/sign-in");
      await expect(page.locator("header").getByRole("link", { name: "我的帳戶" })).toHaveAttribute("href", "/account");
      await expect(page.locator("footer").getByRole("link", { name: "關於我們" })).toHaveAttribute("href", "/about");
      await expect(page.locator("footer").getByRole("link", { name: "常見問題" })).toHaveAttribute("href", "/faq");
      await expect(page.locator("footer").getByRole("link", { name: "登入" })).toHaveAttribute("href", "/sign-in");
      await expectNoHorizontalOverflow(page);
    });
  }

  test("keeps only teacher and organizer as home primary calls to action", async ({ page }) => {
    await page.goto("/");

    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "我想發起團課", exact: true })).toHaveAttribute("href", "/organizers/request");
    await expect(main.getByRole("link", { name: "我是瑜伽老師", exact: true })).toHaveAttribute("href", "/teachers/join");
    await expect(page.getByText("目前不提供公開課程列表")).toHaveCount(0);
    await expect(page.locator("a[href=\"/classes\"]")).toHaveCount(0);
  });

  test("exposes accessible FAQ answers without inventing cancellation policy", async ({ page }) => {
    await page.goto("/faq");

    const paymentQuestion = page.locator("summary", { hasText: "目前可以在平台上付款或申請退款嗎？" });
    await paymentQuestion.press("Enter");
    await expect(page.getByText(/目前 V1 不提供完整的線上付款與退款自動化/)).toBeVisible();
    await expect(page.getByText(/取消期限|取消費用|退款資格/)).toHaveCount(0);
  });

  test("preserves existing organizer and teacher entry controls", async ({ page }) => {
    await page.goto("/organizers/request");
    await expect(page.getByRole("link", { name: "建立團主資料" })).toHaveAttribute("href", "/organizer/profile");

    await page.goto("/teachers/join");
    await expect(page.getByRole("button", { name: "儲存草稿" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "檢查準備狀態" })).toBeVisible();
    await expect(page.getByRole("button", { name: "送出審核" })).toBeVisible();
  });
});
