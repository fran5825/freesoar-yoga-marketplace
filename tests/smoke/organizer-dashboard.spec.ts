import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const testEmailDomain = "organizer-dashboard-smoke.local";
const dashboardPath = "/organizer/dashboard";
const createdEmails: string[] = [];

test.afterAll(async () => {
  if (createdEmails.length === 0) {
    await prisma.$disconnect();
    return;
  }

  await prisma.demandRequest.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.organization.deleteMany({
    where: {
      organizerProfiles: { some: { user: { email: { in: createdEmails } } } },
    },
  });
  await prisma.organizerProfile.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.notification.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: createdEmails } },
  });
  await prisma.$disconnect();
});

test.describe("/organizer dashboard smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    await page.goto(dashboardPath, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("shows only the create-organizer-profile CTA when no OrganizerProfile exists", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-no-profile-${Date.now()}`,
    );
    const email = `no-profile-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(
      page.getByRole("heading", { name: "請先建立團主資料" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "前往建立團主資料" }),
    ).toHaveAttribute("href", "/organizer/profile");
    await expect(page.getByText("近期通知")).toBeHidden();
    await expect(page.getByText("我的需求")).toBeHidden();
  });

  test("shows empty-state copy and correct outbound links for an organizer with no demand requests", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-no-demands-${Date.now()}`,
    );
    const email = `no-demands-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(page.getByRole("heading", { name: "我的總覽" })).toBeVisible();
    await expect(page.getByText("目前沒有任何通知")).toBeVisible();
    await expect(page.getByText("尚未提出任何需求")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "查看全部通知" }),
    ).toHaveAttribute("href", "/notifications");
    await expect(
      page.getByRole("link", { name: "查看全部需求" }),
    ).toHaveAttribute("href", "/organizer/demands");
    await expect(
      page.getByRole("link", { name: "建立新的需求" }),
    ).toHaveAttribute("href", "/organizer/demands/new");
  });

  test("shows non-zero status counts and the most recently updated 5 demand requests, each linking to its detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-demands-${Date.now()}`,
    );
    const email = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });

    // 6 筆 draft（依 updatedAt desc，只有最新 5 筆會顯示在列表）+ 1 筆 submitted，
    // 驗證「非零狀態計數」與「最近 5 筆」截斷/排序同時正確。
    const draftIds: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const demandRequest = await createDemandRequest({
        organizerProfileId,
        organizationId,
        status: "draft",
        data: completeDemandRequestData({ title: `Demand ${testRunId}-draft-${i}` }),
      });
      // 明確錯開 updatedAt，避免同毫秒建立導致排序不穩定。
      await prisma.demandRequest.update({
        where: { id: demandRequest.id },
        data: { updatedAt: new Date(Date.now() + i * 1000) },
      });
      draftIds.push(demandRequest.id);
    }
    const submittedDemandRequest = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: `Demand ${testRunId}-submitted` }),
    });
    await prisma.demandRequest.update({
      where: { id: submittedDemandRequest.id },
      data: { updatedAt: new Date(Date.now() + 100_000) },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(dashboardPath);

    await expect(page.getByText("草稿・6")).toBeVisible();
    await expect(page.getByText("已送出審核・1")).toBeVisible();

    // 最新更新的 submitted 那一筆一定要顯示。
    await expect(page.getByText(`Demand ${testRunId}-submitted`)).toBeVisible();
    // draft 3..6 連同 submitted 共 5 筆，屬於最新的 5 筆 updatedAt（7 筆總數超過
    // 5 筆上限，所以最舊的 draft-1、draft-2 應該被截斷掉，其餘都要顯示）。
    for (let i = 3; i <= 6; i++) {
      await expect(page.getByText(`Demand ${testRunId}-draft-${i}`)).toBeVisible();
    }
    await expect(page.getByText(`Demand ${testRunId}-draft-1`)).toBeHidden();
    await expect(page.getByText(`Demand ${testRunId}-draft-2`)).toBeHidden();

    // 確認未被截斷的一筆連到正確的詳情頁（精確比對 href，不只是「有沒有連結」）。
    await expect(
      page.getByRole("link", { name: new RegExp(`Demand ${testRunId}-draft-3`) }),
    ).toHaveAttribute("href", `/organizer/demands/${draftIds[2]}`);

    await expect(
      page.getByRole("link", { name: "查看全部需求" }),
    ).toHaveAttribute("href", "/organizer/demands");
    await expect(
      page.getByRole("link", { name: "建立新的需求" }),
    ).toHaveAttribute("href", "/organizer/demands/new");
    await expectNoHorizontalOverflow(page);
  });

  test("shows only the newest 5 notifications, newest first, with correct content and the full-list link", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notifications-${Date.now()}`,
    );
    const email = `organizer-notif-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken, userId } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });

    const baseTime = Date.now();
    for (let i = 0; i <= 6; i++) {
      await prisma.notification.create({
        data: {
          userId,
          type: "demand_request_published",
          channel: "in_app",
          status: "sent",
          title: `Dash Notif ${i} ${testRunId}`,
          body: `Dash Body ${i} ${testRunId}`,
          createdAt: new Date(baseTime + i * 60_000),
          sentAt: new Date(baseTime + i * 60_000),
        },
      });
    }

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    const items = page.getByRole("listitem");
    await expect(items).toHaveCount(5);
    for (let rank = 0; rank < 5; rank++) {
      const expectedIndex = 6 - rank;
      await expect(items.nth(rank)).toContainText(
        `Dash Notif ${expectedIndex} ${testRunId}`,
      );
    }
    await expect(page.getByText(`Dash Notif 0 ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Dash Notif 1 ${testRunId}`)).toBeHidden();

    await expect(
      page.getByRole("link", { name: "查看全部通知" }),
    ).toHaveAttribute("href", "/notifications");
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
