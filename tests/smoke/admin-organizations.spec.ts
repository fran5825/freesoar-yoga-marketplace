import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const testEmailDomain = "admin-organizations-smoke.local";
const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];

test.afterAll(async () => {
  await prisma.organizerProfile.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: createdOrganizationIds } },
  });
  await prisma.session.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

test.describe("admin organizations smoke", () => {
  test("blocks non-admin and unauthenticated sessions from /admin/organizations", async ({
    context,
    page,
  }, testInfo) => {
    const email = `non-admin-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email, isAdmin: false });
    await addAuthSessionCookie(context, sessionToken);

    const nonAdminResponse = await page.goto("/admin/organizations");
    expect(nonAdminResponse?.status()).toBe(404);

    await context.clearCookies();
    const unauthenticatedResponse = await page.goto("/admin/organizations");
    expect(unauthenticatedResponse?.status()).toBe(404);
  });

  test("lists organizations alphabetically with contact info, fallback text, and demand/class counts", async ({
    context,
    page,
  }, testInfo) => {
    const runId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const adminEmail = `admin-${runId}@${testEmailDomain}`;
    const organizerZebraEmail = `organizer-zebra-${runId}@${testEmailDomain}`;
    const organizerAlphaEmail = `organizer-alpha-${runId}@${testEmailDomain}`;
    createdEmails.push(adminEmail, organizerZebraEmail, organizerAlphaEmail);

    const zebra = await createOrganizerProfileWithOrganization({
      email: organizerZebraEmail,
      displayName: `Zebra Organizer ${runId}`,
      organizationName: `Zebra Org ${runId}`,
      organizationType: "community",
    });
    createdOrganizationIds.push(zebra.organizationId);

    const alpha = await createOrganizerProfileWithOrganization({
      email: organizerAlphaEmail,
      displayName: `Alpha Organizer ${runId}`,
      organizationName: `Alpha Org ${runId}`,
      organizationType: "company",
      contactName: "Contact Alpha",
      contactEmail: "contact-alpha@example.com",
      contactPhone: "0900-000-000",
    });
    createdOrganizationIds.push(alpha.organizationId);

    await prisma.demandRequest.create({
      data: {
        organizerProfileId: alpha.organizerProfileId,
        organizationId: alpha.organizationId,
        title: `Alpha Demand ${runId}`,
        status: "submitted",
      },
    });
    // 草稿管理員看不到，不能算進需求數。
    await prisma.demandRequest.create({
      data: {
        organizerProfileId: alpha.organizerProfileId,
        organizationId: alpha.organizationId,
        title: `Alpha Draft ${runId}`,
        status: "draft",
      },
    });

    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/admin/organizations");

    const alphaOrgName = `Alpha Org ${runId}`;
    const zebraOrgName = `Zebra Org ${runId}`;

    const alphaCard = page.locator("article").filter({ hasText: alphaOrgName });
    const zebraCard = page.locator("article").filter({ hasText: zebraOrgName });

    await expect(alphaCard).toContainText("Contact Alpha");
    await expect(alphaCard).toContainText("聯絡人");
    await expect(alphaCard).toContainText("團主");
    await expect(alphaCard).toContainText("contact-alpha@example.com");
    await expect(alphaCard).toContainText("0900-000-000");
    await expect(alphaCard).toContainText(`Alpha Organizer ${runId}`);
    await expect(alphaCard.getByRole("link", { name: "查看需求（1）" })).toBeVisible();
    await expect(alphaCard).toContainText("課程數：0");

    await expect(zebraCard).toContainText("未提供");
    await expect(zebraCard).toContainText(`Zebra Organizer ${runId}`);
    await expect(zebraCard).toContainText("需求數：0");

    const cardTexts = await page.locator("article h2").allTextContents();
    const alphaIndex = cardTexts.indexOf(alphaOrgName);
    const zebraIndex = cardTexts.indexOf(zebraOrgName);
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(zebraIndex).toBeGreaterThan(alphaIndex);

    for (const keyword of [alphaOrgName, "Contact Alpha", "contact-alpha@example.com", `Alpha Organizer ${runId}`]) {
      await page.getByRole("searchbox", { name: "搜尋團體" }).fill(keyword);
      await page.getByRole("button", { name: "搜尋", exact: true }).click();
      await expect(alphaCard).toBeVisible();
      await expect(zebraCard).toHaveCount(0);
    }
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-organizations.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("searchbox").fill(`missing-${runId}`);
    await page.getByRole("searchbox").press("Enter");
    await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
    await expect(page.getByText("沒有符合搜尋條件的團體。", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "清除關鍵字", exact: true }).click();
    await expect(page.getByRole("searchbox")).toHaveValue("");
  });

  test("keeps long unbroken organization names and emails inside the page width", async ({
    context,
    page,
  }, testInfo) => {
    const runId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-long-${Date.now()}`,
    );
    const adminEmail = `admin-long-${runId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);

    // 沒有空白的長字串：break-words 不會縮小最小寬度，必須能在任意位置換行。
    const longName = `LongOrg${"x".repeat(80)}${runId}`;
    const organization = await prisma.organization.create({
      data: {
        name: longName,
        type: "company",
        contactName: `Contact${"y".repeat(60)}`,
        contactEmail: `contact.${"z".repeat(60)}@example-organization-domain.com`,
      },
      select: { id: true },
    });
    createdOrganizationIds.push(organization.id);

    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto(`/admin/organizations?q=${encodeURIComponent(longName)}`);
    await expect(page.getByRole("heading", { level: 2, name: longName })).toBeVisible();
    await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("shows every organizer on a multi-organizer organization", async ({
    context,
    page,
  }, testInfo) => {
    const runId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const adminEmail = `admin-multi-${runId}@${testEmailDomain}`;
    const organizerOneEmail = `organizer-one-${runId}@${testEmailDomain}`;
    const organizerTwoEmail = `organizer-two-${runId}@${testEmailDomain}`;
    createdEmails.push(adminEmail, organizerOneEmail, organizerTwoEmail);

    const organizationName = `Multi Organizer Org ${runId}`;
    const organization = await prisma.organization.create({
      data: { name: organizationName, type: "company" },
      select: { id: true },
    });
    createdOrganizationIds.push(organization.id);

    const { userId: userOneId } = await createUserSession({ email: organizerOneEmail });
    const { userId: userTwoId } = await createUserSession({ email: organizerTwoEmail });

    await prisma.organizerProfile.create({
      data: {
        userId: userOneId,
        organizationId: organization.id,
        displayName: `Organizer One ${runId}`,
      },
    });
    await prisma.organizerProfile.create({
      data: {
        userId: userTwoId,
        organizationId: organization.id,
        displayName: `Organizer Two ${runId}`,
      },
    });

    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/admin/organizations");

    const card = page.locator("article").filter({ hasText: organizationName });
    await expect(card).toContainText(`Organizer One ${runId}`);
    await expect(card).toContainText(`Organizer Two ${runId}`);
  });

  test("renders an orphan organization (no linked organizer) as 無, without crashing", async ({
    context,
    page,
  }, testInfo) => {
    const runId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const adminEmail = `admin-orphan-${runId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);

    const organizationName = `Orphan Org ${runId}`;
    const organization = await prisma.organization.create({
      data: { name: organizationName, type: "other" },
      select: { id: true },
    });
    createdOrganizationIds.push(organization.id);

    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    const response = await page.goto("/admin/organizations");
    expect(response?.status()).toBe(200);

    const card = page.locator("article").filter({ hasText: organizationName });
    await expect(card).toContainText("無");
  });

  test("admin nav on the organizations page links to the other four admin pages", async ({
    context,
    page,
  }, testInfo) => {
    const adminEmail = `admin-nav-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(adminEmail);

    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/admin/organizations");

    const menuButton = page.getByRole("button", { name: "選單" });
    if (await menuButton.isVisible()) await menuButton.click();

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "工作總覽", exact: true })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    );
    await expect(nav.getByRole("link", { name: "老師", exact: true })).toHaveAttribute(
      "href",
      "/admin/teachers",
    );
    await expect(nav.getByRole("link", { name: "需求", exact: true })).toHaveAttribute(
      "href",
      "/admin/demands",
    );
    await expect(nav.getByRole("link", { name: "課程與報名", exact: true })).toHaveAttribute(
      "href",
      "/admin/classes",
    );
  });
});
