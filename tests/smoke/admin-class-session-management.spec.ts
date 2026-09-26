import { expect, test } from "@playwright/test";

import { cancelClassSessionForAdmin } from "../../src/domain/class-session/__internal__/cancel-class-session-core";
import { cancelEnrollmentForAdminCore } from "../../src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core";
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

const testEmailDomain = "admin-class-session-management-smoke.local";
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
  startAtOffsetMs,
}: {
  testRunId: string;
  status: "draft" | "open_for_enrollment" | "completed" | "cancelled";
  startAtOffsetMs: number;
}) {
  const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);

  const {
    userId: organizerUserId,
    sessionToken: organizerSessionToken,
    organizerProfileId,
    organizationId,
  } = await createOrganizerProfileWithOrganization({
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

  const startAt = new Date(Date.now() + startAtOffsetMs);
  const endAt = new Date(startAt.getTime() + 3600_000);

  const classSession = await prisma.classSession.create({
    data: {
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      organizerProfileId,
      organizationId,
      title: `Class ${testRunId}`,
      serviceType: "伸展與身體保養",
      startAt,
      endAt,
      location: "Test Studio",
      capacity: 10,
      isPublic: false,
      status,
    },
    select: { id: true },
  });

  return {
    classSessionId: classSession.id,
    organizerUserId,
    organizerSessionToken,
    teacherUserId: teacher.userId,
  };
}

async function seedConfirmedEnrollment(testRunId: string, suffix: string, classSessionId: string) {
  const email = `member-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  const { userId } = await createUserSession({ email });
  const enrollment = await prisma.enrollment.create({
    data: { classSessionId, userId, status: "confirmed", consentedAt: new Date() },
    select: { id: true },
  });
  return { memberUserId: userId, enrollmentId: enrollment.id };
}

test.describe("admin class session management smoke", () => {
  test("blocks non-admin sessions from /admin/classes", async ({ context, page }, testInfo) => {
    const email = `non-admin-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email, isAdmin: false });
    await addAuthSessionCookie(context, sessionToken);

    const response = await page.goto("/admin/classes");
    expect(response?.status()).toBe(404);
  });

  test("blocks non-admin sessions from /admin/classes/[classSessionId]", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-non-admin-detail-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      startAtOffsetMs: 3600_000,
    });

    const email = `non-admin-detail-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email, isAdmin: false });
    await addAuthSessionCookie(context, sessionToken);

    const response = await page.goto(`/admin/classes/${classSessionId}`);
    expect(response?.status()).toBe(404);
  });

  test("admin can cancel any organizer's class session, not just their own", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-any-organizer-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      startAtOffsetMs: 3600_000,
    });

    const result = await cancelClassSessionForAdmin(classSessionId);
    expect(result.ok).toBe(true);

    const classSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: classSessionId },
    });
    expect(classSession.status).toBe("cancelled");
  });

  test("rejects cancelling an already-started, a completed, and an already-cancelled class session with explicit codes", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-blocked-${Date.now()}`,
    );

    const started = await seedClassSession({
      testRunId: `${testRunId}-started`,
      status: "open_for_enrollment",
      startAtOffsetMs: -3600_000,
    });
    const startedResult = await cancelClassSessionForAdmin(started.classSessionId);
    expect(startedResult).toEqual({ ok: false, code: "class_session_already_started" });

    const completed = await seedClassSession({
      testRunId: `${testRunId}-completed`,
      status: "completed",
      startAtOffsetMs: -3600_000,
    });
    const completedResult = await cancelClassSessionForAdmin(completed.classSessionId);
    expect(completedResult).toEqual({ ok: false, code: "class_session_not_cancellable" });

    const cancelled = await seedClassSession({
      testRunId: `${testRunId}-cancelled`,
      status: "cancelled",
      startAtOffsetMs: 3600_000,
    });
    const cancelledResult = await cancelClassSessionForAdmin(cancelled.classSessionId);
    expect(cancelledResult).toEqual({ ok: false, code: "class_session_already_cancelled" });

    const notFoundResult = await cancelClassSessionForAdmin("does-not-exist");
    expect(notFoundResult).toEqual({ ok: false, code: "class_session_not_found" });
  });

  // D5 round-2 fix regression proof: the lock query must resolve the organizer's userId
  // from the locked row, not the (null, for the admin path) function parameter — otherwise
  // the organizer silently never gets notified.
  test("notifies organizer(self), teacher(counterpart), and each affected member, with the organizer correctly resolved even though the admin path passes organizerProfileId=null", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-${Date.now()}`,
    );
    const seeded = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      startAtOffsetMs: 3600_000,
    });
    const enrollment = await seedConfirmedEnrollment(testRunId, "notify", seeded.classSessionId);

    const calls: { type: string; recipients: unknown; payload: unknown }[] = [];
    const result = await cancelClassSessionForAdmin(
      seeded.classSessionId,
      undefined,
      async (type, recipients, payload) => {
        calls.push({ type, recipients, payload });
      },
    );

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe("class_session_cancelled");

    const recipients = calls[0].recipients as { userId: string; role: string }[];
    expect(recipients).toContainEqual({ userId: seeded.organizerUserId, role: "self" });
    expect(recipients).toContainEqual({ userId: seeded.teacherUserId, role: "counterpart" });
    expect(recipients).toContainEqual({ userId: enrollment.memberUserId, role: "affected_member" });
  });

  test("cancelEnrollmentForAdminCore can cancel any user's confirmed enrollment, is blocked once the class has started, and returns explicit not-found", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-enroll-core-${Date.now()}`,
    );

    const okSeeded = await seedClassSession({
      testRunId: `${testRunId}-ok`,
      status: "open_for_enrollment",
      startAtOffsetMs: 3600_000,
    });
    const okEnrollment = await seedConfirmedEnrollment(testRunId, "ok", okSeeded.classSessionId);
    const okResult = await cancelEnrollmentForAdminCore(okEnrollment.enrollmentId);
    expect(okResult.ok).toBe(true);
    const updated = await prisma.enrollment.findUniqueOrThrow({
      where: { id: okEnrollment.enrollmentId },
    });
    expect(updated.status).toBe("cancelled");

    const startedSeeded = await seedClassSession({
      testRunId: `${testRunId}-started`,
      status: "open_for_enrollment",
      startAtOffsetMs: -3600_000,
    });
    const startedEnrollment = await seedConfirmedEnrollment(
      testRunId,
      "started",
      startedSeeded.classSessionId,
    );
    const startedResult = await cancelEnrollmentForAdminCore(startedEnrollment.enrollmentId);
    expect(startedResult).toEqual({ ok: false, code: "class_session_already_started" });

    const notFoundResult = await cancelEnrollmentForAdminCore("does-not-exist");
    expect(notFoundResult).toEqual({ ok: false, code: "enrollment_not_found" });
  });

  // D6/D7: full UI E2E flow — admin sees the list, cancels a single enrollment, then
  // cancels the whole class session, and both notifications land with neutral-voice copy
  // (D4.1: not falsely claiming "you cancelled this" when Admin did it).
  test("filters the class list by status with the shared filter bar, and cards link to the detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-filter-${Date.now()}`,
    );
    const openRunId = `${testRunId}-open`;
    const cancelledRunId = `${testRunId}-cancelled`;
    const openSession = await seedClassSession({
      testRunId: openRunId,
      status: "open_for_enrollment",
      startAtOffsetMs: 3600_000,
    });
    await seedClassSession({
      testRunId: cancelledRunId,
      status: "cancelled",
      startAtOffsetMs: 7200_000,
    });

    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    // 預設「全部」：兩筆都在。
    await page.goto("/admin/classes");
    await expect(page.getByText(`Class ${openRunId}`)).toBeVisible();
    await expect(page.getByText(`Class ${cancelledRunId}`)).toBeVisible();

    await page.goto("/admin/classes?status=cancelled");
    await expect(
      page.getByRole("link", { name: /已取消・\d+/ }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(`Class ${cancelledRunId}`)).toBeVisible();
    await expect(page.getByText(`Class ${openRunId}`)).toHaveCount(0);

    // 網址亂填時退回「全部」。
    await page.goto("/admin/classes?status=nonsense");
    await expect(page.getByRole("link", { name: /全部・\d+/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // 整張卡片可點，進到詳情頁。
    await page.goto("/admin/classes?status=open");
    await page.getByRole("link", { name: new RegExp(`Class ${openRunId}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/classes/${openSession.classSessionId}$`));
    await expect(page.getByRole("link", { name: "← 回課程列表" })).toHaveAttribute(
      "href",
      "/admin/classes",
    );
  });

  test("shows the shared result banner on the class list when redirected with a message", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-flash-${Date.now()}`,
    );
    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto(`/admin/classes?result=success&message=${encodeURIComponent("課程已取消。")}`);

    await expect(page.getByText("課程已取消。")).toBeVisible();
  });

  test("lets an admin cancel a single enrollment, then cancel the whole class session, through the UI", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-e2e-${Date.now()}`,
    );
    const seeded = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
      startAtOffsetMs: 3600_000,
    });
    const enrollmentA = await seedConfirmedEnrollment(testRunId, "e2e-a", seeded.classSessionId);
    await seedConfirmedEnrollment(testRunId, "e2e-b", seeded.classSessionId);

    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);

    await page.goto("/admin/classes");
    await expect(page.getByText(`Class ${testRunId}`)).toBeVisible();

    await page.goto(`/admin/classes/${seeded.classSessionId}`);
    await expect(page.getByText("報名名單（2 人）")).toBeVisible();

    // 團主、老師、團體要看得出「是誰」：名稱之外還有聯絡方式。
    await expect(page.getByText(`organizer-${testRunId}@${testEmailDomain}`)).toBeVisible();
    await expect(page.getByText(`teacher-${testRunId}@${testEmailDomain}`)).toBeVisible();
    await expect(page.getByText("公司", { exact: true })).toBeVisible();

    const rowA = page.locator("li", { hasText: `member-e2e-a-${testRunId}` });

    // 確認視窗：按「返回」或 Esc 都不會取消；按「確認」才會送出。
    await rowA.getByRole("button", { name: "取消這筆報名" }).click();
    const dialog = page.getByRole("dialog", { name: "確定要取消這筆報名嗎？" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "返回" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("報名名單（2 人）")).toBeVisible();

    await rowA.getByRole("button", { name: "取消這筆報名" }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByText("報名名單（2 人）")).toBeVisible();

    await rowA.getByRole("button", { name: "取消這筆報名" }).click();
    await dialog.getByRole("button", { name: "確認取消報名" }).click();

    await expect(page.getByText("報名已取消。")).toBeVisible();

    await page.getByRole("button", { name: "取消課程", exact: true }).click();
    await page
      .getByRole("dialog", { name: "確定要取消這堂課程嗎？" })
      .getByRole("button", { name: "確認取消課程" })
      .click();

    await expect(page.getByText("課程已取消。")).toBeVisible();
    await expect(page.getByText("已取消", { exact: true }).first()).toBeVisible();

    const classSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: seeded.classSessionId },
    });
    expect(classSession.status).toBe("cancelled");

    const organizerNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: seeded.organizerUserId, type: "class_session_cancelled" },
    });
    expect(organizerNotification.body).not.toContain("你已經");

    const memberANotification = await prisma.notification.findFirstOrThrow({
      where: { userId: enrollmentA.memberUserId, type: "enrollment_cancelled" },
    });
    expect(memberANotification.body).not.toContain("你已經");
  });
});
