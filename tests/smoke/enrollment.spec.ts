import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
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

const testEmailDomain = "enrollment-smoke.local";
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
  status = "open_for_enrollment" as const,
  startAt = "2099-01-01T00:00:00Z",
  capacity = 5,
}: {
  testRunId: string;
  status?: "draft" | "open_for_enrollment";
  startAt?: string;
  capacity?: number;
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
    capacity,
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
    data: { status, startAt: new Date(startAt) },
  });

  return { classSessionId: created.classSessionId, organizerProfileId, organizerSessionToken };
}

async function seedMember(testRunId: string, suffix: string) {
  const email = `member-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

test.describe("enrollment smoke", () => {
  test("lets an organizer open enrollment (with a discoverable share link) and a member enroll via it; roster reflects it for both organizer and teacher", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-ui-${Date.now()}`,
    );
    const {
      classSessionId,
      organizerSessionToken,
    } = await seedClassSession({ testRunId, status: "draft" });
    const { sessionToken: memberSessionToken, userId: memberUserId } = await seedMember(
      testRunId,
      "a",
    );

    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await page.getByRole("checkbox", { name: "我確認要開放這堂課程的報名。" }).check();
    await page.getByRole("button", { name: "開放報名" }).click();

    await expect(page.getByText("已開放報名。")).toBeVisible();
    const shareLink = page.getByText(`/classes/${classSessionId}`, { exact: true });
    await expect(shareLink).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, memberSessionToken);
    await page.goto(`/classes/${classSessionId}`);
    await page.getByLabel("備註（選填）").fill("測試備註內容");
    await page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ }).check();
    await page.getByRole("button", { name: "確認報名" }).click();

    await expect(page.getByText("報名成功。")).toBeVisible();

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { classSessionId_userId: { classSessionId, userId: memberUserId } },
    });
    expect(enrollment.status).toBe("confirmed");
    expect(enrollment.consentedAt).not.toBeNull();

    await context.clearCookies();
    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await expect(page.getByText("已報名會員（1 人）")).toBeVisible();
    await expect(page.getByText("測試備註內容")).toBeVisible();
  });

  test("validation boundaries reject too-long notes and missing consent on the server", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-validation-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId });
    const { sessionToken } = await seedMember(testRunId, "b");

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/classes/${classSessionId}`);

    // textarea 的 maxLength 只是體驗提升，這裡移除它連同表單的原生驗證，
    // 證明伺服器端才是權威（比照既有 admin-demands.spec.ts 的既定作法）。
    const notesField = page.getByLabel("備註（選填）");
    await notesField.evaluate((el: HTMLTextAreaElement) => {
      el.removeAttribute("maxlength");
    });
    await notesField.fill("a".repeat(501));
    await page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ }).check();
    await page.locator("form").evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
    await page.getByRole("button", { name: "確認報名" }).click();

    await expect(page.getByText(/不可超過 500 個字/)).toBeVisible();

    const count = await prisma.enrollment.count({ where: { classSessionId } });
    expect(count).toBe(0);

    // 未勾選 basicConsent 也要被伺服器端擋下（同一頁重新整理，繞過前端 required）。
    await page.goto(`/classes/${classSessionId}`);
    await page.getByLabel("備註（選填）").fill("正常長度的備註");
    await page.locator("form").evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
    await page.getByRole("button", { name: "確認報名" }).click();

    await expect(page.getByText(/請先勾選確認/)).toBeVisible();

    const countAfterMissingConsent = await prisma.enrollment.count({
      where: { classSessionId },
    });
    expect(countAfterMissingConsent).toBe(0);
  });

  test("blocks enrollment on a non-open class session, blocks duplicate enrollment, and blocks re-enrollment after cancellation while freeing capacity for someone else", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-rules-${Date.now()}`,
    );
    const { classSessionId: draftId } = await seedClassSession({
      testRunId: `${testRunId}-draft`,
      status: "draft",
    });
    const { userId: memberDraft } = await seedMember(testRunId, "draft-member");
    const notOpenResult = await createEnrollmentForUser(memberDraft, draftId, { notes: null });
    expect(notOpenResult).toEqual({ ok: false, code: "class_session_not_open" });

    const { classSessionId } = await seedClassSession({ testRunId, capacity: 2 });
    const { userId: memberA } = await seedMember(testRunId, "c1");
    const { userId: memberB } = await seedMember(testRunId, "c2");

    const first = await createEnrollmentForUser(memberA, classSessionId, { notes: null });
    expect(first.ok).toBe(true);

    const duplicate = await createEnrollmentForUser(memberA, classSessionId, { notes: null });
    expect(duplicate).toEqual({ ok: false, code: "already_enrolled" });

    if (first.ok) {
      await prisma.enrollment.update({
        where: { id: first.enrollmentId },
        data: { status: "cancelled" },
      });
    }

    const reEnroll = await createEnrollmentForUser(memberA, classSessionId, { notes: null });
    expect(reEnroll).toEqual({ ok: false, code: "already_enrolled" });

    const otherMemberTakesFreedCapacity = await createEnrollmentForUser(
      memberB,
      classSessionId,
      { notes: null },
    );
    expect(otherMemberTakesFreedCapacity.ok).toBe(true);
  });

  test("D14: rejects enrollment on an already-started class session", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-d14-create-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({
      testRunId,
      startAt: "2020-01-01T00:00:00Z",
    });
    const { userId: memberId } = await seedMember(testRunId, "d14a");

    const result = await createEnrollmentForUser(memberId, classSessionId, { notes: null });
    expect(result).toEqual({ ok: false, code: "class_session_already_started" });
  });

  test("D14: blocks opening enrollment on an already-started draft through the UI", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-d14-open-${Date.now()}`,
    );
    const { classSessionId, organizerSessionToken } = await seedClassSession({
      testRunId,
      status: "draft",
      startAt: "2020-01-01T00:00:00Z",
    });

    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await page.getByRole("checkbox", { name: "我確認要開放這堂課程的報名。" }).check();
    await page.getByRole("button", { name: "開放報名" }).click();

    await expect(page.getByText("這堂課程已經開始，無法開放報名。")).toBeVisible();

    const classSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: classSessionId },
    });
    expect(classSession.status).toBe("draft");
  });

  test("D14: blocks cancelling an enrollment on an already-started class through the UI", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-d14-cancel-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({
      testRunId,
      startAt: "2020-01-01T00:00:00Z",
    });
    const { sessionToken, userId: memberId } = await seedMember(testRunId, "d14c");
    const enrollment = await prisma.enrollment.create({
      data: {
        classSessionId,
        userId: memberId,
        status: "confirmed",
        consentedAt: new Date(),
      },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/member/enrollments");
    await page.getByText("取消報名…").click();
    await page.getByRole("checkbox", { name: "我確認要取消這則報名。" }).check();
    await page.getByRole("button", { name: "確認取消" }).click();

    await expect(page.getByText("這堂課程已經開始，無法取消報名。")).toBeVisible();

    const stillConfirmed = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(stillConfirmed.status).toBe("confirmed");
  });

  test("draft class sessions are hidden from members (not-found, no field leakage)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-draft-hidden-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId, status: "draft" });
    const { sessionToken } = await seedMember(testRunId, "e");

    await addAuthSessionCookie(context, sessionToken);
    const response = await page.goto(`/classes/${classSessionId}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText(`Class ${testRunId}`)).toBeHidden();
    await expect(page.getByText("Test Studio")).toBeHidden();
  });

  test("IDOR: a member cannot view or cancel another member's enrollment through the UI", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-member-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId });
    const { userId: memberA } = await seedMember(testRunId, "f1");
    const { sessionToken: memberBToken } = await seedMember(testRunId, "f2");

    await prisma.enrollment.create({
      data: {
        classSessionId,
        userId: memberA,
        status: "confirmed",
        consentedAt: new Date(),
      },
    });

    await addAuthSessionCookie(context, memberBToken);
    await page.goto("/member/enrollments");
    await expect(page.getByText("目前沒有任何報名")).toBeVisible();
    await expect(page.getByText(`Class ${testRunId}`)).toBeHidden();
  });

  test("IDOR: an organizer cannot view another organizer's class session detail (404)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-organizer-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId });

    const otherOrganizerEmail = `other-organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherOrganizerEmail);
    const { sessionToken: otherOrganizerToken } = await createOrganizerProfileWithOrganization({
      email: otherOrganizerEmail,
      displayName: `Other Organizer ${testRunId}`,
      organizationName: `Other Org ${testRunId}`,
    });

    await addAuthSessionCookie(context, otherOrganizerToken);
    const response = await page.goto(`/organizer/classes/${classSessionId}`);

    expect(response?.status()).toBe(404);
  });

  test("IDOR: a teacher only sees roster data for their own class sessions, not another teacher's", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-teacher-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId });
    const { userId: memberA } = await seedMember(testRunId, "f3");
    await prisma.enrollment.create({
      data: {
        classSessionId,
        userId: memberA,
        status: "confirmed",
        consentedAt: new Date(),
        notes: "IDOR 測試備註",
      },
    });

    const otherTeacherEmail = `other-teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherTeacherEmail);
    const { sessionToken: otherTeacherToken } = await createTeacherProfileWithSession({
      email: otherTeacherEmail,
      displayName: `Other Teacher ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, otherTeacherToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText("目前沒有已建立的課程")).toBeVisible();
    await expect(page.getByText("IDOR 測試備註")).toBeHidden();
  });

  // D5 併發保護，比照前兩輪的 hooks 確定性鎖測試手法：用 production 函式本身的
  // hooks.onBeforeLock/onLockAcquired 當同步點，證明第一個呼叫真的持有鎖、第二個呼叫
  // 真的送出了同一句 FOR UPDATE 卻被擋住，鎖釋放後才繼續，而不是機率性的 Promise.all。
  test("concurrent enrollment on the last remaining seat: FOR UPDATE deterministically blocks the second call, and exactly one succeeds", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId, capacity: 1 });
    const { userId: memberA } = await seedMember(testRunId, "g1");
    const { userId: memberB } = await seedMember(testRunId, "g2");

    const releaseFirst = createDeferred<void>();
    let firstAcquired = false;
    let secondReachedLockStatement = false;
    let secondAcquired = false;

    const firstCall = createEnrollmentForUser(memberA, classSessionId, { notes: null }, {
      onLockAcquired: async () => {
        firstAcquired = true;
        await releaseFirst.promise;
      },
    });
    await waitUntil(() => firstAcquired);

    const secondCall = createEnrollmentForUser(memberB, classSessionId, { notes: null }, {
      onBeforeLock: () => {
        secondReachedLockStatement = true;
      },
      onLockAcquired: () => {
        secondAcquired = true;
      },
    });
    await waitUntil(() => secondReachedLockStatement);

    await sleep(300);
    expect(secondAcquired).toBe(false);

    releaseFirst.resolve();
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(secondAcquired).toBe(true);

    expect(firstResult.ok).toBe(true);
    expect(secondResult).toEqual({ ok: false, code: "class_session_full" });

    const confirmedCount = await prisma.enrollment.count({
      where: { classSessionId, status: "confirmed" },
    });
    expect(confirmedCount).toBe(1);
  });
});

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
