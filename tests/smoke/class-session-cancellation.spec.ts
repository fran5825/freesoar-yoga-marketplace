import { expect, test } from "@playwright/test";

import { cancelClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/cancel-class-session-core";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
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
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "class-session-cancellation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
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
  startAt = "2099-01-01T00:00:00Z",
}: {
  testRunId: string;
  startAt?: string;
}) {
  const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);

  const {
    sessionToken: organizerSessionToken,
    organizerProfileId,
    organizationId,
    userId: organizerUserId,
  } = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${testRunId}`,
    organizationName: `Org ${testRunId}`,
  });
  const demand = await createDemandRequest({
    organizerProfileId,
    organizationId,
    status: "matched",
    data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
  await createDemandResponse({
    demandRequestId: demand.id,
    teacherProfileId: teacher.teacherProfileId,
    status: "selected",
  });

  const validation = validateClassSessionCreate({
    title: `Class ${testRunId}`,
    description: null,
    serviceType: "Hatha Yoga",
    startAt: "2026-09-01T14:00",
    endAt: "2026-09-01T15:00",
    location: "Test Studio",
    capacity: 5,
    isPublic: false,
  });
  if (!validation.valid) throw new Error("unexpected invalid class session input");

  const created = await createClassSessionForOrganizer(
    organizerProfileId,
    demand.id,
    validation.normalized,
  );
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);

  await prisma.classSession.update({
    where: { id: created.classSessionId },
    data: { status: "open_for_enrollment", startAt: new Date(startAt) },
  });

  return {
    classSessionId: created.classSessionId,
    organizerProfileId,
    organizerUserId,
    organizerSessionToken,
    teacherUserId: teacher.userId,
  };
}

async function seedMember(testRunId: string, suffix: string) {
  const email = `member-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

test.describe("class session cancellation smoke", () => {
  // D10 #1: cancel vs enroll race — the exact scenario D3 was designed to prevent:
  // enrollment wins the lock race and commits first, but cancel's cascade (once it
  // acquires the lock afterward) must still correctly catch and cancel it.
  test("concurrent cancel-vs-enroll: FOR UPDATE deterministically serializes them, and the enrollment that won the race is still correctly cascaded to cancelled", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-lock-${Date.now()}`,
    );
    const { classSessionId, organizerProfileId } = await seedClassSession({ testRunId });
    const { userId: memberId } = await seedMember(testRunId, "lock");

    const releaseEnroll = createDeferred<void>();
    let enrollAcquired = false;
    let cancelReachedLockStatement = false;
    let cancelAcquired = false;

    const enrollCall = createEnrollmentForUser(memberId, classSessionId, { notes: null }, {
      onLockAcquired: async () => {
        enrollAcquired = true;
        await releaseEnroll.promise;
      },
    });

    await waitUntil(() => enrollAcquired);

    const cancelCall = cancelClassSessionForOrganizer(organizerProfileId, classSessionId, {
      onBeforeLock: () => {
        cancelReachedLockStatement = true;
      },
      onLockAcquired: () => {
        cancelAcquired = true;
      },
    });

    await waitUntil(() => cancelReachedLockStatement);
    await sleep(300);
    expect(cancelAcquired).toBe(false);

    releaseEnroll.resolve();
    const [enrollResult, cancelResult] = await Promise.all([enrollCall, cancelCall]);
    expect(cancelAcquired).toBe(true);

    expect(enrollResult.ok).toBe(true);
    expect(cancelResult.ok).toBe(true);

    const classSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: classSessionId },
    });
    expect(classSession.status).toBe("cancelled");

    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { classSessionId, userId: memberId },
    });
    expect(enrollment.status).toBe("cancelled");
  });

  // D10 #2: cascade cancellation.
  test("cancelling a class session cascades all confirmed enrollments to cancelled, without touching other class sessions", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cascade-${Date.now()}`,
    );
    const { classSessionId, organizerProfileId } = await seedClassSession({ testRunId });
    const other = await seedClassSession({ testRunId: `${testRunId}-other` });

    const memberA = await seedMember(testRunId, "a");
    const memberB = await seedMember(testRunId, "b");
    const otherMember = await seedMember(testRunId, "other");

    const enrollA = await createEnrollmentForUser(memberA.userId, classSessionId, { notes: null });
    const enrollB = await createEnrollmentForUser(memberB.userId, classSessionId, { notes: null });
    const enrollOther = await createEnrollmentForUser(otherMember.userId, other.classSessionId, {
      notes: null,
    });
    if (!enrollA.ok || !enrollB.ok || !enrollOther.ok) throw new Error("enroll setup failed");

    const cancelResult = await cancelClassSessionForOrganizer(organizerProfileId, classSessionId);
    expect(cancelResult).toEqual({ ok: true });

    const enrollments = await prisma.enrollment.findMany({ where: { classSessionId } });
    expect(enrollments).toHaveLength(2);
    expect(enrollments.every((e) => e.status === "cancelled")).toBe(true);

    const otherEnrollment = await prisma.enrollment.findFirstOrThrow({
      where: { id: enrollOther.enrollmentId },
    });
    expect(otherEnrollment.status).toBe("confirmed");
  });

  // D10 #3: D2 temporal guard.
  test("D2: rejects cancelling an already-started class session", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-started-${Date.now()}`,
    );
    const { classSessionId, organizerProfileId } = await seedClassSession({
      testRunId,
      startAt: "2020-01-01T00:00:00Z",
    });

    const result = await cancelClassSessionForOrganizer(organizerProfileId, classSessionId);
    expect(result).toEqual({ ok: false, code: "class_session_already_started" });

    const classSession = await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId } });
    expect(classSession.status).toBe("open_for_enrollment");
  });

  // D10 #4: notification correctness, including that an already-cancelled (unaffected)
  // enrollment does NOT get a duplicate class_session_cancelled notification.
  test("notifies organizer(self), teacher(counterpart), and each affected member — but not a member whose enrollment was already cancelled beforehand", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-${Date.now()}`,
    );
    const { classSessionId, organizerProfileId, organizerUserId, teacherUserId } =
      await seedClassSession({ testRunId });

    const stillConfirmedMember = await seedMember(testRunId, "confirmed");
    const alreadyCancelledMember = await seedMember(testRunId, "precancelled");

    const enrollConfirmed = await createEnrollmentForUser(
      stillConfirmedMember.userId,
      classSessionId,
      { notes: null },
    );
    const enrollPrecancelled = await createEnrollmentForUser(
      alreadyCancelledMember.userId,
      classSessionId,
      { notes: null },
    );
    if (!enrollConfirmed.ok || !enrollPrecancelled.ok) throw new Error("enroll setup failed");

    // Simulate this member having already self-cancelled before the organizer's cancel.
    await prisma.enrollment.update({
      where: { id: enrollPrecancelled.enrollmentId },
      data: { status: "cancelled" },
    });

    const cancelResult = await cancelClassSessionForOrganizer(organizerProfileId, classSessionId);
    expect(cancelResult).toEqual({ ok: true });

    // 只查詢這個測試自己建立的收件人，不查全表——這個測試檔案在同一個 worker 內依序
    // 執行多個測試，前面的測試也會建立 class_session_cancelled 記錄，查全表會混進去。
    const notifs = await prisma.notification.findMany({
      where: {
        type: "class_session_cancelled",
        userId: {
          in: [organizerUserId, teacherUserId, stillConfirmedMember.userId, alreadyCancelledMember.userId],
        },
      },
    });

    const orgNotif = notifs.find((n) => n.userId === organizerUserId);
    expect(orgNotif?.title).toBe("課程已取消");

    const teacherNotif = notifs.find((n) => n.userId === teacherUserId);
    expect(teacherNotif?.body).toContain("已經取消");

    const memberNotif = notifs.find((n) => n.userId === stillConfirmedMember.userId);
    expect(memberNotif?.body).toContain("你的報名也一併取消了");

    const precancelledNotif = notifs.find((n) => n.userId === alreadyCancelledMember.userId);
    expect(precancelledNotif).toBeUndefined();

    expect(notifs).toHaveLength(3);
  });

  // D10 #5: IDOR.
  test("blocks a non-owning organizer from cancelling someone else's class session (IDOR)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId });

    const otherEmail = `other-organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const { organizerProfileId: otherOrganizerProfileId } = await createOrganizerProfileWithOrganization({
      email: otherEmail,
      displayName: `Other Organizer ${testRunId}`,
      organizationName: `Other Org ${testRunId}`,
    });

    const result = await cancelClassSessionForOrganizer(otherOrganizerProfileId, classSessionId);
    expect(result).toEqual({ ok: false, code: "class_session_not_found" });

    const classSession = await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId } });
    expect(classSession.status).toBe("open_for_enrollment");
  });

  // D10 #6: double-cancel.
  test("cancelling an already-cancelled class session returns an explicit error, not silent success", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-double-${Date.now()}`,
    );
    const { classSessionId, organizerProfileId } = await seedClassSession({ testRunId });

    const first = await cancelClassSessionForOrganizer(organizerProfileId, classSessionId);
    expect(first).toEqual({ ok: true });

    const second = await cancelClassSessionForOrganizer(organizerProfileId, classSessionId);
    expect(second).toEqual({ ok: false, code: "class_session_already_cancelled" });
  });

  // D10 #7: full UI E2E flow — the path none of the direct-call tests above exercise:
  // the actual cancel form, cancelClassSessionAction, redirect feedback, and the
  // resulting state as seen by the organizer, member, and teacher.
  test("lets an organizer cancel a class session through the UI; member and teacher both see it reflected", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-ui-${Date.now()}`,
    );
    const { classSessionId, organizerSessionToken, teacherUserId } = await seedClassSession({
      testRunId,
    });
    const member = await seedMember(testRunId, "ui");
    const enrollResult = await createEnrollmentForUser(member.userId, classSessionId, {
      notes: null,
    });
    if (!enrollResult.ok) throw new Error("enroll setup failed");

    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await page.getByText("取消課程…").click();
    await page
      .getByRole("checkbox", { name: "我確認要取消這堂課程，且已報名的會員也會一併取消。" })
      .check();
    await page.getByRole("button", { name: "確認取消課程" }).click();
    await expect(page.getByText("課程已取消。")).toBeVisible();
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();

    await context.clearCookies();
    const { sessionToken: memberSessionToken } = await createUserSessionFor(member.userId);
    await addAuthSessionCookie(context, memberSessionToken);
    await page.goto("/member/enrollments");
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();

    await context.clearCookies();
    const { sessionToken: teacherSessionToken } = await createUserSessionFor(teacherUserId);
    await addAuthSessionCookie(context, teacherSessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();
  });
});

async function createUserSessionFor(userId: string) {
  const sessionToken = `test-session-${userId}-${Date.now()}`;
  await prisma.session.create({
    data: { sessionToken, userId, expires: new Date(Date.now() + 1000 * 60 * 60) },
  });
  return { sessionToken };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitUntil timed out");
    }

    await sleep(10);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
