import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { cleanupDemandResponseFixtures, createDemandResponse, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import { futureDateTime } from "./_helpers/future-dates";
import { addAuthSessionCookie, completeDemandRequestData, createDemandRequest, createOrganizerProfileWithOrganization, createUserSession, normalizeForEmail, prisma } from "./_helpers/organizer-demand-fixtures";

// 票 06：驗收實際 UI 狀態轉換；fixtures 只建立課程／帳號，不預設本人報名狀態。
const domain = "member-journey-acceptance-smoke.local";
const emails: string[] = [];
const emailFor = (role: string, run: string) => {
  const email = `${role}-${run}@${domain}`;
  emails.push(email);
  return email;
};
const runId = (info: TestInfo, label: string) => normalizeForEmail(`${info.project.name}-${label}-${Date.now()}`);

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: { in: emails } } } } });
  await cleanupDemandResponseFixtures(emails);
  await prisma.$disconnect();
});

async function seedCourse(run: string, origin: "organizer" | "teacher", requiresApproval = false) {
  const teacher = await createTeacherProfileWithSession({ email: emailFor("teacher", run), displayName: `Teacher ${run}`, status: "approved" });
  const title = `覺察與舒展 ${run} ${"溫柔感受身體的節奏".repeat(4)}`;
  const location = `信義區 ${run} ${"場地地址與入口說明".repeat(15)}`;
  const validation = validateClassSessionCreate({ title: `Journey ${run}`, description: "帶著覺察練習。".repeat(285), serviceType: "伸展與身體保養", startAt: futureDateTime(30, "18:00"), endAt: futureDateTime(30, "19:00"), location: `Studio ${run}`, capacity: 5, isPublic: true });
  if (!validation.valid) throw new Error("invalid journey fixture");
  let created;
  if (origin === "organizer") {
    const organizer = await createOrganizerProfileWithOrganization({ email: emailFor("organizer", run), displayName: `Organizer ${run}`, organizationName: `Org ${run}` });
    const demand = await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status: "matched", data: completeDemandRequestData({ title: `Demand ${run}` }) });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId, status: "selected" });
    created = await createClassSessionForOrganizer(organizer.organizerProfileId, demand.id, validation.normalized);
  } else {
    created = await createClassSessionForTeacher(teacher.teacherProfileId, { ...validation.normalized, requiresApproval });
  }
  if (!created.ok) throw new Error(`journey fixture create failed: ${created.code}`);
  await prisma.classSession.update({ where: { id: created.classSessionId }, data: { status: "open_for_enrollment", title, location } });
  return { id: created.classSessionId, title, location, teacherSessionToken: teacher.sessionToken };
}

async function keyboardReach(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let index = 0; index < 100; index++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("keyboard could not reach the intended control after 100 Tab presses");
}
async function keyboardActivate(page: Page, target: Locator) {
  // 手機導覽要先由鍵盤開選單；不透過 focus() 或 click() 跳過使用者操作。
  if (!(await target.isVisible()) && await page.getByRole("button", { name: "選單", exact: true }).isVisible()) {
    await keyboardReach(page, page.getByRole("button", { name: "選單", exact: true }));
    await page.keyboard.press("Enter");
  }
  await keyboardReach(page, target);
  await page.keyboard.press("Enter");
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}
function upcoming(page: Page) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "即將上課", exact: true }) });
}

for (const origin of ["organizer", "teacher"] as const) {
  test(`${origin} class: keyboard journey from discovery through confirmed enrollment, dashboard and cancellation`, async ({ page, context }, info) => {
    info.setTimeout(90_000);
    const run = runId(info, origin);
    const course = await seedCourse(run, origin);
    const member = await createUserSession({ email: emailFor("member", run) });
    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes?location=${encodeURIComponent(run)}&timeOfDay=evening`);
    for (const width of [375, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await screenshot(page, info, `${origin}-list-${width}`);
    }
    await keyboardActivate(page, page.getByRole("link", { name: new RegExp(course.title) }));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(course.title);
    for (const width of [1280, 375, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await screenshot(page, info, `${origin}-detail-${width}`);
    }
    const returnTo = await page.getByRole("link", { name: "返回課程列表", exact: true }).getAttribute("href");
    expect(returnTo).toContain(`location=${encodeURIComponent(run)}`);
    const notes = page.getByLabel("備註（選填）");
    await keyboardReach(page, notes);
    await page.keyboard.type(`keyboard-${run}`);
    const consent = page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ });
    await expect(consent).not.toBeChecked();
    await keyboardReach(page, consent);
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
    const submit = page.getByRole("button", { name: "確認報名", exact: true });
    await keyboardReach(page, submit);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    // 放大後仍透過鍵盤重新到達按鈕，讓 viewport 證據包含實際送出控制項。
    await page.keyboard.press("Shift+Tab");
    await keyboardReach(page, submit);
    await expect(submit).toBeFocused();
    await screenshot(page, info, `${origin}-text-200-percent`);
    await page.screenshot({ path: info.outputPath(`${origin}-text-200-percent-viewport.png`) });
    await page.keyboard.press("Enter");
    await expect(page.locator('section[aria-live="polite"]')).toBeVisible();
    await expect(page.locator('section[aria-live="polite"]')).toContainText("報名成功。");
    await expect(page.getByRole("region", { name: "你的報名狀態" })).toContainText("已報名");
    const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { classSessionId_userId: { classSessionId: course.id, userId: member.userId } } });
    expect(enrollment.status).toBe("confirmed");
    expect(enrollment.consentedAt).not.toBeNull();
    await keyboardActivate(page, page.getByRole("link", { name: "我的報名", exact: true }));
    const card = page.locator(`#enrollment-${enrollment.id}`);
    await expect(card).toContainText("已報名");
    await screenshot(page, info, `${origin}-own-enrollments`);
    await keyboardActivate(page, page.getByRole("link", { name: "總覽", exact: true }));
    await expect(upcoming(page)).toContainText(course.title);
    await screenshot(page, info, `${origin}-dashboard`);
    await keyboardActivate(page, upcoming(page).getByRole("link", { name: new RegExp(course.title) }));
    await keyboardActivate(page, page.getByText("取消報名…", { exact: true }));
    await keyboardReach(page, page.getByRole("checkbox", { name: "我確認要取消這則報名。" }));
    await page.keyboard.press("Space");
    await keyboardActivate(page, page.getByRole("button", { name: "確認取消", exact: true }));
    await expect(page.locator('section[aria-live="polite"]')).toBeVisible();
    await expect(page.locator('section[aria-live="polite"]')).toContainText("報名已取消。");
    await expect(page.getByRole("region", { name: "你的報名狀態" })).toContainText("已取消");
    await expect(page.getByRole("region", { name: "你的報名狀態" })).toContainText("可以重新報名");
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).status).toBe("cancelled");
    await screenshot(page, info, `${origin}-cancelled`);
    await keyboardActivate(page, page.getByRole("link", { name: "我的報名", exact: true }));
    await expect(card).toContainText("已取消");
  });
}

test("pending UI enrollment accepted by the teacher updates member detail, enrollment history and upcoming classes", async ({ page, context }, info) => {
  info.setTimeout(90_000);
  const run = runId(info, "pending");
  const course = await seedCourse(run, "teacher", true);
  const member = await createUserSession({ email: emailFor("member", run) });
  await addAuthSessionCookie(context, member.sessionToken);
  await page.goto(`/classes?location=${encodeURIComponent(run)}`);
  await page.getByRole("link", { name: new RegExp(course.title) }).click();
  await page.getByLabel("備註（選填）").fill(`pending-${run}`);
  await page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ }).check();
  await page.getByRole("button", { name: "送出報名申請" }).click();
  await expect(page.getByRole("region", { name: "你的報名狀態" })).toContainText("等待老師確認");
  const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { classSessionId_userId: { classSessionId: course.id, userId: member.userId } } });
  expect(enrollment.status).toBe("pending");
  await screenshot(page, info, "pending-detail");
  await page.goto("/member/enrollments");
  await expect(page.locator(`#enrollment-${enrollment.id}`)).toContainText("等待老師確認");
  await screenshot(page, info, "pending-enrollments");
  await page.goto("/member/dashboard");
  await expect(page.getByRole("heading", { name: "等待老師確認", exact: true })).toBeVisible();
  await expect(upcoming(page)).not.toContainText(course.title);
  await screenshot(page, info, "pending-dashboard");
  await context.clearCookies();
  await addAuthSessionCookie(context, course.teacherSessionToken);
  await page.goto(`/teacher/classes/${course.id}`);
  await page.locator("li").filter({ hasText: `pending-${run}` }).getByRole("button", { name: "確認報名" }).click();
  await expect(page.getByText("已確認這筆報名。", { exact: true })).toBeVisible();
  expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).status).toBe("confirmed");
  await context.clearCookies();
  await addAuthSessionCookie(context, member.sessionToken);
  await page.goto(`/classes/${course.id}`);
  await expect(page.getByRole("region", { name: "你的報名狀態" })).toContainText("已報名");
  await expect(page.getByRole("region", { name: "你的報名狀態" })).not.toContainText("等待老師確認");
  await screenshot(page, info, "accepted-detail");
  await page.goto("/member/enrollments");
  await expect(page.locator(`#enrollment-${enrollment.id}`)).toContainText("已報名");
  await screenshot(page, info, "accepted-enrollments");
  await page.goto("/member/dashboard");
  await expect(upcoming(page)).toContainText(course.title);
  await expect(page.getByRole("heading", { name: "等待老師確認", exact: true })).toHaveCount(0);
  await screenshot(page, info, "accepted-dashboard");
});

test("empty discovery, invalid dates and member empty state have a visible exit", async ({ page, context }, info) => {
  const run = runId(info, "empty");
  await page.goto(`/classes?location=${encodeURIComponent(run)}`);
  await expect(page.getByRole("heading", { name: "目前沒有符合條件的公開課程" })).toBeVisible();
  const emptyResult = page.locator("section").filter({ has: page.getByRole("heading", { name: "目前沒有符合條件的公開課程" }) });
  await expect(emptyResult.getByRole("link", { name: "清除篩選" })).toHaveAttribute("href", "/classes");
  await screenshot(page, info, "empty-discovery");
  await page.goto("/classes?dateRange=custom&dateFrom=2099-02-01&dateTo=2099-01-01");
  await expect(page.getByRole("region", { name: "篩選課程" }).getByRole("alert")).toContainText("結束日期不能早於開始日期");
  await screenshot(page, info, "invalid-dates");
  const member = await createUserSession({ email: emailFor("member", run) });
  await addAuthSessionCookie(context, member.sessionToken);
  await page.goto("/member/dashboard");
  await expect(page.getByText("目前沒有任何報名。報名後的課程會顯示在這裡。", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "去找一堂課" })).toHaveAttribute("href", "/classes");
  await screenshot(page, info, "empty-member-dashboard");
});
