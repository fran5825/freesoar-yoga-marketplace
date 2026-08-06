import { expect, test } from "@playwright/test";

import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { completeClassSessionForTeacher } from "../../src/domain/class-session/__internal__/complete-class-session-core-for-teacher";
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

const testEmailDomain = "teacher-initiated-open-classes-smoke.local";
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

const baseInput = {
  title: "自建課程測試",
  description: "測試用課程說明。",
  serviceType: "Hatha Yoga",
  location: "台北市信義區測試教室",
  capacity: 20,
  isPublic: true,
};

function normalizedInput(startAt: string, endAt: string) {
  const validation = validateClassSessionCreate({ ...baseInput, startAt, endAt });
  if (!validation.valid) throw new Error("unexpected invalid input in test fixture");
  return validation.normalized;
}

async function seedApprovedTeacher(testRunId: string) {
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail);
  return createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
}

// 建立一堂 Organizer 媒合、`selected` response 已就位的課程所需的完整前置資料，
// 回傳的 teacher 帶有 approved 狀態，可直接被拿來當作「這位老師已經有一堂媒合課程」的情境。
async function seedMatchedOrganizerContext(testRunId: string) {
  const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail);

  const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${testRunId}`,
    organizationName: `Org ${testRunId}`,
  });
  const teacher = await seedApprovedTeacher(testRunId);
  const demand = await createDemandRequest({
    organizerProfileId,
    organizationId,
    status: "matched",
    data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
  });
  await createDemandResponse({
    demandRequestId: demand.id,
    teacherProfileId: teacher.teacherProfileId,
    status: "selected",
  });

  return { organizerProfileId, demand, teacher };
}

test.describe("teacher-initiated open classes smoke", () => {
  test("lets an approved teacher create a single public class through the UI, view it with an origin badge, and cancel it", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-ui-create-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");

    await expect(page.getByRole("heading", { name: "建立課程" })).toBeVisible();

    await page.getByLabel("課程名稱").fill(baseInput.title);
    await page.getByLabel("課程類型").selectOption(baseInput.serviceType);
    await page.getByLabel("開始時間").fill("2026-09-10T14:00");
    await page.getByLabel("結束時間").fill("2026-09-10T15:00");
    await page.getByLabel("地點").fill(baseInput.location);
    await page.getByLabel("名額上限").fill(String(baseInput.capacity));
    await page.getByRole("checkbox", { name: "公開這堂課", exact: false }).check();
    await page.getByRole("checkbox", { name: /我確認以上資訊無誤/ }).check();
    await page.getByRole("button", { name: "建立課程" }).click();

    await expect(page.getByText("課程已建立。")).toBeVisible();
    await expect(page.getByText(baseInput.title)).toBeVisible();
    await expect(page.getByText("自己開的課", { exact: true })).toBeVisible();
    // 老師自建課程沒有團體，顯示中性 fallback，不是空白區塊。
    await expect(page.getByText("（自己開的課）")).toBeVisible();

    const created = await prisma.classSession.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title: baseInput.title },
      select: { id: true, origin: true, organizerProfileId: true, organizationId: true },
    });
    expect(created.origin).toBe("teacher_initiated");
    expect(created.organizerProfileId).toBeNull();
    expect(created.organizationId).toBeNull();

    await page.getByRole("button", { name: "取消課程" }).click();
    await expect(page.getByText("課程已取消。")).toBeVisible();
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();

    const afterCancel = await prisma.classSession.findUniqueOrThrow({
      where: { id: created.id },
      select: { status: true },
    });
    expect(afterCancel.status).toBe("cancelled");
  });

  test("gates /teacher/classes/new on teacher approval status: non-approved shows generic guidance, suspended shows a distinct message, neither shows the form", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-gating-${Date.now()}`,
    );

    for (const status of ["draft", "submitted", "rejected"] as const) {
      const email = `teacher-${status}-${testRunId}@${testEmailDomain}`;
      createdEmails.push(email);
      const teacher = await createTeacherProfileWithSession({
        email,
        displayName: `Teacher ${status} ${testRunId}`,
        status,
      });

      await addAuthSessionCookie(context, teacher.sessionToken);
      await page.goto("/teacher/classes/new");
      await expect(
        page.getByRole("heading", { name: "只有審核通過的老師才能建立課程" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "建立課程" })).toBeHidden();
      await context.clearCookies();
    }

    const suspendedEmail = `teacher-suspended-${testRunId}@${testEmailDomain}`;
    createdEmails.push(suspendedEmail);
    const suspended = await createTeacherProfileWithSession({
      email: suspendedEmail,
      displayName: `Teacher suspended ${testRunId}`,
      status: "suspended",
    });

    await addAuthSessionCookie(context, suspended.sessionToken);
    await page.goto("/teacher/classes/new");
    await expect(page.getByRole("heading", { name: "老師資格已暫停" })).toBeVisible();
    await expect(page.getByRole("button", { name: "建立課程" })).toBeHidden();
  });

  test("conflict-check blocks an overlapping teacher-initiated class against an existing organizer-matched class, blocks the reverse direction too, and lets non-overlapping times through both ways", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-conflict-${Date.now()}`,
    );

    // 方向一：老師已有一堂 Organizer 媒合課程，自建重疊時段被擋。
    const matched = await seedMatchedOrganizerContext(`${testRunId}-a`);
    const organizerInput = normalizedInput("2026-09-15T10:00", "2026-09-15T11:00");
    const createdOrganizerClass = await createClassSessionForOrganizer(
      matched.organizerProfileId,
      matched.demand.id,
      organizerInput,
    );
    expect(createdOrganizerClass.ok).toBe(true);

    const overlappingTeacherAttempt = await createClassSessionForTeacher(
      matched.teacher.teacherProfileId,
      normalizedInput("2026-09-15T10:30", "2026-09-15T11:30"),
    );
    expect(overlappingTeacherAttempt).toEqual({ ok: false, code: "teacher_schedule_conflict" });

    const nonOverlappingTeacherAttempt = await createClassSessionForTeacher(
      matched.teacher.teacherProfileId,
      normalizedInput("2026-09-15T12:00", "2026-09-15T13:00"),
    );
    expect(nonOverlappingTeacherAttempt.ok).toBe(true);

    // 方向二：老師已有一堂自建課程，Organizer 嘗試媒合出重疊時段被擋。
    const teacherB = await seedApprovedTeacher(`${testRunId}-b`);
    const teacherInitiated = await createClassSessionForTeacher(
      teacherB.teacherProfileId,
      normalizedInput("2026-09-16T10:00", "2026-09-16T11:00"),
    );
    expect(teacherInitiated.ok).toBe(true);

    const organizerBEmail = `organizer-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerBEmail);
    const { organizerProfileId: organizerBProfileId, organizationId: organizationBId } =
      await createOrganizerProfileWithOrganization({
        email: organizerBEmail,
        displayName: `Organizer B ${testRunId}`,
        organizationName: `Org B ${testRunId}`,
      });
    const demandB = await createDemandRequest({
      organizerProfileId: organizerBProfileId,
      organizationId: organizationBId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand B ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demandB.id,
      teacherProfileId: teacherB.teacherProfileId,
      status: "selected",
    });

    const overlappingOrganizerAttempt = await createClassSessionForOrganizer(
      organizerBProfileId,
      demandB.id,
      normalizedInput("2026-09-16T10:30", "2026-09-16T11:30"),
    );
    expect(overlappingOrganizerAttempt).toEqual({ ok: false, code: "teacher_schedule_conflict" });

    const nonOverlappingOrganizerAttempt = await createClassSessionForOrganizer(
      organizerBProfileId,
      demandB.id,
      normalizedInput("2026-09-16T12:00", "2026-09-16T13:00"),
    );
    expect(nonOverlappingOrganizerAttempt.ok).toBe(true);
  });

  // 比照既有 class-session-creation.spec.ts 的確定性鎖測試手法：用 conflict-check.ts 新增的
  // ConflictLockHooks 當同步點，證明第一個呼叫真的持有 TeacherProfile 鎖、第二個呼叫真的送出
  // 了同一句 FOR UPDATE 卻被擋住，而不是機率性的 Promise.all。
  test("concurrent teacher-initiated creation for the same teacher: FOR UPDATE deterministically blocks the second call, and exactly one succeeds", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const input = normalizedInput("2026-09-20T10:00", "2026-09-20T11:00");

    const releaseFirst = createDeferred<void>();
    let firstAcquired = false;
    let secondReachedLockStatement = false;
    let secondAcquired = false;

    const firstCall = createClassSessionForTeacher(teacher.teacherProfileId, input, {
      onLockAcquired: async () => {
        firstAcquired = true;
        await releaseFirst.promise;
      },
    });

    await waitUntil(() => firstAcquired);

    const secondCall = createClassSessionForTeacher(teacher.teacherProfileId, input, {
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
    expect(secondResult).toEqual({ ok: false, code: "teacher_schedule_conflict" });

    const classSessionCount = await prisma.classSession.count({
      where: { teacherProfileId: teacher.teacherProfileId },
    });
    expect(classSessionCount).toBe(1);
  });

  test("teacher can mark their own ended teacher-initiated class complete, and confirmed enrollees receive the same completion notification as organizer-matched classes", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-complete-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const created = await createClassSessionForTeacher(
      teacher.teacherProfileId,
      normalizedInput("2026-09-25T10:00", "2026-09-25T11:00"),
    );
    if (!created.ok) throw new Error("unexpected create failure in test fixture");

    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { userId: memberUserId } = await createUserSession({ email: memberEmail });
    await prisma.enrollment.create({
      data: {
        userId: memberUserId,
        classSessionId: created.classSessionId,
        status: "confirmed",
        consentedAt: new Date(),
      },
    });

    // 開放報名 → 補回過去時段，模擬「課程已結束」。
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: {
        status: "open_for_enrollment",
        startAt: new Date(Date.now() - 2 * 3600_000),
        endAt: new Date(Date.now() - 3600_000),
      },
    });

    const completeResult = await completeClassSessionForTeacher(
      teacher.teacherProfileId,
      created.classSessionId,
    );
    expect(completeResult).toEqual({ ok: true });

    const afterComplete = await prisma.classSession.findUniqueOrThrow({
      where: { id: created.classSessionId },
      select: { status: true },
    });
    expect(afterComplete.status).toBe("completed");

    const completionNotif = await prisma.notification.findFirst({
      where: { type: "class_session_completed", userId: memberUserId },
    });
    expect(completionNotif).not.toBeNull();
  });

  test("cancel/open-for-enrollment/complete action buttons only appear for teacher-initiated class sessions on /teacher/classes, not organizer-matched ones", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-scoped-buttons-${Date.now()}`,
    );
    const matched = await seedMatchedOrganizerContext(testRunId);
    const organizerClass = await createClassSessionForOrganizer(
      matched.organizerProfileId,
      matched.demand.id,
      normalizedInput("2026-09-28T10:00", "2026-09-28T11:00"),
    );
    if (!organizerClass.ok) throw new Error("unexpected create failure in test fixture");

    const teacherClass = await createClassSessionForTeacher(
      matched.teacher.teacherProfileId,
      normalizedInput("2026-09-29T10:00", "2026-09-29T11:00"),
    );
    if (!teacherClass.ok) throw new Error("unexpected create failure in test fixture");

    await addAuthSessionCookie(context, matched.teacher.sessionToken);
    await page.goto("/teacher/classes");

    const organizerCard = page.locator("article").filter({ hasText: "團主媒合" });
    await expect(organizerCard.getByRole("button", { name: "取消課程" })).toBeHidden();
    await expect(organizerCard.getByRole("button", { name: "開放報名" })).toBeHidden();

    const teacherCard = page.locator("article").filter({ hasText: "自己開的課" });
    await expect(teacherCard.getByRole("button", { name: "取消課程" })).toBeVisible();
  });

  test("null-safety: a teacher-initiated class session renders without throwing on admin list/detail and member/classes pages, showing neutral fallback text instead of a blank organization field", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-null-safety-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const created = await createClassSessionForTeacher(
      teacher.teacherProfileId,
      normalizedInput("2026-09-30T10:00", "2026-09-30T11:00"),
    );
    if (!created.ok) throw new Error("unexpected create failure in test fixture");

    // draft 課程對會員一律 404（D14 既有行為），開放報名後才能驗證 member 頁面的 null-safety。
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status: "open_for_enrollment" },
    });

    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });

    await addAuthSessionCookie(context, adminSessionToken);

    const listResponse = await page.goto("/admin/classes");
    expect(listResponse?.status()).toBe(200);
    await expect(page.getByText("（老師自建課程）").first()).toBeVisible();

    const detailResponse = await page.goto(`/admin/classes/${created.classSessionId}`);
    expect(detailResponse?.status()).toBe(200);
    await expect(page.getByText("（老師自建課程）").first()).toBeVisible();

    // Member-facing detail page（isPublic=true，未報名的已登入會員直連查看）也不能因為
    // organization 為 null 而拋錯，且要顯示中性 fallback 而不是空白區塊。
    const memberEmail = `member-view-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { sessionToken: memberSessionToken } = await createUserSession({ email: memberEmail });

    await context.clearCookies();
    await addAuthSessionCookie(context, memberSessionToken);
    const memberResponse = await page.goto(`/classes/${created.classSessionId}`);
    expect(memberResponse?.status()).toBe(200);
    await expect(page.getByText("老師自己開的課")).toBeVisible();
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
