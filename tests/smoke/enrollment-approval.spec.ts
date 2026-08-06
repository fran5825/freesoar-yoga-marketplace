import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { cancelClassSessionForAdmin } from "../../src/domain/class-session/__internal__/cancel-class-session-core";
import { cancelClassSessionForTeacher } from "../../src/domain/class-session/__internal__/cancel-class-session-core-for-teacher";
import { cancelEnrollmentForAdminCore } from "../../src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
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

const testEmailDomain = "enrollment-approval-smoke.local";
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

async function seedTeacherClassSession({
  testRunId,
  requiresApproval,
  capacity = 5,
  teacherStatus = "approved" as const,
}: {
  testRunId: string;
  requiresApproval: boolean;
  capacity?: number;
  teacherStatus?: "approved" | "suspended";
}) {
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail);
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: teacherStatus,
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

  const created = await createClassSessionForTeacher(teacher.teacherProfileId, {
    ...validation.normalized,
    requiresApproval,
  });
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);

  await prisma.classSession.update({
    where: { id: created.classSessionId },
    data: { status: "open_for_enrollment" },
  });

  return {
    classSessionId: created.classSessionId,
    teacherProfileId: teacher.teacherProfileId,
    teacherUserId: teacher.userId,
    teacherSessionToken: teacher.sessionToken,
  };
}

async function seedMember(testRunId: string, suffix: string) {
  const email = `member-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

test.describe("enrollment approval (requiresApproval) smoke", () => {
  test("requiresApproval=false behaves exactly like existing confirmed-on-create flow (regression)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-regression-${Date.now()}`,
    );
    const seeded = await seedTeacherClassSession({ testRunId, requiresApproval: false });
    const member = await seedMember(testRunId, "a");

    const result = await createEnrollmentForUser(member.userId, seeded.classSessionId, {
      notes: null,
    });

    expect(result).toEqual({
      ok: true,
      enrollmentId: expect.any(String),
      status: "confirmed",
    });

    const confirmedNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_confirmed", userId: member.userId },
    });
    expect(confirmedNotif).not.toBeNull();
    const pendingReviewNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_pending_review", userId: member.userId },
    });
    expect(pendingReviewNotif).toBeNull();
  });

  test("requiresApproval=true creates a pending enrollment that occupies capacity, and notifies both the member and the teacher", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-pending-create-${Date.now()}`,
    );
    const seeded = await seedTeacherClassSession({
      testRunId,
      requiresApproval: true,
      capacity: 1,
    });
    const memberA = await seedMember(testRunId, "a");
    const memberB = await seedMember(testRunId, "b");

    const first = await createEnrollmentForUser(memberA.userId, seeded.classSessionId, {
      notes: null,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");
    expect(first.status).toBe("pending");

    const memberSelfNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_pending_review", userId: memberA.userId },
    });
    expect(memberSelfNotif).not.toBeNull();
    const teacherNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_pending_review", userId: seeded.teacherUserId },
    });
    expect(teacherNotif).not.toBeNull();

    // capacity=1，pending 已經佔滿名額，第二位會員報名應該被擋。
    const second = await createEnrollmentForUser(memberB.userId, seeded.classSessionId, {
      notes: null,
    });
    expect(second).toEqual({ ok: false, code: "class_session_full" });
  });

  test("teacher can confirm/decline pending enrollments through the /teacher/classes roster UI; confirming sends enrollment_confirmed, declining sends enrollment_cancelled, and a class that has already started blocks both", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-confirm-decline-${Date.now()}`,
    );
    const seeded = await seedTeacherClassSession({ testRunId, requiresApproval: true });
    const memberA = await seedMember(testRunId, "a");
    const memberB = await seedMember(testRunId, "b");

    const enrollmentA = await createEnrollmentForUser(memberA.userId, seeded.classSessionId, {
      notes: `note-from-${memberA.userId}`,
    });
    const enrollmentB = await createEnrollmentForUser(memberB.userId, seeded.classSessionId, {
      notes: `note-from-${memberB.userId}`,
    });
    if (!enrollmentA.ok || !enrollmentB.ok) {
      throw new Error("unexpected create failure in test fixture");
    }

    await addAuthSessionCookie(context, seeded.teacherSessionToken);
    await page.goto("/teacher/classes");

    await expect(page.getByText("待確認報名（2 人）")).toBeVisible();

    const pendingCardA = page.locator("li").filter({ hasText: `note-from-${memberA.userId}` });
    await pendingCardA.getByRole("button", { name: "確認報名" }).click();
    await expect(page.getByText("已確認這筆報名。")).toBeVisible();

    const pendingCardB = page.locator("li").filter({ hasText: `note-from-${memberB.userId}` });
    await pendingCardB.getByRole("button", { name: "拒絕" }).click();
    await expect(page.getByText("已拒絕這筆報名。")).toBeVisible();

    await expect(page.getByText(/待確認報名/)).toBeHidden();

    const [afterConfirm, afterDecline] = await Promise.all([
      prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentA.enrollmentId },
        select: { status: true },
      }),
      prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentB.enrollmentId },
        select: { status: true },
      }),
    ]);
    expect(afterConfirm.status).toBe("confirmed");
    expect(afterDecline.status).toBe("cancelled");

    const confirmedNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_confirmed", userId: memberA.userId },
    });
    expect(confirmedNotif).not.toBeNull();
    const cancelledNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_cancelled", userId: memberB.userId },
    });
    expect(cancelledNotif).not.toBeNull();

    // 課程已經開始後，剩下第三筆 pending 報名不能再被確認或拒絕——按鈕仍會顯示（roster 不
    // 因為課程已開始而隱藏 pending 報名），但點擊後收到明確錯誤，狀態維持 pending 不變。
    const memberC = await seedMember(testRunId, "c");
    const enrollmentC = await createEnrollmentForUser(memberC.userId, seeded.classSessionId, {
      notes: `note-from-${memberC.userId}`,
    });
    if (!enrollmentC.ok) throw new Error("unexpected create failure in test fixture");

    await prisma.classSession.update({
      where: { id: seeded.classSessionId },
      data: { startAt: new Date(Date.now() - 3600_000) },
    });

    await page.goto("/teacher/classes");
    const pendingCardC = page.locator("li").filter({ hasText: `note-from-${memberC.userId}` });
    await pendingCardC.getByRole("button", { name: "確認報名" }).click();
    await expect(page.getByText("這堂課程已經開始，無法確認報名。")).toBeVisible();

    const stillPending = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentC.enrollmentId },
      select: { status: true },
    });
    expect(stillPending.status).toBe("pending");
  });

  test("member can self-cancel a pending enrollment, and Admin can cancel any pending enrollment", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cancel-pending-${Date.now()}`,
    );
    const seeded = await seedTeacherClassSession({ testRunId, requiresApproval: true });
    const memberA = await seedMember(testRunId, "a");
    const memberB = await seedMember(testRunId, "b");

    const enrollmentA = await createEnrollmentForUser(memberA.userId, seeded.classSessionId, {
      notes: null,
    });
    const enrollmentB = await createEnrollmentForUser(memberB.userId, seeded.classSessionId, {
      notes: null,
    });
    if (!enrollmentA.ok || !enrollmentB.ok) {
      throw new Error("unexpected create failure in test fixture");
    }

    // 會員自助取消自己的 pending 報名。
    const selfCancelResult = await prisma.enrollment.updateMany({
      where: {
        id: enrollmentA.enrollmentId,
        userId: memberA.userId,
        status: { in: ["confirmed", "pending"] },
        classSession: { startAt: { gt: new Date() } },
      },
      data: { status: "cancelled" },
    });
    expect(selfCancelResult.count).toBe(1);

    // Admin 取消另一筆 pending 報名。
    const adminCancelResult = await cancelEnrollmentForAdminCore(enrollmentB.enrollmentId);
    expect(adminCancelResult).toEqual({ ok: true });

    const [afterA, afterB] = await Promise.all([
      prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentA.enrollmentId },
        select: { status: true },
      }),
      prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentB.enrollmentId },
        select: { status: true },
      }),
    ]);
    expect(afterA.status).toBe("cancelled");
    expect(afterB.status).toBe("cancelled");
  });

  test("cancelling the class session cascades pending enrollments to cancelled too (organizer/admin core and teacher core), and Admin cancelling a teacher-initiated class notifies the teacher and affected members without silently losing notifications", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cascade-${Date.now()}`,
    );
    const seededAdmin = await seedTeacherClassSession({
      testRunId: `${testRunId}-admin`,
      requiresApproval: true,
    });
    const member1 = await seedMember(`${testRunId}-admin`, "a");
    const enrollment1 = await createEnrollmentForUser(member1.userId, seededAdmin.classSessionId, {
      notes: null,
    });
    if (!enrollment1.ok) throw new Error("unexpected create failure in test fixture");

    // Admin 取消一堂 organizerProfileId = null 的老師自建課程——驗證 Codex round 2 修正：
    // 通知解析對 null 的條件式查詢，取消成功且老師/會員都收到通知，不會被靜默吞掉。
    const adminCancelResult = await cancelClassSessionForAdmin(seededAdmin.classSessionId);
    expect(adminCancelResult).toEqual({ ok: true });

    const afterAdminCancel = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment1.enrollmentId },
      select: { status: true },
    });
    expect(afterAdminCancel.status).toBe("cancelled");

    const teacherNotif = await prisma.notification.findFirst({
      where: { type: "class_session_cancelled", userId: seededAdmin.teacherUserId },
    });
    expect(teacherNotif).not.toBeNull();
    const memberNotif = await prisma.notification.findFirst({
      where: { type: "class_session_cancelled", userId: member1.userId },
    });
    expect(memberNotif).not.toBeNull();

    // 老師版取消核心也要同步涵蓋 pending。
    const seededTeacher = await seedTeacherClassSession({
      testRunId: `${testRunId}-teacher`,
      requiresApproval: true,
    });
    const member2 = await seedMember(`${testRunId}-teacher`, "b");
    const enrollment2 = await createEnrollmentForUser(member2.userId, seededTeacher.classSessionId, {
      notes: null,
    });
    if (!enrollment2.ok) throw new Error("unexpected create failure in test fixture");

    const teacherCancelResult = await cancelClassSessionForTeacher(
      seededTeacher.teacherProfileId,
      seededTeacher.classSessionId,
    );
    expect(teacherCancelResult).toEqual({ ok: true });

    const afterTeacherCancel = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment2.enrollmentId },
      select: { status: true },
    });
    expect(afterTeacherCancel.status).toBe("cancelled");
  });

  test("a suspended teacher's class blocks new enrollments outright (sequential ordering)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspended-${Date.now()}`,
    );
    // 建課當下老師仍是 approved（否則建課本身就會被 teacher_not_approved 擋下）；建立完成
    // 之後才 suspend——模擬「老師建課之後才被暫停」的真實時間順序。
    const seeded = await seedTeacherClassSession({ testRunId, requiresApproval: false });
    await prisma.teacherProfile.update({
      where: { id: seeded.teacherProfileId },
      data: { status: "suspended" },
    });
    const member = await seedMember(testRunId, "a");

    const result = await createEnrollmentForUser(member.userId, seeded.classSessionId, {
      notes: null,
    });
    expect(result).toEqual({ ok: false, code: "teacher_not_approved" });

    const enrollmentCount = await prisma.enrollment.count({
      where: { classSessionId: seeded.classSessionId },
    });
    expect(enrollmentCount).toBe(0);
  });

  // 第 8 節 Codex round 3/4 修正：TeacherProfile 列鎖必須先於讀取 status，才能跟 Admin 執行
  // suspend 的獨立 UPDATE 正確序列化——用 hooks.onTeacherLockAcquired 讓報名 transaction
  // 在「已經持有鎖、已經讀到 approved」的瞬間暫停，證明 Admin 的 suspend UPDATE 真的被同一把
  // 鎖擋住，而不是機率性的 Promise.all。round 4 修正：鎖只保證排隊順序，不保證誰先誰後——
  // 這裡驗證的是「報名 transaction 先拿到鎖」這個順序下的正確結果：報名合法成功，suspend
  // 之後才 commit，但剛才那筆報名不會被追溯撤銷（暫停不回溯影響既有承諾）。
  test("concurrent enrollment-vs-suspend: FOR UPDATE deterministically blocks the suspend until the enrollment transaction commits, and a legitimately-created enrollment is not retroactively invalidated", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-toctou-${Date.now()}`,
    );
    const seeded = await seedTeacherClassSession({ testRunId, requiresApproval: false });
    const member = await seedMember(testRunId, "a");

    const releaseEnrollment = createDeferred<void>();
    let teacherLockAcquired = false;
    let suspendReachedUpdateStatement = false;
    let suspendCompleted = false;

    const enrollmentCall = createEnrollmentForUser(
      member.userId,
      seeded.classSessionId,
      { notes: null },
      {
        onTeacherLockAcquired: async () => {
          teacherLockAcquired = true;
          await releaseEnrollment.promise;
        },
      },
    );

    await waitUntil(() => teacherLockAcquired);

    const suspendCall = (async () => {
      suspendReachedUpdateStatement = true;
      await prisma.teacherProfile.update({
        where: { id: seeded.teacherProfileId },
        data: { status: "suspended" },
      });
      suspendCompleted = true;
    })();

    await waitUntil(() => suspendReachedUpdateStatement);
    await sleep(300);
    expect(suspendCompleted).toBe(false);

    releaseEnrollment.resolve();
    const [enrollmentResult] = await Promise.all([enrollmentCall, suspendCall]);

    expect(enrollmentResult.ok).toBe(true);
    if (!enrollmentResult.ok) throw new Error("unreachable");
    expect(enrollmentResult.status).toBe("confirmed");

    const teacherProfile = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: seeded.teacherProfileId },
      select: { status: true },
    });
    expect(teacherProfile.status).toBe("suspended");

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentResult.enrollmentId },
      select: { status: true },
    });
    expect(enrollment.status).toBe("confirmed");
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
