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
  test("searches class participants and location, preserves roster context and returns to filtered list after class cancellation", async ({ context, page }, testInfo) => {
    const runId = normalizeForEmail(`${testInfo.project.name}-search-${Date.now()}`);
    const seeded = await seedClassSession({ testRunId: runId, status: "open_for_enrollment", startAtOffsetMs: 86400_000 });
    await seedConfirmedEnrollment(runId, "search", seeded.classSessionId);
    const adminEmail = `admin-search-${runId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);
    for (const keyword of [`Class ${runId}`, `Teacher ${runId}`, `Organizer ${runId}`, `Org ${runId}`, "Test Studio"]) {
      await page.goto(`/admin/classes?status=open&q=${encodeURIComponent(keyword)}`);
      await expect(page.getByRole("heading", { level: 2, name: `Class ${runId}`, exact: true })).toBeVisible();
    }
    await page.getByRole("searchbox", { name: "搜尋課程" }).fill(runId);
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-classes.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: `Class ${runId}`, exact: true }) }).click();
    await page.getByRole("link", { name: "← 回課程列表" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue(runId);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: `Class ${runId}`, exact: true }) }).click();
    await page.getByRole("button", { name: "取消這筆報名", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消報名", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === `/admin/classes/${seeded.classSessionId}` && url.searchParams.has("returnTo"));
    await expect(page.getByText(/^已取消「.+」的報名，同一位學員不能再報名這堂課。$/)).toBeVisible();
    await page.getByRole("button", { name: "取消課程", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消課程", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/classes" && url.searchParams.get("q") === runId && url.searchParams.get("status") === "open" && url.searchParams.get("result") === "success");
    await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `查看 Class ${runId}`, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Class ${runId}`, exact: true })).toBeVisible();
  });
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
    await expect(page).toHaveURL((url) => url.pathname === `/admin/classes/${openSession.classSessionId}` && url.searchParams.get("returnTo") === "/admin/classes?status=open");
    await expect(page.getByRole("link", { name: "← 回課程列表" })).toHaveAttribute(
      "href",
      "/admin/classes?status=open",
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

    // 確認視窗：顯示學員與課程、不可恢復與不可重報；按「返回」或 Esc 都不會取消，焦點回到觸發按鈕。
    const rowATrigger = rowA.getByRole("button", { name: "取消這筆報名" });
    await rowATrigger.click();
    const dialog = page.getByRole("dialog", { name: new RegExp(`確定要取消「.*e2e-a.*」的報名嗎？`) });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`課程：Class ${testRunId}`);
    await expect(dialog).toContainText("同一位學員也不能再報名這堂課");
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-enrollment-cancel-confirm.png`, fullPage: true });
    await dialog.getByRole("button", { name: "返回" }).click();
    await expect(dialog).toBeHidden();
    await expect(rowATrigger).toBeFocused();
    await expect(page.getByText("報名名單（2 人）")).toBeVisible();

    await rowATrigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(rowATrigger).toBeFocused();
    await expect(page.getByText("報名名單（2 人）")).toBeVisible();

    await rowATrigger.click();
    await dialog.getByRole("button", { name: "確認取消報名" }).click();

    // 單筆取消成功留在同一課程名單，結果指出學員。
    await expect(page.getByText(/^已取消「.*e2e-a.*」的報名，同一位學員不能再報名這堂課。$/)).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === `/admin/classes/${seeded.classSessionId}`);

    // 整堂取消確認顯示課程名稱與連帶取消的報名數（剩 1 筆有效報名）。
    await page.getByRole("button", { name: "取消課程", exact: true }).click();
    const classDialog = page.getByRole("dialog", { name: `確定要取消「Class ${testRunId}」嗎？` });
    await expect(classDialog).toContainText("目前 1 筆報名（含待老師確認）會一併取消");
    await expect(classDialog).toContainText("無法復原");
    await classDialog.getByRole("button", { name: "確認取消課程" }).click();

    await expect(page.getByText("課程已取消，已報名學員的報名也一併取消。")).toBeVisible();
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

  test("when eligibility changed meanwhile, cancellation fails with the object and next step, the page refreshes, and remaining buttons still work", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-stale-${Date.now()}`,
    );
    const seeded = await seedClassSession({ testRunId, status: "open_for_enrollment", startAtOffsetMs: 3600_000 });
    const enrollmentA = await seedConfirmedEnrollment(testRunId, "stale-a", seeded.classSessionId);
    await seedConfirmedEnrollment(testRunId, "stale-b", seeded.classSessionId);
    const adminEmail = `admin-stale-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);

    await page.goto(`/admin/classes/${seeded.classSessionId}`);
    const rowA = page.locator("li", { hasText: `member-stale-a-${testRunId}` });
    const rowB = page.locator("li", { hasText: `member-stale-b-${testRunId}` });
    await expect(rowA.getByRole("button", { name: "取消這筆報名" })).toBeEnabled();

    // 別人先取消了 A：送出後由 server 依當下狀態擋下，提示學員、原因與下一步，畫面換成最新狀態。
    await prisma.enrollment.update({ where: { id: enrollmentA.enrollmentId }, data: { status: "cancelled" } });
    await rowA.getByRole("button", { name: "取消這筆報名" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
    await expect(page.getByText(/「.*stale-a.*」的報名沒有取消：.*畫面已更新為目前狀態，請確認後再操作。/)).toBeVisible();
    await expect(rowA.getByRole("button", { name: "取消這筆報名" })).toHaveCount(0);
    // 失敗後其他取消操作沒有被永久停用。
    await expect(rowB.getByRole("button", { name: "取消這筆報名" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "取消課程", exact: true })).toBeEnabled();

    // 課程在這段期間已開始：整堂取消被擋下，取消區塊消失，不再提供無效操作。
    await prisma.classSession.update({
      where: { id: seeded.classSessionId },
      data: { startAt: new Date(Date.now() - 60_000), endAt: new Date(Date.now() + 3600_000) },
    });
    await page.getByRole("button", { name: "取消課程", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消課程" }).click();
    await expect(page.getByText(/^課程沒有取消：.*畫面已更新為目前狀態，請確認後再操作。$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "取消課程", exact: true })).toHaveCount(0);
    await expect(rowB.getByRole("button", { name: "取消這筆報名" })).toHaveCount(0);
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: seeded.classSessionId } })).status).toBe("open_for_enrollment");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("after a failure the same cancel button is enabled again and a retry succeeds, for one enrollment and for the whole class", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-retry-${Date.now()}`,
    );
    const seeded = await seedClassSession({ testRunId, status: "open_for_enrollment", startAtOffsetMs: 3600_000 });
    await seedConfirmedEnrollment(testRunId, "retry-a", seeded.classSessionId);
    const adminEmail = `admin-retry-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);
    await page.goto(`/admin/classes/${seeded.classSessionId}`);

    // 單筆：讓第一次送出失敗，但這筆報名仍可取消，所以同一顆按鈕要留下、解除停用並能重試成功。
    const row = page.locator("li", { hasText: `member-retry-a-${testRunId}` });
    const rowTrigger = row.getByRole("button", { name: "取消這筆報名" });
    await expect(rowTrigger).toBeEnabled();
    // 這一列同時有「標記已收款」與「取消這筆報名」兩個表單（lightweight-payment-v0），只竄改取消表單的欄位。
    await row.locator("form", { has: page.getByRole("button", { name: "取消這筆報名" }) }).locator('input[name="enrollmentId"]').evaluate((el: HTMLInputElement) => { el.value = "does-not-exist"; });
    await rowTrigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
    // 第三批票 12：學員名稱改由頁面依 item 對照名單補上；item 被竄改成不存在的報名時，只顯示通用文字。
    await expect(page.getByText(/^這筆報名沒有取消：/)).toBeVisible();
    await expect(rowTrigger).toBeEnabled();
    await rowTrigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
    await expect(page.getByText(/^已取消「.*retry-a.*」的報名，同一位學員不能再報名這堂課。$/)).toBeVisible();

    // 整堂：第一次送出被 server 擋下（確認欄位不符），同一顆按鈕解除停用，重試成功回課程列表。
    const classTrigger = page.getByRole("button", { name: "取消課程", exact: true });
    await page.locator('input[name="confirmCancel"]').last().evaluate((el: HTMLInputElement) => { el.value = "no"; });
    await classTrigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消課程" }).click();
    await expect(page.getByText(/請先勾選確認，才能取消這堂課程。/)).toBeVisible();
    await expect(classTrigger).toBeEnabled();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: seeded.classSessionId } })).status).toBe("open_for_enrollment");
    await classTrigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消課程" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/classes" && url.searchParams.get("result") === "success");
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: seeded.classSessionId } })).status).toBe("cancelled");
  });

  test("while a cancellation is in flight the button shows a processing state, stays disabled, and only one request is sent", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-pending-${Date.now()}`,
    );
    const seeded = await seedClassSession({ testRunId, status: "open_for_enrollment", startAtOffsetMs: 3600_000 });
    await seedConfirmedEnrollment(testRunId, "pending-a", seeded.classSessionId);
    const adminEmail = `admin-pending-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);
    await page.goto(`/admin/classes/${seeded.classSessionId}`);
    const row = page.locator("li", { hasText: `member-pending-a-${testRunId}` });
    await expect(row.getByRole("button", { name: "取消這筆報名" })).toBeEnabled();

    // 攔住 server action 請求，延到檢查完處理中狀態才放行。
    let actionRequests = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/admin/classes/**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        actionRequests += 1;
        await gate;
      }
      await route.continue();
    });

    await row.getByRole("button", { name: "取消這筆報名" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
    const processing = row.getByRole("button", { name: "取消處理中…" });
    await expect(processing).toBeDisabled();
    await processing.click({ force: true });
    await processing.evaluate((el: HTMLButtonElement) => el.click());
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(actionRequests).toBe(1);

    release();
    await expect(page.getByText(/^已取消「.*pending-a.*」的報名，同一位學員不能再報名這堂課。$/)).toBeVisible();
    expect(actionRequests).toBe(1);
    await page.unroute("**/admin/classes/**");
  });
});
