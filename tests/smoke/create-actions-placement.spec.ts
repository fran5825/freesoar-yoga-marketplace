import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
} from "./_helpers/organizer-demand-fixtures";
import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";

const testEmailDomain = "create-actions-placement-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

// 2026-09-26：「建立課程」「發起新需求」不再放在導覽列右上角，改放在各自列表的最底下。
test.describe("create actions placement smoke", () => {
  test("an approved teacher creates classes from the bottom of /teacher/classes, not from the nav bar", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-teacher-${Date.now()}`,
    );
    const email = `placement-teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createTeacherProfileWithSession({
      email,
      displayName: `Placement Teacher ${testRunId}`,
      status: "approved",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/teacher/classes");

    await expect(page.getByRole("banner").getByRole("link", { name: /建立課程/ })).toHaveCount(0);
    const create = page.getByRole("main").getByRole("link", { name: "＋ 建立課程" });
    await expect(create).toHaveCount(1);
    await expect(create).toHaveAttribute("href", "/teacher/classes/new");
  });

  test("an organizer starts a demand from the bottom of /organizer/demands, not from the nav bar", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-organizer-${Date.now()}`,
    );
    const email = `placement-organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Placement Organizer ${testRunId}`,
      organizationName: `Placement Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/demands");

    await expect(
      page.getByRole("banner").getByRole("link", { name: /發起新需求/, includeHidden: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("link", { name: /發起新需求|建立新的需求/ }),
    ).toHaveAttribute("href", "/organizer/demands/new");
  });

  test("the teacher overview no longer shows the duplicate area label or an account button", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-overview-${Date.now()}`,
    );
    const email = `placement-overview-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createTeacherProfileWithSession({
      email,
      displayName: `Overview Teacher ${testRunId}`,
      status: "approved",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/teacher/dashboard");

    await expect(page.getByRole("heading", { name: "老師總覽" })).toBeVisible();
    await expect(page.getByRole("main").getByText("老師專區", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "我的帳戶" })).toHaveCount(0);
  });
});
