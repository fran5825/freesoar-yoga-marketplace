import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const accountPath = "/account";
const testEmailDomain = "account-dashboard-navigation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

// organizer-usability 票 03：/account 依身分列出入口，沒有的身分顯示「開始成為…」。
test.describe("/account dashboard navigation smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    await page.goto(accountPath, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("a signed-in user with no organizer or teacher identity sees the member entry plus become-organizer and become-teacher entries", async ({
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

    await expect(
      page.getByRole("heading", { name: "我的使用入口" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /會員總覽/ })).toHaveAttribute(
      "href",
      "/member/dashboard",
    );
    await expect(
      page.getByRole("link", { name: /開始成為團主/ }),
    ).toHaveAttribute("href", "/organizers/request");
    await expect(
      page.getByRole("link", { name: /開始成為老師/ }),
    ).toHaveAttribute("href", "/teachers/join");
    await expect(page.getByRole("link", { name: /^團主 團主總覽/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^老師 老師總覽/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: /會員總覽/ }).click();
    await expect(page).toHaveURL(/\/member\/dashboard$/);
    await expect(page.getByRole("heading", { name: "我的總覽" })).toBeVisible();
  });

  test("a user who is both an organizer and a teacher sees both dashboards and no become-entries", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-both-${Date.now()}`,
    );
    const email = `account-both-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Both Organizer ${testRunId}`,
      organizationName: `Both Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.teacherProfile.create({
      data: { userId: user.id, displayName: `Both Teacher ${testRunId}` },
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto(accountPath);

    await expect(page.getByRole("link", { name: /團主總覽/ })).toHaveAttribute(
      "href",
      "/organizer/dashboard",
    );
    await expect(page.getByRole("link", { name: /老師總覽/ })).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );
    await expect(page.getByRole("link", { name: /開始成為團主/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /開始成為老師/ })).toHaveCount(0);
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
