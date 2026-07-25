import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "organizer-demand-responses-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("organizer demand responses smoke", () => {
  test("shows the organizer a minimized, read-only view of responses to their own demand", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-view-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerEmail);

    const teacherDisplayName = `Teacher ${testRunId}`;
    const { teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: teacherDisplayName,
      status: "approved",
    });
    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const message = `${testRunId} 的回覆內容，樂意帶領這次的團課。`;
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId,
      message,
      proposedTimeSlots: ["平日晚上"],
      proposedPrice: "依人數討論",
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);

    await expect(page.getByText("收到的老師回應")).toBeVisible();
    await expect(page.getByText(teacherDisplayName)).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText("可配合時段：平日晚上")).toBeVisible();

    // DTO 資料最小化：不得暴露 email/內部審核資料。
    const teacherUser = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
      select: { user: { select: { email: true } } },
    });
    await expect(page.getByText(teacherUser.user.email ?? "")).toBeHidden();
  });

  test("shows a gentle empty state when a demand has no responses yet", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-empty-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);

    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);

    await expect(page.getByText("目前還沒有老師回應")).toBeVisible();
  });

  test("keeps responses private across organizers (IDOR): organizer B cannot view organizer A's demand or its responses", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const organizerAEmail = `organizer-a-${testRunId}@${testEmailDomain}`;
    const organizerBEmail = `organizer-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerAEmail, organizerBEmail);

    const { teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerAEmail,
        displayName: `Organizer A ${testRunId}`,
        organizationName: `Org A ${testRunId}`,
      });
    const { sessionToken: organizerBToken } =
      await createOrganizerProfileWithOrganization({
        email: organizerBEmail,
        displayName: `Organizer B ${testRunId}`,
        organizationName: `Org B ${testRunId}`,
      });
    const demandA = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand A ${testRunId}` }),
    });
    const secretMessage = `${testRunId} 只有 Organizer A 應該看得到這段回覆。`;
    await createDemandResponse({
      demandRequestId: demandA.id,
      teacherProfileId,
      message: secretMessage,
    });

    await addAuthSessionCookie(context, organizerBToken);
    const response = await page.goto(`/organizer/demands/${demandA.id}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText(secretMessage)).toBeHidden();
  });
});
