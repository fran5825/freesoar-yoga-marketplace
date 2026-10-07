import { mkdirSync } from "node:fs";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// admin-usability 第四批票 14：整條管理後台工作路徑。每一步都截圖（給產品主人的驗收畫面集），
// 並在每張截圖時檢查沒有頁面橫向溢出。資料都由測試自己建立、測完清掉。
const testEmailDomain = "admin-journey-smoke.local";
const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];
const createdUserIds: string[] = [];

test.afterAll(async () => {
  const users = { OR: [{ email: { in: createdEmails } }, { id: { in: createdUserIds } }] };
  await prisma.enrollment.deleteMany({ where: { user: users } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
  await prisma.demandRequest.deleteMany({ where: { organizerProfile: { user: { email: { in: createdEmails } } } } });
  await prisma.organizerProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.notification.deleteMany({ where: { user: users } });
  await prisma.session.deleteMany({ where: { user: users } });
  await prisma.user.deleteMany({ where: users });
  await prisma.$disconnect();
});

const inDays = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
const runIdOf = (testInfo: TestInfo, tag: string) => normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${tag}-${Date.now()}`);
// 每個 project 用不同的「很久以前」時間，讓測試資料一定排在待審最前面。
const ancient = (testInfo: TestInfo, minute: number) => new Date(Date.UTC(1999, 0, 1) + (testInfo.project.name.includes("mobile") ? 86_400_000 : 0) + testInfo.workerIndex * 3_600_000 + minute * 60_000);

let step = 0;
async function shot(page: Page, testInfo: TestInfo, name: string, focus?: Locator) {
  if (focus) {
    // 確認視窗（<dialog>）在最上層、有開啟動畫：不要捲動它，等動畫結束再截圖。
    if (await focus.evaluate((element) => element.tagName === "DIALOG")) await page.waitForTimeout(400);
    else await focus.scrollIntoViewIfNeeded();
  }
  // 等畫面穩定後才量測；手機的 innerWidth 可能隨溢出內容變寬，不能拿它當通過基準。
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(250);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Journey screenshots require a configured viewport");
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document, `${name}：整頁不超出設定的 ${viewport.width}px`).toBeLessThanOrEqual(viewport.width + 1);
  expect(widths.body, `${name}：內容不超出設定的 ${viewport.width}px`).toBeLessThanOrEqual(viewport.width + 1);
  // 只看整頁寬度會漏掉「文字溢出自己的框」（框本身沒變寬，文字跑出去）：
  // 逐一檢查可見的文字元素，內容寬度不能超過元素本身，元素右緣也要在畫面內。
  const overflowing = await page.evaluate((viewportWidth) =>
    [...document.querySelectorAll("body h1, body h2, body h3, body p, body a, body dd, body li, body span, body label, body button")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") return false;
        // 刻意用「…」縮短的元素（例如全站頁首的帳號 email 小標）不算溢出。
        if (style.textOverflow === "ellipsis") return false;
        return element.scrollWidth > element.clientWidth + 1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 3)
      .map((element) => `${element.tagName.toLowerCase()}: ${(element.textContent ?? "").trim().slice(0, 40)}`),
    viewport.width,
  );
  expect(overflowing, `${name}：沒有文字超出自己的框或畫面右緣`).toEqual([]);
  const dir = `.ai-runs/admin-usability/batch4/${testInfo.project.name}`;
  mkdirSync(dir, { recursive: true });
  step += 1;
  const file = `${testInfo.title.slice(0, 2)}-${String(step).padStart(2, "0")}-${name}`;
  // 量測確認換頁後 scrollY 是 0、結果提示在畫面內，但 Chromium 手機模擬的「可視範圍」截圖會沿用換頁前的
  // 捲動位置。沒有指定焦點時改截整頁（從頁首開始，不受這個問題影響）；有焦點時截捲到該元素的可視範圍。
  await page.screenshot({ path: `${dir}/${file}.jpg`, type: "jpeg", quality: 70, fullPage: !focus });
}

async function signInAdmin(context: Parameters<typeof addAuthSessionCookie>[0], runId: string) {
  const email = `admin-${runId}@${testEmailDomain}`;
  createdEmails.push(email);
  await addAuthSessionCookie(context, (await createUserSession({ email, isAdmin: true })).sessionToken);
}

// 攔住 server action，檢查「送出中」狀態後才放行；回傳送出的次數與放行函式。
async function gateServerActions(page: Page) {
  const state = { count: 0, release: () => {} };
  const gate = new Promise<void>((resolve) => { state.release = resolve; });
  await page.route("**/admin/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      state.count += 1;
      await gate;
    }
    await route.continue();
  });
  return state;
}

async function seedTeacher(testInfo: TestInfo, runId: string, key: string, displayName: string, status: "submitted" | "approved", minute: number) {
  const email = `${key}-${runId}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({ email, displayName, status });
  await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { updatedAt: ancient(testInfo, minute) } });
  return { ...teacher, email, displayName };
}

async function seedOrganizer(runId: string, key: string, organizationName: string) {
  const email = `${key}-${runId}@${testEmailDomain}`;
  createdEmails.push(email);
  const organizer = await createOrganizerProfileWithOrganization({ email, displayName: `Organizer ${key} ${runId}`, organizationName, organizationType: "company", contactName: `Contact ${key}`, contactEmail: `contact-${key}-${runId}@example.com` });
  createdOrganizationIds.push(organizer.organizationId);
  return { ...organizer, email };
}

test("A1 teacher review: dashboard → read → approve; template reject with a too-short reason kept, then fixed", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a1");
  const approveMe = await seedTeacher(testInfo, runId, "t-approve", `Journey Approve ${runId}`, "submitted", 1);
  // 長、沒有空白的名稱：驗證會換行、不撐開畫面。
  const rejectMe = await seedTeacher(testInfo, runId, "t-reject", `JourneyReject${"x".repeat(60)}${runId}`, "submitted", 2);
  await signInAdmin(context, runId);

  await page.goto("/admin/dashboard");
  await shot(page, testInfo, "dashboard-pending");
  await page.getByRole("link", { name: new RegExp(`Journey Approve ${runId}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: approveMe.displayName })).toBeVisible();
  await shot(page, testInfo, "teacher-detail-summary");
  await page.getByRole("link", { name: "前往審核操作" }).click();
  await shot(page, testInfo, "teacher-review-actions", page.getByRole("button", { name: "通過申請" }));
  await page.getByRole("button", { name: "通過申請" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/teachers" && url.searchParams.get("result") === "success");
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "teacher-approved-flash");
  await page.getByRole("link", { name: `查看 ${approveMe.displayName}` }).click();
  await expect(page.getByText("已通過", { exact: true }).first()).toBeVisible();

  // 從老師列表搜尋 → 退回：範本帶入後改成太短，送出被擋且原因還在；改好後退回，回到同一個搜尋。
  await page.goto(`/admin/teachers?q=${encodeURIComponent(runId)}`);
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: rejectMe.displayName }) }).click();
  await page.getByRole("button", { name: "退回申請" }).click();
  await page.getByRole("button", { name: "教學經歷", exact: true }).click();
  const reason = page.getByLabel("退回原因");
  await expect(reason).toHaveValue(/教學年資/);
  await reason.fill("太短了");
  await page.getByRole("button", { name: "送出退回" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/teachers/${rejectMe.teacherProfileId}`));
  await expect(reason).toHaveValue("太短了");
  await shot(page, testInfo, "teacher-reject-too-short", reason);
  const longReason = `請補充帶領團課的實際經驗與教學年資，${"讓我們更了解你的教學背景。".repeat(6)}補充後歡迎重新送審。`;
  await reason.fill(longReason);
  await page.getByRole("button", { name: "送出退回" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/teachers" && url.searchParams.get("q") === runId && url.searchParams.get("result") === "success");
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "teacher-rejected-flash");
  await page.getByRole("link", { name: `查看 ${rejectMe.displayName}` }).click();
  await expect(page.getByText(longReason.slice(0, 20))).toBeVisible();
  await shot(page, testInfo, "teacher-rejected-detail");
});

test("A2 demand review: dashboard → publish; reject explains a new demand is needed", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a2");
  const organizer = await seedOrganizer(runId, "o-a2", `Journey Org ${runId}`);
  const make = async (title: string, minute: number) => {
    const demand = await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status: "submitted", data: completeDemandRequestData({ title }) });
    await prisma.demandRequest.update({ where: { id: demand.id }, data: { updatedAt: ancient(testInfo, minute) } });
    return { id: demand.id, title };
  };
  const publishMe = await make(`Journey Publish ${runId}`, 3);
  const rejectMe = await make(`Journey Reject ${runId}`, 4);
  await signInAdmin(context, runId);

  await page.goto("/admin/dashboard");
  await page.getByRole("link", { name: new RegExp(`Journey Publish ${runId}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: publishMe.title })).toBeVisible();
  await shot(page, testInfo, "demand-detail-summary");
  await page.getByRole("button", { name: "公開需求" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/demands" && url.searchParams.get("result") === "success");
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "demand-published-flash");

  await page.goto(`/admin/demands/${rejectMe.id}`);
  await page.getByRole("button", { name: "退回需求" }).click();
  await page.getByRole("button", { name: "說明不足", exact: true }).click();
  await expect(page.getByLabel("退回原因")).toHaveValue(/另建一筆需求/);
  await shot(page, testInfo, "demand-reject-template", page.getByLabel("退回原因"));
  await page.getByRole("button", { name: "送出退回" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/demands" && url.searchParams.get("result") === "success");
  await expect(page.getByText(/團主需另建一筆需求/)).toBeVisible();
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "demand-rejected-flash");
  await page.getByRole("link", { name: `查看 ${rejectMe.title}` }).click();
  await expect(page.getByText(/團主需要另建一筆需求送審/)).toBeVisible();
  await shot(page, testInfo, "demand-rejected-detail");
});

test("A3 teacher suspension and restoration with traceable results", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a3");
  const teacher = await seedTeacher(testInfo, runId, "t-suspend", `Journey Suspend ${runId}`, "approved", 5);
  await signInAdmin(context, runId);

  await page.goto(`/admin/teachers?status=approved&q=${encodeURIComponent(runId)}`);
  await shot(page, testInfo, "teachers-approved-search");
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: teacher.displayName }) }).click();
  await page.getByLabel("暫停原因").fill("近期多位學員反映上課時間不穩定，先暫停接新課，確認後再恢復。");
  await page.getByRole("button", { name: "暫停這位老師" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(teacher.displayName);
  await shot(page, testInfo, "suspend-confirm", dialog);
  await dialog.getByRole("button", { name: "確認暫停" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/teachers" && url.searchParams.get("status") === "approved" && url.searchParams.get("result") === "success");
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "suspended-flash");
  await page.getByRole("link", { name: `查看 ${teacher.displayName}` }).click();
  await expect(page.getByRole("button", { name: "恢復這位老師" })).toBeVisible();
  await page.getByRole("button", { name: "恢復這位老師" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/teachers" && url.searchParams.get("result") === "success");
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "restored-flash");
});

test("A4 history: converted demand → class → teacher → the teacher's classes", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a4");
  const organizer = await seedOrganizer(runId, "o-a4", `History Org ${runId}`);
  const teacher = await seedTeacher(testInfo, runId, "t-history", `History Teacher ${runId}`, "approved", 6);
  const demand = await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status: "converted_to_class", data: completeDemandRequestData({ title: `History Demand ${runId}` }) });
  const classTitle = `History Class ${runId}`;
  await prisma.classSession.create({
    data: { title: classTitle, teacherProfileId: teacher.teacherProfileId, demandRequestId: demand.id, organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, origin: "organizer_matched", status: "completed", startAt: inDays(-10), endAt: inDays(-10, 1), location: "Taipei", capacity: 10 },
  });
  await signInAdmin(context, runId);

  await page.goto(`/admin/demands?status=converted&q=${encodeURIComponent(runId)}`);
  await shot(page, testInfo, "demands-converted");
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: `History Demand ${runId}` }) }).click();
  await shot(page, testInfo, "demand-with-class-link", page.getByRole("link", { name: `查看課程「${classTitle}」` }));
  await page.getByRole("link", { name: `查看課程「${classTitle}」` }).click();
  await shot(page, testInfo, "class-related", page.getByRole("region", { name: "相關資料" }));
  await page.getByRole("region", { name: "相關資料" }).getByRole("link", { name: `查看老師「${teacher.displayName}」` }).click();
  await page.getByRole("link", { name: "這位老師的課程（1）" }).click();
  await expect(page.getByText(`只看老師「${teacher.displayName}」的課程`)).toBeVisible();
  await shot(page, testInfo, "teacher-classes-limited");
});

test("A5 organization → limited classes → roster: cancel pending and confirmed, then the whole class", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a5");
  // 兩個同名團體：卡片要能靠團主與聯絡 email 分辨。
  const orgName = `Same Name Org ${runId}`;
  const organizer = await seedOrganizer(runId, "o-a5", orgName);
  await seedOrganizer(runId, "o-a5-twin", orgName);
  const teacher = await seedTeacher(testInfo, runId, "t-roster", `Roster Teacher ${runId}`, "approved", 7);
  const demand = await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status: "converted_to_class", data: completeDemandRequestData({ title: `Roster Demand ${runId}` }) });
  const classTitle = `Roster Journey Class ${runId}`;
  const classSession = await prisma.classSession.create({
    data: { title: classTitle, teacherProfileId: teacher.teacherProfileId, demandRequestId: demand.id, organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, origin: "organizer_matched", status: "open_for_enrollment", requiresApproval: true, startAt: inDays(8), endAt: inDays(8, 1), location: "Taipei", capacity: 10 },
    select: { id: true },
  });
  const enrol = async (key: string, status: "pending" | "confirmed" | "attended") => {
    const email = `${key}.${"long".repeat(10)}-${runId}@${testEmailDomain}`;
    createdEmails.push(email);
    const user = await prisma.user.create({ data: { email, name: `${key} ${runId}` }, select: { id: true } });
    await prisma.enrollment.create({ data: { classSessionId: classSession.id, userId: user.id, status, consentedAt: new Date() } });
  };
  await enrol("Penny", "pending");
  await enrol("Connie", "confirmed");
  await enrol("Carl", "confirmed");
  await signInAdmin(context, runId);

  await page.goto(`/admin/organizations?q=${encodeURIComponent(orgName)}`);
  await expect(page.getByText("搜尋結果：2 筆", { exact: true })).toBeVisible();
  await shot(page, testInfo, "same-name-organizations");
  const card = page.locator("article").filter({ hasText: organizer.email });
  await card.getByRole("link", { name: "查看課程（1）" }).click();
  await expect(page.getByText(`只看團體「${orgName}」的課程`)).toBeVisible();
  await shot(page, testInfo, "organization-classes-limited");
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: classTitle }) }).click();
  await shot(page, testInfo, "class-summary");
  const roster = page.getByRole("region", { name: /報名名單/ });
  await shot(page, testInfo, "roster", roster);

  await roster.getByRole("searchbox", { name: "搜尋學員" }).fill("Penny");
  await roster.getByRole("button", { name: "搜尋學員" }).click();
  await roster.getByRole("link", { name: "待老師確認・1", exact: true }).click();
  await roster.getByRole("button", { name: "取消這筆報名" }).click();
  await shot(page, testInfo, "cancel-pending-confirm", page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page.getByText(`已取消「Penny ${runId}」的報名，同一位學員不能再報名這堂課。`)).toBeVisible();
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "cancel-pending-result");
  await page.getByRole("link", { name: `查看這筆（Penny ${runId}・已取消）` }).click();
  await shot(page, testInfo, "cancelled-row-located", roster);

  await page.goto(page.url().split("?")[0] + "?" + new URLSearchParams({ returnTo: new URL(page.url()).searchParams.get("returnTo") ?? "", rstatus: "confirmed", rq: "Connie" }));
  await roster.getByRole("button", { name: "取消這筆報名" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page.getByText(`已取消「Connie ${runId}」的報名，同一位學員不能再報名這堂課。`)).toBeVisible();

  await page.getByRole("link", { name: "前往取消操作" }).click();
  await page.getByRole("button", { name: "取消課程", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("目前 1 筆報名（含待老師確認）會一併取消");
  await shot(page, testInfo, "cancel-class-confirm", page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("button", { name: "確認取消課程" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/classes" && url.searchParams.get("organizationId") === organizer.organizationId && url.searchParams.get("result") === "success");
  await expect(page.locator("section[aria-live=\"polite\"]").first()).toBeInViewport();
  await shot(page, testInfo, "class-cancelled-back-to-limited-list");
});

test("A6 dashboard KPIs open their exact lists", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a6");
  await signInAdmin(context, runId);
  for (const [label, slug] of [["已通過的老師", "kpi-approved-teachers"], ["已公開的需求", "kpi-published-demands"], ["已媒合的需求", "kpi-matched-demands"], ["即將開始的課程", "kpi-upcoming-classes"]] as const) {
    await page.goto("/admin/dashboard");
    await page.getByRole("link").filter({ has: page.getByText(label, { exact: true }) }).click();
    await expect(page).toHaveURL(/\/admin\/(teachers|demands|classes)\?/);
    await shot(page, testInfo, slug);
  }
});

test("A7 every review and status action shows a processing state, blocks exclusive actions and sends exactly one request", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a7");
  const t1 = await seedTeacher(testInfo, runId, "t-dbl-approve", `Double Approve ${runId}`, "submitted", 8);
  const t2 = await seedTeacher(testInfo, runId, "t-dbl-reject", `Double Reject ${runId}`, "submitted", 9);
  const t3 = await seedTeacher(testInfo, runId, "t-dbl-suspend", `Double Suspend ${runId}`, "approved", 10);
  const organizer = await seedOrganizer(runId, "o-a7", `Double Org ${runId}`);
  const demand = async (title: string) => (await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status: "submitted", data: completeDemandRequestData({ title }) })).id;
  const d1 = await demand(`Double Publish ${runId}`);
  const d2 = await demand(`Double Reject Demand ${runId}`);
  await signInAdmin(context, runId);
  const validReason = "請補充帶領團課的實際經驗與教學年資，補充後歡迎重新送審。";

  type Case = { name: string; url: string; act: () => Promise<void>; pending: string; disabled: string[]; done: RegExp };
  const cases: Case[] = [
    { name: "teacher-approve", url: `/admin/teachers/${t1.teacherProfileId}`, act: () => page.getByRole("button", { name: "通過申請" }).click(), pending: "通過處理中…", disabled: ["退回申請"], done: /\/admin\/teachers\?/ },
    {
      name: "teacher-reject", url: `/admin/teachers/${t2.teacherProfileId}`,
      act: async () => { await page.getByRole("button", { name: "退回申請" }).click(); await page.getByLabel("退回原因").fill(validReason); await page.getByRole("button", { name: "送出退回" }).click(); },
      pending: "退回處理中…", disabled: ["通過申請"], done: /\/admin\/teachers\?/,
    },
    { name: "demand-publish", url: `/admin/demands/${d1}`, act: () => page.getByRole("button", { name: "公開需求" }).click(), pending: "公開處理中…", disabled: ["退回需求"], done: /\/admin\/demands\?/ },
    {
      name: "demand-reject", url: `/admin/demands/${d2}`,
      act: async () => { await page.getByRole("button", { name: "退回需求" }).click(); await page.getByLabel("退回原因").fill("請另建一筆需求，補充上課對象、人數與希望呈現的課程樣貌後送審。"); await page.getByRole("button", { name: "送出退回" }).click(); },
      pending: "退回處理中…", disabled: ["公開需求"], done: /\/admin\/demands\?/,
    },
    {
      name: "teacher-suspend", url: `/admin/teachers/${t3.teacherProfileId}`,
      act: async () => { await page.getByLabel("暫停原因").fill("近期多位學員反映上課時間不穩定，先暫停接新課。"); await page.getByRole("button", { name: "暫停這位老師" }).click(); await page.getByRole("dialog").getByRole("button", { name: "確認暫停" }).click(); },
      pending: "暫停處理中…", disabled: [], done: /\/admin\/teachers\?/,
    },
    { name: "teacher-restore", url: `/admin/teachers/${t3.teacherProfileId}`, act: () => page.getByRole("button", { name: "恢復這位老師" }).click(), pending: "恢復處理中…", disabled: [], done: /\/admin\/teachers\?/ },
  ];

  for (const testCase of cases) {
    await page.goto(testCase.url);
    const gate = await gateServerActions(page);
    await testCase.act();
    const processing = page.getByRole("button", { name: testCase.pending });
    await expect(processing, `${testCase.name}：處理中`).toBeDisabled();
    for (const other of testCase.disabled) await expect(page.getByRole("button", { name: other }), `${testCase.name}：互斥操作停用`).toBeDisabled();
    if (testCase.name === "teacher-approve") await shot(page, testInfo, "processing-state", processing);
    await processing.click({ force: true });
    await page.waitForTimeout(300);
    expect(gate.count, `${testCase.name}：只送出一次`).toBe(1);
    gate.release();
    await expect(page).toHaveURL(testCase.done);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
  expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: t3.teacherProfileId } })).status).toBe("approved");
});

test("A8 submitted list conditions survive a page refresh on every list and on the roster", async ({ context, page }, testInfo) => {
  test.slow();
  const runId = runIdOf(testInfo, "a8");
  const organizer = await seedOrganizer(runId, "o-a8", `Refresh Org ${runId}`);
  const teacher = await seedTeacher(testInfo, runId, "t-a8", `Refresh Teacher ${runId}`, "approved", 11);
  const demand = await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status: "converted_to_class", data: completeDemandRequestData({ title: `Refresh Demand ${runId}` }) });
  const classSession = await prisma.classSession.create({
    data: { title: `Refresh Class ${runId}`, teacherProfileId: teacher.teacherProfileId, demandRequestId: demand.id, organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, origin: "organizer_matched", status: "open_for_enrollment", startAt: inDays(5), endAt: inDays(5, 1), location: "Taipei", capacity: 10 },
    select: { id: true },
  });
  const memberEmail = `refresh-member-${runId}@${testEmailDomain}`;
  createdEmails.push(memberEmail);
  const { userId } = await createUserSession({ email: memberEmail });
  await prisma.enrollment.create({ data: { classSessionId: classSession.id, userId, status: "confirmed", consentedAt: new Date() } });
  await signInAdmin(context, runId);

  const checks: { url: string; search: string; notice?: string; tab: RegExp; count: string }[] = [
    { url: `/admin/teachers?status=approved&q=${encodeURIComponent(runId)}`, search: "搜尋老師", tab: /^已通過・1$/, count: "搜尋結果：1 筆" },
    { url: `/admin/demands?organizationId=${organizer.organizationId}&status=all&q=${encodeURIComponent(runId)}`, search: "搜尋需求", notice: `只看團體「Refresh Org ${runId}」的需求`, tab: /^全部・1$/, count: "搜尋結果：1 筆" },
    { url: `/admin/organizations?organizationId=${organizer.organizationId}&q=${encodeURIComponent(runId)}`, search: "搜尋團體", notice: `只看團體「Refresh Org ${runId}」`, tab: /^$/, count: "搜尋結果：1 筆" },
    { url: `/admin/classes?when=upcoming&teacherProfileId=${teacher.teacherProfileId}&status=open&q=${encodeURIComponent(runId)}`, search: "搜尋課程", notice: `只看老師「Refresh Teacher ${runId}」的課程`, tab: /^開放中・1$/, count: "搜尋結果：1 筆" },
  ];
  for (const check of checks) {
    await page.goto(check.url);
    const before = page.url();
    await page.reload();
    expect(page.url()).toBe(before);
    await expect(page.getByRole("searchbox", { name: check.search })).toHaveValue(runId);
    if (check.notice) await expect(page.getByText(check.notice, { exact: true })).toBeVisible();
    if (check.tab.source !== "^$") await expect(page.getByRole("link", { name: check.tab })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(check.count, { exact: true }).first()).toBeVisible();
  }
  await page.goto(`/admin/classes/${classSession.id}?rq=refresh-member&rstatus=confirmed`);
  await page.reload();
  const roster = page.getByRole("region", { name: /報名名單/ });
  await expect(roster.getByRole("searchbox", { name: "搜尋學員" })).toHaveValue("refresh-member");
  await expect(roster.getByRole("link", { name: "已報名・1", exact: true })).toHaveAttribute("aria-current", "page");
  await shot(page, testInfo, "roster-after-refresh", roster);
});

test("B1 same-name teachers can be distinguished by email in the list and opened by their own id", async ({ context, page }, testInfo) => {
  const runId = runIdOf(testInfo, "b1");
  const displayName = `Same Teacher ${runId}`;
  // 名稱、狀態、地區、年資與更新時間都相同，必須用既有帳號 email 分辨。
  const teachers = [
    await seedTeacher(testInfo, runId, "t-twin-alpha", displayName, "approved", 12),
    await seedTeacher(testInfo, runId, "t-twin-beta", displayName, "approved", 12),
  ];
  await signInAdmin(context, runId);
  const listUrl = `/admin/teachers?status=approved&q=${encodeURIComponent(runId)}`;
  await page.goto(listUrl);
  const cards = page.getByRole("link").filter({ has: page.getByRole("heading", { level: 2, name: displayName, exact: true }) });
  await expect(cards).toHaveCount(2);
  for (const teacher of teachers) {
    const card = cards.filter({ hasText: teacher.email });
    await expect(card.getByText(teacher.email, { exact: true })).toBeVisible();
    await expect(card).toHaveAttribute("href", new RegExp(`/admin/teachers/${teacher.teacherProfileId}\\?`));
  }
  await shot(page, testInfo, "same-name-teachers-with-emails");
  for (const teacher of teachers) {
    await page.goto(listUrl);
    await cards.filter({ hasText: teacher.email }).click();
    await expect(page).toHaveURL((url) => url.pathname === `/admin/teachers/${teacher.teacherProfileId}`);
    await expect(page.getByText(teacher.email, { exact: true })).toBeVisible();
    await shot(page, testInfo, teacher === teachers[0] ? "same-name-teacher-alpha-detail" : "same-name-teacher-beta-detail");
  }
});
