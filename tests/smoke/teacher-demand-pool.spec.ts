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
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "teacher-demand-pool-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("/teacher/demands smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    const response = await page.goto("/teacher/demands");

    await expect(page).toHaveURL(/\/sign-in/);
    expect(response?.ok()).toBeTruthy();
  });

  test("blocks users without a TeacherProfile, and each non-approved status, from seeing the pool", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-blocked-${Date.now()}`,
    );

    // 無 TeacherProfile。
    const noProfileEmail = `no-profile-${testRunId}@${testEmailDomain}`;
    createdEmails.push(noProfileEmail);
    const { sessionToken: noProfileToken } = await createUserSession({
      email: noProfileEmail,
    });
    await addAuthSessionCookie(context, noProfileToken);
    await page.goto("/teacher/demands");
    await expect(page.getByText("尚未建立老師申請")).toBeVisible();

    for (const status of ["draft", "submitted", "rejected", "suspended"] as const) {
      const email = `${status}-${testRunId}@${testEmailDomain}`;
      createdEmails.push(email);
      const { sessionToken } = await createTeacherProfileWithSession({
        email,
        displayName: `${status} teacher`,
        status,
      });
      await context.clearCookies();
      await addAuthSessionCookie(context, sessionToken);
      await page.goto("/teacher/demands");

      // 每種非 approved 狀態都應顯示引導文案（連到 dashboard），而非 demand pool 列表。
      await expect(page.locator('a[href="/teacher/dashboard"]')).toBeVisible();
    }
  });

  test("shows only published demands to an approved teacher, and blocks guessing a non-published demand id", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-pool-${Date.now()}`,
    );
    const teacherEmail = `approved-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerEmail);

    const { sessionToken } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Approved Teacher ${testRunId}`,
      status: "approved",
    });

    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });

    const publishedTitle = `Published Demand ${testRunId}`;
    const publishedDemand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: publishedTitle }),
    });

    const draftTitle = `Draft Demand ${testRunId}`;
    const draftDemand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: draftTitle }),
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/demands");

    await expect(page.getByText(publishedTitle)).toBeVisible();
    await expect(page.getByText(draftTitle)).toBeHidden();

    // 直接猜非 published demand 的 id，回應不得洩漏內容。
    await page.goto(`/teacher/demands/${draftDemand.id}`);
    await expect(page.getByText("需求概述")).toBeHidden();

    // published demand 可正常進入 detail。
    await page.goto(`/teacher/demands/${publishedDemand.id}`);
    await expect(page.getByRole("heading", { name: publishedTitle })).toBeVisible();
    await expect(page.getByText("需求概述")).toBeVisible();
  });
});
