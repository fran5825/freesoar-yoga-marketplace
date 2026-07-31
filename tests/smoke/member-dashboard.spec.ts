import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const testEmailDomain = "member-dashboard-smoke.local";
const dashboardPath = "/member/dashboard";
const createdEmails: string[] = [];

test.afterAll(async () => {
  if (createdEmails.length === 0) {
    await prisma.$disconnect();
    return;
  }

  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
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
  await prisma.teacherProfile.deleteMany({
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

async function seedClassSession({
  organizerProfileId,
  organizationId,
  teacherProfileId,
  testRunId,
  suffix,
  startAt,
}: {
  organizerProfileId: string;
  organizationId: string;
  teacherProfileId: string;
  testRunId: string;
  suffix: string;
  startAt: Date;
}) {
  const demand = await createDemandRequest({
    organizerProfileId,
    organizationId,
    status: "matched",
    data: completeDemandRequestData({ title: `Demand ${testRunId}-${suffix}` }),
  });

  return prisma.classSession.create({
    data: {
      demandRequestId: demand.id,
      teacherProfileId,
      organizerProfileId,
      organizationId,
      title: `Class ${testRunId}-${suffix}`,
      startAt,
      endAt: new Date(startAt.getTime() + 60 * 60 * 1000),
      location: "Test Studio",
      capacity: 20,
      status: "open_for_enrollment",
    },
    select: { id: true },
  });
}

async function enrollMember({
  classSessionId,
  userId,
  status,
}: {
  classSessionId: string;
  userId: string;
  status: "pending" | "confirmed" | "cancelled";
}) {
  await prisma.enrollment.create({
    data: {
      classSessionId,
      userId,
      status,
      consentedAt: new Date(),
    },
  });
}

test.describe("/member dashboard smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    await page.goto(dashboardPath, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("shows empty-state copy and correct outbound links when there is no data", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-empty-${Date.now()}`,
    );
    const email = `member-empty-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(page.getByRole("heading", { name: "我的總覽" })).toBeVisible();
    await expect(page.getByText("目前沒有任何通知")).toBeVisible();
    await expect(page.getByText("目前沒有任何報名")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "查看全部通知" }),
    ).toHaveAttribute("href", "/notifications");
    await expect(
      page.getByRole("link", { name: "查看全部報名" }),
    ).toHaveAttribute("href", "/member/enrollments");
  });

  test("shows enrollment counts and the soonest 5 upcoming confirmed enrollments, excluding past ones", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-enrollments-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail, memberEmail);

    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const { teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { userId: memberUserId, sessionToken: memberSessionToken } =
      await createUserSession({ email: memberEmail });

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // 6 筆未來的 confirmed 報名（soonest-first），只有最早的 5 筆會顯示在「即將到來」。
    const futureClassSessions = [];
    for (let i = 1; i <= 6; i++) {
      const classSession = await seedClassSession({
        organizerProfileId,
        organizationId,
        teacherProfileId,
        testRunId,
        suffix: `future-${i}`,
        startAt: new Date(now + i * dayMs),
      });
      futureClassSessions.push(classSession);
      await enrollMember({
        classSessionId: classSession.id,
        userId: memberUserId,
        status: "confirmed",
      });
    }

    // 1 筆已過去的 confirmed 報名：計入「已報名」總數，但不進入「即將到來」清單。
    const pastClassSession = await seedClassSession({
      organizerProfileId,
      organizationId,
      teacherProfileId,
      testRunId,
      suffix: "past",
      startAt: new Date(now - 10 * dayMs),
    });
    await enrollMember({
      classSessionId: pastClassSession.id,
      userId: memberUserId,
      status: "confirmed",
    });

    // 2 筆 pending、1 筆 cancelled，驗證計數分組正確。
    for (let i = 1; i <= 2; i++) {
      const classSession = await seedClassSession({
        organizerProfileId,
        organizationId,
        teacherProfileId,
        testRunId,
        suffix: `pending-${i}`,
        startAt: new Date(now + (10 + i) * dayMs),
      });
      await enrollMember({
        classSessionId: classSession.id,
        userId: memberUserId,
        status: "pending",
      });
    }
    const cancelledClassSession = await seedClassSession({
      organizerProfileId,
      organizationId,
      teacherProfileId,
      testRunId,
      suffix: "cancelled",
      startAt: new Date(now + 20 * dayMs),
    });
    await enrollMember({
      classSessionId: cancelledClassSession.id,
      userId: memberUserId,
      status: "cancelled",
    });

    await addAuthSessionCookie(context, memberSessionToken);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(dashboardPath);

    // 計數：已報名 7（6 未來 + 1 過去）、處理中 2、已取消 1。
    const stats = page.locator("dl > div");
    await expect(stats.filter({ hasText: "已報名" }).locator("dd")).toHaveText("7");
    await expect(stats.filter({ hasText: "處理中" }).locator("dd")).toHaveText("2");
    await expect(stats.filter({ hasText: "已取消" }).locator("dd")).toHaveText("1");

    // 即將到來只顯示最早的 5 筆未來 confirmed 報名。
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByText(`Class ${testRunId}-future-${i}`)).toBeVisible();
    }
    await expect(page.getByText(`Class ${testRunId}-future-6`)).toBeHidden();

    // 已過去的 confirmed 報名不進入即將到來清單。
    await expect(page.getByText(`Class ${testRunId}-past`)).toBeHidden();

    await expect(
      page.getByRole("link", { name: "查看全部報名" }),
    ).toHaveAttribute("href", "/member/enrollments");
    await expectNoHorizontalOverflow(page);
  });

  test("shows only the newest 5 notifications, newest first, with correct content and the full-list link", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notifications-${Date.now()}`,
    );
    const email = `member-notif-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { userId, sessionToken } = await createUserSession({ email });

    const baseTime = Date.now();
    // 7 筆通知，index 6 最新、index 0 最舊。
    for (let i = 0; i <= 6; i++) {
      await prisma.notification.create({
        data: {
          userId,
          type: "enrollment_confirmed",
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

    // 最新 5 筆（index 6..2）可見，且依 createdAt desc 排序。
    const items = page.getByRole("listitem");
    await expect(items).toHaveCount(5);
    for (let rank = 0; rank < 5; rank++) {
      const expectedIndex = 6 - rank;
      await expect(items.nth(rank)).toContainText(
        `Dash Notif ${expectedIndex} ${testRunId}`,
      );
      await expect(items.nth(rank)).toContainText(
        `Dash Body ${expectedIndex} ${testRunId}`,
      );
    }

    // 最舊的 2 筆（index 0、1）不顯示。
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
