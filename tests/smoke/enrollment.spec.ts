import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { futureDateTime } from "./_helpers/future-dates";
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
    serviceType: "伸展與身體保養",
    startAt: futureDateTime(30, "14:00"),
    endAt: futureDateTime(30, "15:00"),
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
  test("cancelled classes keep own history without a broken detail link; own cancellation alone keeps the readable link", async ({ page, context }, testInfo) => {
    const run = normalizeForEmail(`${testInfo.project.name}-cancelled-history-${Date.now()}`);
    const cancelledClass = await seedClassSession({ testRunId: `${run}-class` });
    const cancelledOwn = await seedClassSession({ testRunId: `${run}-own` });
    const { userId, sessionToken } = await seedMember(run, "history");
    const first = await createEnrollmentForUser(userId, cancelledClass.classSessionId, { notes: null });
    const second = await createEnrollmentForUser(userId, cancelledOwn.classSessionId, { notes: null });
    if (!first.ok || !second.ok) throw new Error("unexpected enrollment failure");
    await prisma.classSession.update({ where: { id: cancelledClass.classSessionId }, data: { status: "cancelled" } });
    await prisma.enrollment.updateMany({ where: { id: { in: [first.enrollmentId, second.enrollmentId] } }, data: { status: "cancelled" } });
    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/member/enrollments");
    const history = page.locator(`#enrollment-${first.enrollmentId}`);
    await expect(history).toContainText("課程已取消");
    await expect(history).toContainText("Test Studio");
    await expect(history.getByRole("link")).toHaveCount(0);
    await expect(page.locator(`#enrollment-${second.enrollmentId}`).getByRole("link")).toHaveAttribute("href", `/classes/${cancelledOwn.classSessionId}`);
  });

  test("a suspended teacher's existing member detail remains readable but offers no enrollment form or internal status", async ({ page, context }, testInfo) => {
    const run = normalizeForEmail(`${testInfo.project.name}-safe-cta-${Date.now()}`);
    const { classSessionId } = await seedClassSession({ testRunId: run });
    const { sessionToken } = await seedMember(run, "safe");
    const course = await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId }, select: { teacherProfileId: true } });
    await prisma.teacherProfile.update({ where: { id: course.teacherProfileId }, data: { status: "suspended" } });
    await addAuthSessionCookie(context, sessionToken);
    expect((await page.goto(`/classes/${classSessionId}`))?.status()).toBe(200);
    await expect(page.getByText("目前不開放報名", { exact: true })).toBeVisible();
    await expect(page.getByLabel("備註（選填）")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "確認報名" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("suspended");
    await expect(page.locator("main")).not.toContainText(course.teacherProfileId);
  });

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

  test("class detail shows remaining seats, a success banner with a link to my enrollments, and hides the form once full", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-seats-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId, capacity: 3 });
    const { userId: otherMember } = await seedMember(testRunId, "other");
    const { sessionToken } = await seedMember(testRunId, "me");
    await createEnrollmentForUser(otherMember, classSessionId, { notes: null });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/classes/${classSessionId}`);
    await expect(page.getByText("開放報名", { exact: true })).toBeVisible();
    await expect(page.getByText("剩 2 個名額")).toBeVisible();

    await page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ }).check();
    await page.getByRole("button", { name: "確認報名" }).click();

    await expect(page.getByText("報名成功。")).toBeVisible();
    await expect(page.getByRole("link", { name: "查看我的報名" })).toHaveAttribute(
      "href",
      "/member/enrollments",
    );
    await expect(page.getByText("剩 1 個名額")).toBeVisible();

    const { classSessionId: fullClassId } = await seedClassSession({
      testRunId: `${testRunId}-full`,
      capacity: 1,
    });
    await createEnrollmentForUser(otherMember, fullClassId, { notes: null });
    await page.goto(`/classes/${fullClassId}`);
    await expect(page.getByText("已額滿", { exact: true })).toBeVisible();
    await expect(page.getByText("這堂課名額已滿")).toBeVisible();
    await expect(page.getByRole("button", { name: "確認報名" })).toHaveCount(0);
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
    await page.locator("form", { hasText: "確認報名" }).evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
    await page.getByRole("button", { name: "確認報名" }).click();

    await expect(page.getByText(/不可超過 500 個字/)).toBeVisible();

    const count = await prisma.enrollment.count({ where: { classSessionId } });
    expect(count).toBe(0);

    // 未勾選 basicConsent 也要被伺服器端擋下（同一頁重新整理，繞過前端 required）。
    await page.goto(`/classes/${classSessionId}`);
    await page.getByLabel("備註（選填）").fill("正常長度的備註");
    await page.locator("form", { hasText: "確認報名" }).evaluate((form: HTMLFormElement) => {
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
    // 課程還沒開始時先打開取消表單，送出前才把課程改成已開始——模擬「頁面開著時課程開始了」，
    // 證明就算畫面還看得到按鈕，伺服器端仍會擋下（課程開始後畫面本來就不會顯示取消）。
    const { classSessionId } = await seedClassSession({ testRunId });
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
    await prisma.classSession.update({
      where: { id: classSessionId },
      data: { startAt: new Date("2020-01-01T00:00:00Z") },
    });
    await page.getByRole("button", { name: "確認取消" }).click();

    await expect(page.getByText("這堂課程已經開始，無法取消報名。")).toBeVisible();
    // 重新載入後，已開始的課不再顯示取消入口（我的報名與課程詳情都一樣）。
    await expect(page.getByText("取消報名…")).toHaveCount(0);
    await page.goto(`/classes/${classSessionId}`);
    await expect(page.getByText("取消報名…")).toHaveCount(0);

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
    await expect(page.getByText("目前沒有待處理事項")).toBeVisible();
    await expect(page.getByRole("link", { name: "去找一堂課" })).toHaveAttribute(
      "href",
      "/classes",
    );
  });

  test("a member can cancel from the class detail page with a clear no-re-enroll warning, and cannot cancel someone else's enrollment by tampering with the form", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-detail-cancel-${Date.now()}`,
    );
    const { classSessionId } = await seedClassSession({ testRunId, capacity: 3 });
    const { userId: otherId } = await seedMember(testRunId, "other");
    const { userId: meId, sessionToken } = await seedMember(testRunId, "me");
    const other = await createEnrollmentForUser(otherId, classSessionId, { notes: null });
    const mine = await createEnrollmentForUser(meId, classSessionId, { notes: null });
    if (!other.ok || !mine.ok) throw new Error("unexpected enrollment failure");

    await addAuthSessionCookie(context, sessionToken);

    // 竄改隱藏欄位，改成別人的報名 id：伺服器只會找自己的報名，所以取消不了。
    await page.goto(`/classes/${classSessionId}`);
    await page.getByText("取消報名…").click();
    await page
      .locator('input[name="enrollmentId"]')
      .evaluate((el: HTMLInputElement, id: string) => {
        el.value = id;
      }, other.enrollmentId);
    await page.getByRole("checkbox", { name: "我確認要取消這則報名。" }).check();
    await page.getByRole("button", { name: "確認取消" }).click();
    await expect(page.getByText("報名已取消。")).toBeHidden();
    expect(
      (await prisma.enrollment.findUniqueOrThrow({ where: { id: other.enrollmentId } })).status,
    ).toBe("confirmed");
    expect(
      (await prisma.enrollment.findUniqueOrThrow({ where: { id: mine.enrollmentId } })).status,
    ).toBe("confirmed");

    // 正常取消：留在同一堂課的詳情頁，看得到警語與結果，名額也釋出。
    await page.goto(`/classes/${classSessionId}`);
    await expect(page.getByText("剩 1 個名額")).toBeVisible();
    await page.getByText("取消報名…").click();
    await expect(page.getByText("取消後無法再次報名此課程。")).toBeVisible();
    await page.getByRole("checkbox", { name: "我確認要取消這則報名。" }).check();
    await page.getByRole("button", { name: "確認取消" }).click();

    await expect(page).toHaveURL(new RegExp(`/classes/${classSessionId}\\?result=success`));
    await expect(page.getByText("報名已取消。")).toBeVisible();
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();
    await expect(page.getByText("剩 2 個名額")).toBeVisible();
    await expect(page.getByText("取消報名…")).toHaveCount(0);

    // 「我的報名」狀態一致。
    await page.goto("/member/enrollments");
    await expect(page.locator(`#enrollment-${mine.enrollmentId}`)).toContainText("已取消");
  });

  test("my enrollments lists what needs attention (pending, review not yet left), groups upcoming vs past, and the whole card links to the class", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-todo-${Date.now()}`,
    );
    const { classSessionId: pendingClassId } = await seedClassSession({
      testRunId: `${testRunId}-p`,
    });
    const { classSessionId: doneClassId } = await seedClassSession({
      testRunId: `${testRunId}-d`,
    });
    const { userId, sessionToken } = await seedMember(testRunId, "me");

    const pending = await createEnrollmentForUser(userId, pendingClassId, { notes: null });
    const done = await createEnrollmentForUser(userId, doneClassId, { notes: null });
    if (!pending.ok || !done.ok) throw new Error("unexpected enrollment failure");

    await prisma.enrollment.update({ where: { id: pending.enrollmentId }, data: { status: "pending" } });
    await prisma.classSession.update({
      where: { id: doneClassId },
      data: {
        status: "completed",
        startAt: new Date(Date.now() - 3 * 24 * 3600_000),
        endAt: new Date(Date.now() - 3 * 24 * 3600_000 + 3600_000),
      },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/member/enrollments");

    const todo = page.getByRole("region", { name: "待你處理" });
    await expect(todo).toContainText("待評價");
    await expect(todo).toContainText(`Class ${testRunId}-d`);
    await expect(todo).not.toContainText(`Class ${testRunId}-p`);
    const waiting = page.getByRole("region", { name: "等待老師確認" });
    await expect(waiting).toContainText("等老師確認");
    await expect(waiting).toContainText(`Class ${testRunId}-p`);
    await expect(page.getByText("目前沒有待處理事項")).toBeHidden();
    await expect(page.getByRole("heading", { name: "即將上課" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "過去與已取消" })).toBeVisible();

    // 整張卡都可點：點卡片左上角空白處也會進到課程詳情。
    await page
      .locator(`#enrollment-${pending.enrollmentId}`)
      .click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(new RegExp(`/classes/${pendingClassId}$`));

    // 留下評價後，該筆從「待你處理」消失。
    await page.goto("/member/enrollments");
    await page
      .locator(`#enrollment-${done.enrollmentId}`)
      .getByText("留下評價…")
      .click();
    await page.locator(`#rating-${done.enrollmentId}`).selectOption("5");
    await page.getByRole("button", { name: "送出評價" }).click();
    await expect(page.getByRole("region", { name: "待你處理" })).not.toContainText("待評價");
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
    // teacher-usability-redesign 票 04：我的課程預設只列「即將上課」，看全部要切到「全部」分頁。
    await page.goto("/teacher/classes?tab=all");
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
