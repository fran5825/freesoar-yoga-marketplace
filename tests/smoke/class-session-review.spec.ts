import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { submitReviewForUser } from "../../src/domain/review/__internal__/submit-review-core";
import { validateReviewInput } from "../../src/domain/review/validation";
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

const testEmailDomain = "class-session-review-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.review.deleteMany({
    where: { reviewer: { email: { in: createdEmails } } },
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

// createEnrollmentForUser 要求 startAt 還在未來（D14 guard），所以一律先用未來時間建立
// class session（狀態為 draft/open_for_enrollment/cancelled 三者之一）；需要「completed」
// 的情境時，先在這個 open_for_enrollment 狀態下完成報名，再呼叫 markClassSessionCompleted
// 把時間回填成過去並轉成 completed（比照 class-session-completion.spec.ts 既有
// seedClassSession 的既有兩段式作法）。
async function seedClassSession({
  testRunId,
  status,
}: {
  testRunId: string;
  status: "draft" | "open_for_enrollment" | "cancelled";
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
      startAt: new Date("2099-01-01T09:00:00Z"),
      endAt: new Date("2099-01-01T10:00:00Z"),
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

// 需要一個已經是 completed 的 class session 時的捷徑：先以 open_for_enrollment + 未來時間
// 建立，供呼叫端在這之後、標記完成之前完成報名，再呼叫這個 helper 回填成過去並轉成 completed。
async function seedCompletedClassSession(testRunId: string) {
  const seeded = await seedClassSession({ testRunId, status: "open_for_enrollment" });
  return seeded;
}

async function markClassSessionCompleted(classSessionId: string) {
  await prisma.classSession.update({
    where: { id: classSessionId },
    data: {
      startAt: new Date("2020-01-01T09:00:00Z"),
      endAt: new Date("2020-01-01T10:00:00Z"),
      status: "completed",
    },
  });
}

async function seedMember(testRunId: string, suffix: string) {
  const email = `member-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

async function seedConfirmedEnrollment(classSessionId: string, userId: string) {
  const result = await createEnrollmentForUser(userId, classSessionId, { notes: null });
  if (!result.ok) throw new Error(`enrollment setup failed: ${result.code}`);
  return result.enrollmentId;
}

test.describe("class session review smoke", () => {
  test("D1: rejects a review when the class session is not completed", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-not-completed-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({
      testRunId,
      status: "open_for_enrollment",
    });
    const member = await seedMember(testRunId, "not-completed");
    await seedConfirmedEnrollment(classSessionId, member.userId);

    const result = await submitReviewForUser(member.userId, classSessionId, {
      rating: 5,
      comment: null,
    });

    expect(result).toEqual({ ok: false, code: "review_not_eligible" });
  });

  test("D1: rejects a review when the member has no confirmed enrollment (cancelled)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cancelled-enrollment-${Date.now()}`,
    );
    const { classSessionId } = await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "cancelled-enrollment");
    const enrollmentId = await seedConfirmedEnrollment(classSessionId, member.userId);
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "cancelled" },
    });
    await markClassSessionCompleted(classSessionId);

    const result = await submitReviewForUser(member.userId, classSessionId, {
      rating: 4,
      comment: null,
    });

    expect(result).toEqual({ ok: false, code: "review_not_eligible" });
  });

  test("D1: rejects a review when the member was never enrolled at all", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-no-enrollment-${Date.now()}`,
    );
    const { classSessionId } = await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "no-enrollment");
    await markClassSessionCompleted(classSessionId);

    const result = await submitReviewForUser(member.userId, classSessionId, {
      rating: 3,
      comment: null,
    });

    expect(result).toEqual({ ok: false, code: "review_not_eligible" });
  });

  test("D3: rejects a second review from the same member for the same class session", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-duplicate-${Date.now()}`,
    );
    const { classSessionId } = await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "duplicate");
    await seedConfirmedEnrollment(classSessionId, member.userId);
    await markClassSessionCompleted(classSessionId);

    const first = await submitReviewForUser(member.userId, classSessionId, {
      rating: 5,
      comment: "第一次評價",
    });
    expect(first.ok).toBe(true);

    const second = await submitReviewForUser(member.userId, classSessionId, {
      rating: 2,
      comment: "第二次嘗試",
    });
    expect(second).toEqual({ ok: false, code: "review_already_exists" });
  });

  test("D2: rating/comment validation boundaries", () => {
    expect(validateReviewInput({ rating: null })).toMatchObject({
      valid: false,
      errors: [{ field: "rating", code: "rating_required" }],
    });
    expect(validateReviewInput({ rating: 0 })).toMatchObject({
      valid: false,
      errors: [{ field: "rating", code: "rating_out_of_range" }],
    });
    expect(validateReviewInput({ rating: 6 })).toMatchObject({
      valid: false,
      errors: [{ field: "rating", code: "rating_out_of_range" }],
    });
    expect(validateReviewInput({ rating: 3.5 })).toMatchObject({
      valid: false,
      errors: [{ field: "rating", code: "rating_out_of_range" }],
    });
    expect(validateReviewInput({ rating: 5, comment: "a".repeat(501) })).toMatchObject({
      valid: false,
      errors: [{ field: "comment", code: "comment_too_long" }],
    });
    expect(validateReviewInput({ rating: 5, comment: "a".repeat(500) })).toEqual({
      valid: true,
      normalized: { rating: 5, comment: "a".repeat(500) },
    });
    expect(validateReviewInput({ rating: 1, comment: "  " })).toEqual({
      valid: true,
      normalized: { rating: 1, comment: null },
    });
  });

  // D5：review_submitted 通知內容正確性——用 notifyOverride 注入驗證收件人（授課老師、
  // role: counterpart）與文案 payload，取代 Slice 1 throwaway script 的等價案例。
  test("D5: sends a review_submitted notification to the teacher with the correct recipient and payload", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-${Date.now()}`,
    );
    const { classSessionId, teacherUserId } = await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "notify");
    await seedConfirmedEnrollment(classSessionId, member.userId);
    await prisma.user.update({
      where: { id: member.userId },
      data: { name: `Reviewer ${testRunId}` },
    });
    await markClassSessionCompleted(classSessionId);

    const calls: { type: string; recipients: unknown; payload: unknown }[] = [];
    const result = await submitReviewForUser(
      member.userId,
      classSessionId,
      { rating: 5, comment: "老師教得很好" },
      async (type, recipients, payload) => {
        calls.push({ type, recipients, payload });
      },
    );

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe("review_submitted");
    expect(calls[0].recipients).toEqual([{ userId: teacherUserId, role: "counterpart" }]);
    expect(calls[0].payload).toMatchObject({
      actorLabel: `Reviewer ${testRunId}`,
      classSessionTitle: `Class ${testRunId}`,
    });
  });

  // D9/IDOR：非本人 Organizer 看不到別人 class session 的詳情頁（也就看不到評價區塊）。
  test("IDOR: blocks a non-owning organizer from viewing a completed class session's reviews", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-organizer-${Date.now()}`,
    );
    const { classSessionId } = await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "idor-organizer");
    await seedConfirmedEnrollment(classSessionId, member.userId);
    await markClassSessionCompleted(classSessionId);
    const submitResult = await submitReviewForUser(member.userId, classSessionId, {
      rating: 5,
      comment: "只有本人 Organizer 該看得到",
    });
    expect(submitResult.ok).toBe(true);

    const otherEmail = `other-organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const { sessionToken: otherSessionToken } = await createUserSession({ email: otherEmail });

    await addAuthSessionCookie(context, otherSessionToken);
    const response = await page.goto(`/organizer/classes/${classSessionId}`);
    expect(response?.status()).toBe(404);
  });

  // IDOR：Teacher 只看得到指派給自己的 class session 的評價，看不到別人的。
  test("IDOR: a teacher never sees another teacher's class session reviews", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-teacher-${Date.now()}`,
    );
    const { classSessionId } = await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "idor-teacher");
    await seedConfirmedEnrollment(classSessionId, member.userId);
    await markClassSessionCompleted(classSessionId);
    const submitResult = await submitReviewForUser(member.userId, classSessionId, {
      rating: 5,
      comment: "只有指派的 Teacher 該看得到",
    });
    expect(submitResult.ok).toBe(true);

    const otherTeacherEmail = `other-teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherTeacherEmail);
    const otherTeacher = await createTeacherProfileWithSession({
      email: otherTeacherEmail,
      displayName: `Other Teacher ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, otherTeacher.sessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText(`Class ${testRunId}`)).toBeHidden();
    await expect(page.getByText("只有指派的 Teacher 該看得到")).toBeHidden();
  });

  // IDOR：Member 的評價列表不包含同一堂課其他 Member 的評價內容。
  test("IDOR: a member's own review list never contains another member's review content", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-member-${Date.now()}`,
    );
    const { classSessionId } = await seedCompletedClassSession(testRunId);
    const memberA = await seedMember(testRunId, "idor-member-a");
    const memberB = await seedMember(testRunId, "idor-member-b");
    await seedConfirmedEnrollment(classSessionId, memberA.userId);
    await seedConfirmedEnrollment(classSessionId, memberB.userId);
    await markClassSessionCompleted(classSessionId);

    const resultA = await submitReviewForUser(memberA.userId, classSessionId, {
      rating: 5,
      comment: "Member A 的評語",
    });
    const resultB = await submitReviewForUser(memberB.userId, classSessionId, {
      rating: 1,
      comment: "Member B 的評語",
    });
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);

    await addAuthSessionCookie(context, memberA.sessionToken);
    await page.goto("/member/enrollments");
    await expect(page.getByText("Member A 的評語")).toBeVisible();
    await expect(page.getByText("Member B 的評語")).toBeHidden();
  });

  // D6/D7：完整 UI E2E 流程——Member 留下評價後，Organizer／Teacher 頁面都正確顯示。
  test("lets a member submit a review through the UI; it then appears on the organizer and teacher pages", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-e2e-${Date.now()}`,
    );
    const { classSessionId, organizerSessionToken, teacherSessionToken } =
      await seedCompletedClassSession(testRunId);
    const member = await seedMember(testRunId, "e2e");
    await prisma.user.update({
      where: { id: member.userId },
      data: { name: `Member ${testRunId}` },
    });
    await seedConfirmedEnrollment(classSessionId, member.userId);
    await markClassSessionCompleted(classSessionId);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto("/member/enrollments");
    await page.getByText("留下評價…").click();
    await page.getByLabel("星等").selectOption("4");
    await page.getByLabel("評語（選填）").fill("整體體驗很棒，會再來上課。");
    await page.getByRole("button", { name: "送出評價" }).click();

    await expect(page.getByText("評價已送出，謝謝你的回饋。")).toBeVisible();
    await expect(page.getByText("你的評價：★★★★")).toBeVisible();
    await expect(page.getByText("整體體驗很棒，會再來上課。")).toBeVisible();
    await expect(page.getByText("留下評價…")).toBeHidden();

    await context.clearCookies();
    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await expect(page.getByText("學員評價（1 則）")).toBeVisible();
    await expect(page.getByText(`Member ${testRunId}・★★★★`)).toBeVisible();
    await expect(page.getByText("整體體驗很棒，會再來上課。")).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, teacherSessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText("學員評價（1 則）")).toBeVisible();
    await expect(page.getByText(`Member ${testRunId}・★★★★`)).toBeVisible();
    await expect(page.getByText("整體體驗很棒，會再來上課。")).toBeVisible();
  });
});
