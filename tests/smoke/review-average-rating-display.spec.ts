import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import {
  formatTeacherRatingSummary,
  type TeacherRatingSummary,
} from "../../src/domain/review/rating-summary";
import { submitReviewForUser } from "../../src/domain/review/__internal__/submit-review-core";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "review-average-rating-display-smoke.local";
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

// 比照既有 class-session-review.spec.ts 的兩段式作法：先用未來時間 + open_for_enrollment
// 建立，完成報名後再回填成過去時間並轉成 completed（submitReviewForUser 要求 completed）。
async function seedTeacherWithCompletedClassSession({
  testRunId,
  teacherLabel,
  status,
}: {
  testRunId: string;
  teacherLabel: string;
  status: "approved" | "suspended";
}) {
  const organizerEmail = `organizer-${teacherLabel}-${testRunId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${teacherLabel}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);

  const organizer = await createUserSession({ email: organizerEmail });
  const organization = await prisma.organization.create({
    data: { name: `Org ${teacherLabel} ${testRunId}`, type: "company" },
    select: { id: true },
  });
  const organizerProfile = await prisma.organizerProfile.create({
    data: { userId: organizer.userId, organizationId: organization.id, displayName: "Organizer" },
    select: { id: true },
  });
  const demand = await prisma.demandRequest.create({
    data: {
      organizerProfileId: organizerProfile.id,
      organizationId: organization.id,
      status: "converted_to_class",
    },
    select: { id: true },
  });

  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${teacherLabel} ${testRunId}`,
    status: "approved",
  });

  const classSession = await prisma.classSession.create({
    data: {
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      organizerProfileId: organizerProfile.id,
      organizationId: organization.id,
      title: `Class ${teacherLabel} ${testRunId}`,
      startAt: new Date("2099-01-01T09:00:00Z"),
      endAt: new Date("2099-01-01T10:00:00Z"),
      location: "Test Studio",
      capacity: 10,
      status: "open_for_enrollment",
    },
    select: { id: true },
  });

  if (status === "suspended") {
    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { status: "suspended", suspensionReason: "test suspension" },
    });
  }

  return {
    classSessionId: classSession.id,
    teacherProfileId: teacher.teacherProfileId,
    teacherSessionToken: teacher.sessionToken,
  };
}

async function markCompleted(classSessionId: string) {
  await prisma.classSession.update({
    where: { id: classSessionId },
    data: { startAt: new Date("2020-01-01T09:00:00Z"), endAt: new Date("2020-01-01T10:00:00Z"), status: "completed" },
  });
}

// createEnrollmentForUser 要求 class session 還在 open_for_enrollment／未來時間，
// 但 submitReviewForUser 要求 completed——兩者互斥，所以必須先在 open_for_enrollment
// 狀態下完成報名，等 markCompleted() 把狀態轉成 completed 之後才能送出評價
// （比照既有 class-session-review.spec.ts 的兩段式作法，不可以合併成一步）。
async function enrollNewMember({
  testRunId,
  memberLabel,
  classSessionId,
}: {
  testRunId: string;
  memberLabel: string;
  classSessionId: string;
}) {
  const memberEmail = `member-${memberLabel}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(memberEmail);
  const member = await createUserSession({ email: memberEmail });

  const enrollment = await createEnrollmentForUser(member.userId, classSessionId, { notes: null });
  if (!enrollment.ok) {
    throw new Error(`enrollment setup failed: ${enrollment.code}`);
  }

  return { userId: member.userId };
}

async function submitReview({
  userId,
  classSessionId,
  rating,
}: {
  userId: string;
  classSessionId: string;
  rating: number;
}) {
  const result = await submitReviewForUser(userId, classSessionId, { rating, comment: null });
  if (!result.ok) {
    throw new Error(`review submit failed: ${result.code}`);
  }
}

test.describe("formatTeacherRatingSummary (direct, no UI)", () => {
  test("returns 尚無評價 for zero reviews", () => {
    const summary: TeacherRatingSummary = { averageRating: null, reviewCount: 0 };
    expect(formatTeacherRatingSummary(summary)).toBe("尚無評價");
  });

  test("rounds the 81/20 = 4.05 boundary case up to 4.1, not down to 4.0 (toFixed(1) pitfall)", () => {
    const summary: TeacherRatingSummary = { averageRating: 81 / 20, reviewCount: 20 };
    expect(formatTeacherRatingSummary(summary)).toBe("4.1 分（20 則評價）");
  });

  test("formats a plain integer average", () => {
    const summary: TeacherRatingSummary = { averageRating: 4, reviewCount: 2 };
    expect(formatTeacherRatingSummary(summary)).toBe("4.0 分（2 則評價）");
  });
});

test.describe("review average rating display smoke", () => {
  test("/teacher/profile shows the teacher's own average, unpolluted by another teacher's reviews (sentinel)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-own-${Date.now()}`,
    );

    const teacherA = await seedTeacherWithCompletedClassSession({
      testRunId,
      teacherLabel: "a",
      status: "approved",
    });
    const memberA1 = await enrollNewMember({ testRunId, memberLabel: "a1", classSessionId: teacherA.classSessionId });
    const memberA2 = await enrollNewMember({ testRunId, memberLabel: "a2", classSessionId: teacherA.classSessionId });
    await markCompleted(teacherA.classSessionId);
    await submitReview({ userId: memberA1.userId, classSessionId: teacherA.classSessionId, rating: 5 });
    await submitReview({ userId: memberA2.userId, classSessionId: teacherA.classSessionId, rating: 3 });

    // Sentinel: Teacher B, deliberately different rating (all 1s), proves teacherProfileId
    // filter isn't broken/missing in getOwnTeacherRatingSummary().
    const teacherB = await seedTeacherWithCompletedClassSession({
      testRunId,
      teacherLabel: "b",
      status: "approved",
    });
    const memberB1 = await enrollNewMember({ testRunId, memberLabel: "b1", classSessionId: teacherB.classSessionId });
    await markCompleted(teacherB.classSessionId);
    await submitReview({ userId: memberB1.userId, classSessionId: teacherB.classSessionId, rating: 1 });

    await addAuthSessionCookie(context, teacherA.teacherSessionToken);
    await page.goto("/teacher/profile");
    await expect(page.getByText("4.0 分（2 則評價）")).toBeVisible();
    await expect(page.getByText("1.0 分（1 則評價）")).toBeHidden();
  });

  test("/teacher/profile shows 尚無評價 for an approved teacher with no reviews", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-zero-${Date.now()}`,
    );
    const teacherEmail = `teacher-zero-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail);
    const teacher = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher Zero ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/profile");
    await expect(page.getByText("尚無評價")).toBeVisible();
  });

  test("/teacher/profile shows the average for a suspended teacher (read-only branch)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspended-${Date.now()}`,
    );
    const teacher = await seedTeacherWithCompletedClassSession({
      testRunId,
      teacherLabel: "susp",
      status: "suspended",
    });
    const member = await enrollNewMember({ testRunId, memberLabel: "susp1", classSessionId: teacher.classSessionId });
    await markCompleted(teacher.classSessionId);
    await submitReview({ userId: member.userId, classSessionId: teacher.classSessionId, rating: 2 });

    await addAuthSessionCookie(context, teacher.teacherSessionToken);
    await page.goto("/teacher/profile");
    await expect(page.getByText("2.0 分（1 則評價）")).toBeVisible();
  });

  test("/admin/teachers shows each teacher's own average, unpolluted across teachers (sentinel)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-admin-${Date.now()}`,
    );

    const teacherA = await seedTeacherWithCompletedClassSession({
      testRunId,
      teacherLabel: "adminA",
      status: "approved",
    });
    const memberAdminA1 = await enrollNewMember({ testRunId, memberLabel: "adminA1", classSessionId: teacherA.classSessionId });
    const memberAdminA2 = await enrollNewMember({ testRunId, memberLabel: "adminA2", classSessionId: teacherA.classSessionId });
    await markCompleted(teacherA.classSessionId);
    await submitReview({ userId: memberAdminA1.userId, classSessionId: teacherA.classSessionId, rating: 5 });
    await submitReview({ userId: memberAdminA2.userId, classSessionId: teacherA.classSessionId, rating: 5 });

    const teacherB = await seedTeacherWithCompletedClassSession({
      testRunId,
      teacherLabel: "adminB",
      status: "suspended",
    });
    const memberAdminB1 = await enrollNewMember({ testRunId, memberLabel: "adminB1", classSessionId: teacherB.classSessionId });
    await markCompleted(teacherB.classSessionId);
    await submitReview({ userId: memberAdminB1.userId, classSessionId: teacherB.classSessionId, rating: 2 });

    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken: adminSessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, adminSessionToken);

    await page.goto("/admin/teachers");
    // /admin/teachers 列出全平台所有老師，平行 worker 共用同一個 DB，其他同時執行的測試
    // 可能剛好也建立出一樣的評分文字（例如另一個 project 同時跑同一個測試），所以斷言必須
    // 先用老師自己的顯示名稱鎖定卡片範圍，不能對整頁做全域文字比對
    // （比照這一輪 admin-organizations.spec.ts 的既有先例）。
    const cardA = page.locator("article").filter({ hasText: `Teacher adminA ${testRunId}` });
    const cardB = page.locator("article").filter({ hasText: `Teacher adminB ${testRunId}` });
    await expect(cardA.getByText("5.0 分（2 則評價）")).toBeVisible();
    await expect(cardB.getByText("2.0 分（1 則評價）")).toBeVisible();
  });

  test("keeps /teacher/profile usable at mobile width (no horizontal overflow) with the new rating block", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-rwd-${Date.now()}`,
    );
    const teacher = await seedTeacherWithCompletedClassSession({
      testRunId,
      teacherLabel: "rwd",
      status: "approved",
    });
    const member = await enrollNewMember({ testRunId, memberLabel: "rwd1", classSessionId: teacher.classSessionId });
    await markCompleted(teacher.classSessionId);
    await submitReview({ userId: member.userId, classSessionId: teacher.classSessionId, rating: 4 });

    await addAuthSessionCookie(context, teacher.teacherSessionToken);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/teacher/profile");
    await expect(page.getByText("4.0 分（1 則評價）")).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });
});
