import { expect, test } from "@playwright/test";

import { addAuthSessionCookie, normalizeForEmail, prisma } from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// 2026-09-26：「可授課時間」併入「老師資料」，成為第一個分頁。

const testEmailDomain = "teacher-profile-tabs-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test("老師資料 has two tabs (可授課時間 first, 個人資料 second), the nav no longer lists 可授課時間, and the old URL redirects", async ({
  context,
  page,
}, testInfo) => {
  const testRunId = normalizeForEmail(
    `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const email = `tabs-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({
    email,
    displayName: `Tabs ${testRunId}`,
    status: "approved",
  });

  await addAuthSessionCookie(context, teacher.sessionToken);

  // 舊網址轉到老師資料的第一個分頁。
  await page.goto("/teacher/availability");
  await expect(page).toHaveURL(/\/teacher\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "老師資料" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "固定可授課時段" })).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "老師資料分頁" }).getByRole("link");
  await expect(tabs).toHaveText(["可授課時間", "個人資料"]);
  await expect(tabs.nth(0)).toHaveAttribute("aria-current", "page");

  // 導覽列只剩「老師資料」，沒有「可授課時間」；兩個分頁都標示在「老師資料」。
  const nav = page.getByRole("navigation", { name: "老師專區導覽", includeHidden: true });
  await expect(nav.getByRole("link", { name: "可授課時間", includeHidden: true })).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "老師資料", includeHidden: true }),
  ).toHaveAttribute("aria-current", "page");

  await tabs.nth(1).click();
  await expect(page).toHaveURL(/\/teacher\/profile\/info$/);
  await expect(page.getByLabel("公開顯示名稱")).toHaveValue(`Tabs ${testRunId}`);
  await expect(
    page.getByRole("navigation", { name: "老師資料分頁" }).getByRole("link", { name: "個人資料" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("navigation", { name: "老師專區導覽", includeHidden: true })
      .getByRole("link", { name: "老師資料", includeHidden: true }),
  ).toHaveAttribute("aria-current", "page");
});
