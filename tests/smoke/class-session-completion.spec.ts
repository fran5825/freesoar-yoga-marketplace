import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
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

const testEmailDomain = "class-session-completion-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedClassSession({
  testRunId,
  status,
  endAt,
}: {
  testRunId: string;
  status: "draft" | "open_for_enrollment" | "cancelled" | "completed";
  endAt: string;
}) {
  const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);

  const { sessionToken: organizerSessionToken, organizerProfileId, organizationId } =
    await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });
  const demand = await createDemandRequest({
    organizerProfileId,
    organizationId,
    status: "converted_to_class",
    data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });

  const classSession = await prisma.classSession.create({
    data: {
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      organizerProfileId,
      organizationId,
      title: `Class ${testRunId}`,
      serviceType: "Hatha Yoga",
      startAt: new Date(Date.parse(endAt) - 3600_000),
      endAt: new Date(endAt),
      location: "Test Studio",
      capacity: 10,
      isPublic: false,
      status,
    },
    select: { id: true },
  });

  return {
    classSessionId: classSession.id,
    organizerProfileId,
    organizerSessionToken,
    teacherUserId: teacher.userId,
    teacherSessionToken: teacher.sessionToken,
  };
}

async function seedMember(testRunId: string, suffix: string) {
  const email = `member-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

const pastEndAt = "2020-01-01T10:00:00Z";
const futureEndAt = "2099-01-01T10:00:00Z";

test.describe("class session completion smoke", () => {
  // D2: mark-complete section only shows once endAt has passed.
  test("D2: does not show the mark-complete section for a class session that hasn't ended yet", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-not-ended-${Date.now()}`,
    );
    const { classSessionId, organizerSessionToken } = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      endAt: futureEndAt,
    });

    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await expect(page.getByRole("heading", { name: "標記完成" })).toBeHidden();
  });

  // D1: mark-complete section only shows for open_for_enrollment, even if endAt has passed.
  test("D1: does not show the mark-complete section for a draft or cancelled class session, even after endAt has passed", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-not-completable-${Date.now()}`,
    );

    for (const status of ["draft", "cancelled"] as const) {
      const { classSessionId, organizerSessionToken } = await seedClassSession({
        testRunId: `${testRunId}-${status}`,
        status,
        endAt: pastEndAt,
      });

      await addAuthSessionCookie(context, organizerSessionToken);
      await page.goto(`/organizer/classes/${classSessionId}`);
      await expect(page.getByRole("heading", { name: "標記完成" })).toBeHidden();
    }
  });

  // D8: IDOR — a non-owning organizer can't even see the class session detail page.
  test("blocks a non-owning organizer from viewing (and therefore completing) someone else's class session", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      endAt: pastEndAt,
    });

    const otherEmail = `other-organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const { sessionToken: otherSessionToken } = await createUserSession({ email: otherEmail });

    await addAuthSessionCookie(context, otherSessionToken);
    const response = await page.goto(`/organizer/classes/${classSessionId}`);
    expect(response?.status()).toBe(404);

    const classSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: classSessionId },
    });
    expect(classSession.status).toBe("open_for_enrollment");
  });

  // D6/D7: full UI E2E flow across Organizer, Teacher, and Member.
  test("lets an organizer mark an ended class session complete through the UI; roster stays visible on Organizer and Teacher pages, the member's existing link keeps working, and re-visiting no longer offers mark-complete", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-e2e-${Date.now()}`,
    );
    // D14 guard on createEnrollmentForUser requires startAt still in the future, so
    // this class session is seeded with a future startAt/endAt first, the enrollment
    // is created against that, and only afterward do we backdate both timestamps to
    // simulate "the class has since ended" (mirrors class-session-cancellation.spec.ts's
    // seedClassSession helper, which does the same create-then-backdate two-step).
    const { classSessionId, organizerSessionToken, teacherSessionToken } = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      endAt: futureEndAt,
    });
    const member = await seedMember(testRunId, "ui");
    const enrollResult = await createEnrollmentForUser(member.userId, classSessionId, {
      notes: null,
    });
    if (!enrollResult.ok) throw new Error("enroll setup failed");

    await prisma.classSession.update({
      where: { id: classSessionId },
      data: {
        startAt: new Date(Date.parse(pastEndAt) - 3600_000),
        endAt: new Date(pastEndAt),
      },
    });

    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await expect(page.getByRole("heading", { name: "標記完成" })).toBeVisible();
    await page
      .getByRole("checkbox", { name: "我確認這堂課程已經結束。" })
      .check();
    await page.getByRole("button", { name: "標記完成" }).click();

    await expect(page.getByText("課程已標記完成。")).toBeVisible();
    await expect(page.getByText("已完成", { exact: true })).toBeVisible();
    await expect(page.getByText("已報名會員（1 人）")).toBeVisible();

    // 重新造訪：標記完成區塊不再出現（已經是 completed，不可重複標記）。
    await page.goto(`/organizer/classes/${classSessionId}`);
    await expect(page.getByRole("heading", { name: "標記完成" })).toBeHidden();

    await context.clearCookies();
    await addAuthSessionCookie(context, teacherSessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText("已完成", { exact: true })).toBeVisible();
    await expect(page.getByText("已報名會員（1 人）")).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, member.sessionToken);
    const memberResponse = await page.goto(`/classes/${classSessionId}`);
    expect(memberResponse?.status()).toBe(200);
    await expect(page.getByText("已報名", { exact: true })).toBeVisible();

    await page.goto("/member/enrollments");
    await expect(page.getByText("已報名", { exact: true })).toBeVisible();
  });
});
