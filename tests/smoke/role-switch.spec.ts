import { expect, test, type Page } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const testEmailDomain = "role-switch-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

// admin-usability 票 02：導覽列右側「角色切換」只列出這個帳號已有的身分；管理後台只給管理員看。
async function openRoleSwitch(page: Page) {
  // 手機版導覽列收在「選單」裡，桌機版本來就展開。
  const menuButton = page.getByRole("button", { name: "選單", exact: true });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page.getByRole("button", { name: /目前身分/ }).click();
  return page.locator("#role-switch-menu");
}

async function createMultiRoleUser({
  email,
  isAdmin,
  testRunId,
}: {
  email: string;
  isAdmin: boolean;
  testRunId: string;
}) {
  createdEmails.push(email);
  const { sessionToken } = await createOrganizerProfileWithOrganization({
    email,
    displayName: `Switch Organizer ${testRunId}`,
    organizationName: `Switch Org ${testRunId}`,
    contactName: "聯絡人",
    contactEmail: `contact-${testRunId}@example.com`,
    contactPhone: "0900000000",
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.teacherProfile.create({
    data: { userId: user.id, displayName: `Switch Teacher ${testRunId}` },
  });
  if (isAdmin) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }
  return sessionToken;
}

test.describe("role switch smoke", () => {
  test("an admin who is also organizer and teacher can switch between all four identities from any area", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-admin-${Date.now()}`,
    );
    const sessionToken = await createMultiRoleUser({
      email: `switch-admin-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
      testRunId,
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/admin/dashboard");
    let menu = await openRoleSwitch(page);
    await expect(menu.getByRole("link")).toHaveText(["學員", "團主", "老師", "管理後台"]);
    await expect(menu.getByRole("link", { name: "管理後台" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await menu.getByRole("link", { name: "老師" }).click();
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);

    menu = await openRoleSwitch(page);
    await expect(menu.getByRole("link", { name: "老師" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await menu.getByRole("link", { name: "團主" }).click();
    await expect(page).toHaveURL(/\/organizer\/dashboard$/);

    menu = await openRoleSwitch(page);
    await menu.getByRole("link", { name: "管理後台" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

  });

  test("the role switch closes when clicking elsewhere or pressing Escape", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-close-${Date.now()}`,
    );
    const sessionToken = await createMultiRoleUser({
      email: `switch-close-${testRunId}@${testEmailDomain}`,
      isAdmin: false,
      testRunId,
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/dashboard");
    const menu = await openRoleSwitch(page);
    await expect(menu).toBeVisible();

    await page.getByRole("heading", { level: 1 }).click();
    await expect(menu).toHaveCount(0);

    await page.getByRole("button", { name: /目前身分/ }).click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("a non-admin organizer and teacher never sees the admin entry, and /admin stays 404", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-plain-${Date.now()}`,
    );
    const sessionToken = await createMultiRoleUser({
      email: `switch-plain-${testRunId}@${testEmailDomain}`,
      isAdmin: false,
      testRunId,
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/dashboard");
    const menu = await openRoleSwitch(page);
    await expect(menu.getByRole("link")).toHaveText(["學員", "團主", "老師"]);

    const response = await page.goto("/admin/dashboard");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "管理後台" })).toHaveCount(0);
  });

  test("a member with no other identity sees join entries for organizer and teacher instead of an account page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-member-${Date.now()}`,
    );
    const email = `switch-member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/member/dashboard");
    const menu = await openRoleSwitch(page);

    await expect(menu.getByRole("link")).toHaveText(["學員", "＋ 成為團主", "＋ 成為老師"]);
    await expect(menu.getByRole("link", { name: "＋ 成為團主" })).toHaveAttribute(
      "href",
      "/organizers/request",
    );
    await expect(menu.getByRole("link", { name: "＋ 成為老師" })).toHaveAttribute(
      "href",
      "/teachers/join",
    );

    // 「我的帳戶」頁面已移除。
    const response = await page.goto("/account");
    expect(response?.status()).toBe(404);
  });
});
