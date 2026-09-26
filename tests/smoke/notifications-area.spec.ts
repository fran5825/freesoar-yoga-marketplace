import { expect, test, type Page } from "@playwright/test";

import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// 2026-09-26：同時是老師與團主的人，從哪個專區點「通知」就留在哪個專區的導覽列。

const testEmailDomain = "notifications-area-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test("a teacher who is also an organizer stays in the teacher area when opening notifications, and vice versa", async ({
  context,
  page,
}, testInfo) => {
  const testRunId = normalizeForEmail(
    `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const email = `dual-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({
    email,
    displayName: `Dual ${testRunId}`,
    status: "approved",
  });
  // 同一個使用者再建立團主資料。
  const organization = await prisma.organization.create({
    data: { name: `Dual Org ${testRunId}`, type: "company" },
    select: { id: true },
  });
  await prisma.organizerProfile.create({
    data: {
      userId: teacher.userId,
      displayName: `Dual Organizer ${testRunId}`,
      organizationId: organization.id,
    },
  });

  await addAuthSessionCookie(context, teacher.sessionToken);

  await page.goto("/teacher/dashboard");
  await openMenuIfCollapsed(page);
  const teacherNav = page.getByRole("navigation", { name: "老師專區導覽" });
  await teacherNav.getByRole("link", { name: "通知" }).first().click();
  await expect(page).toHaveURL(/\/teacher\/notifications$/);
  await expect(page.getByRole("heading", { name: "我的通知" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "老師專區導覽", includeHidden: true })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "團主專區導覽", includeHidden: true })).toHaveCount(0);

  await page.goto("/organizer/dashboard");
  await openMenuIfCollapsed(page);
  await page
    .getByRole("navigation", { name: "團主專區導覽" })
    .getByRole("link", { name: "通知" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/organizer\/notifications$/);
  await expect(page.getByRole("navigation", { name: "團主專區導覽", includeHidden: true })).toHaveCount(1);
});

// 手機版導覽連結收在「選單」按鈕裡。
async function openMenuIfCollapsed(page: Page) {
  const menuButton = page.getByRole("button", { name: "選單" });

  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
}
