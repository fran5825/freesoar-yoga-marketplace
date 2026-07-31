import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const accountPath = "/account";
const testEmailDomain = "account-dashboard-navigation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  if (createdEmails.length > 0) {
    await prisma.session.deleteMany({
      where: { user: { email: { in: createdEmails } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }

  await prisma.$disconnect();
});

test.describe("/account dashboard navigation smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    await page.goto(accountPath, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("offers signed-in users working links to the member and organizer dashboards", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const email = `account-entry-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });

    await addAuthSessionCookie(context, sessionToken);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(accountPath);

    const memberDashboardLink = page.getByRole("link", { name: /會員總覽/ });
    const organizerDashboardLink = page.getByRole("link", { name: /團主總覽/ });

    await expect(
      page.getByRole("heading", { name: "我的使用入口" }),
    ).toBeVisible();
    await expect(memberDashboardLink).toHaveAttribute("href", "/member/dashboard");
    await expect(organizerDashboardLink).toHaveAttribute(
      "href",
      "/organizer/dashboard",
    );
    await expectNoHorizontalOverflow(page);

    await memberDashboardLink.click();
    await expect(page).toHaveURL(/\/member\/dashboard$/);
    await expect(page.getByRole("heading", { name: "我的總覽" })).toBeVisible();

    await page.goto(accountPath);
    await page.getByRole("link", { name: /團主總覽/ }).click();
    await expect(page).toHaveURL(/\/organizer\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "請先建立團主資料" }),
    ).toBeVisible();
  });
});

async function expectNoHorizontalOverflow(page: {
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
}) {
  const overflow = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth);
  expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.docClientWidth);
}
