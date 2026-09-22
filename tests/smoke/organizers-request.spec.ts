import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
} from "./_helpers/organizer-demand-fixtures";

// organizer-flow-redesign 第 2 批：/organizers/request 依登入與團主資料狀態顯示三種內容。
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

  test("an existing organizer sees a welcome-back entry instead of the pitch", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-organizer-${Date.now()}`,
    );
    const email = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const displayName = `Welcome Organizer ${testRunId}`;

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName,
      organizationName: `Welcome Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizers/request");

    await expect(
      page.getByRole("heading", { name: `歡迎回來，${displayName}` }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "發起新需求" })).toHaveAttribute(
      "href",
      "/organizer/demands/new",
    );
    await expect(page.getByRole("link", { name: "建立團主資料" })).toHaveCount(0);
    await expect(page.getByText("送出需求前需要先補齊組織聯絡資訊")).toHaveCount(0);
  });

  test("an organizer with incomplete contact info is warned before starting a demand", async ({
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

    await expect(page.getByText("送出需求前需要先補齊組織聯絡資訊")).toBeVisible();
    await expect(page.getByRole("link", { name: "前往團主資料補齊" })).toHaveAttribute(
      "href",
      "/organizer/profile",
    );
  });
});
