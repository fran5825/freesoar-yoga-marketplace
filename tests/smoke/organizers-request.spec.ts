import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability 第 1 批：/organizers/request 只給非團主看，已是團主直接導向總覽。
// 「沒登入」的情況由 public-trust-pages.spec.ts 涵蓋。
const testEmailDomain = "organizers-request-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

test.describe("/organizers/request states", () => {
  test("a signed-in user without an organizer profile sees the pitch with a create-profile button", async ({
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

    await page.goto("/organizers/request");

    await expect(
      page.getByRole("heading", { name: "為公司社團與社區，找到適合的瑜伽老師" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "建立團主資料" })).toHaveAttribute(
      "href",
      "/organizer/profile",
    );
    await expect(page.getByRole("link", { name: "登入／建立帳號並開始" })).toHaveCount(0);
  });

  test("an existing organizer is redirected to the new demand form instead of seeing the pitch", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-organizer-${Date.now()}`,
    );
    const email = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Redirect Organizer ${testRunId}`,
      organizationName: `Redirect Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizers/request");

    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);
    // 桌機導覽列直接顯示，手機收成選單，所以這裡只確認團主專區的 header 出現。
    await expect(page.getByRole("banner").getByText("團主專區")).toBeVisible();
    await expect(page.getByRole("heading", { name: "建立新的團課需求" })).toBeVisible();
  });

  test("the home page hero sends an existing organizer straight to a new demand, and a new user to the pitch", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-home-${Date.now()}`,
    );
    const email = `home-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "我想發起團課 →" })).toHaveAttribute(
      "href",
      "/organizers/request",
    );

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Home Organizer ${testRunId}`,
      organizationName: `Home Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "發起新需求", exact: true }),
    ).toHaveAttribute("href", "/organizer/demands/new");
    await expect(
      page.getByRole("link", { name: "前往團主總覽" }),
    ).toHaveAttribute("href", "/organizer/dashboard");
  });

  test("a signed-in user without an organizer profile who opens the new demand form lands on profile creation", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-new-form-${Date.now()}`,
    );
    const email = `new-form-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/demands/new");

    await expect(page).toHaveURL(/\/organizer\/profile$/);
  });

  test("an organizer with incomplete contact info still reaches the form, and is warned on the dashboard", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-incomplete-${Date.now()}`,
    );
    const email = `incomplete-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Incomplete Organizer ${testRunId}`,
      organizationName: `Incomplete Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: null,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizers/request");
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);

    await page.goto("/organizer/dashboard");
    await expect(page.getByText("送出需求前需要先補齊組織聯絡資訊")).toBeVisible();
    await expect(page.getByRole("link", { name: "前往團主資料補齊" })).toHaveAttribute(
      "href",
      "/organizer/profile",
    );
  });
});
