import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { createDemandResponse, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 14：兩條開團路徑的完整旅程驗收（桌機 1280、手機 390 兩個 project 都跑）。
// - 直接開團：還不是團主的人從入口選「我已有合作老師」→ 一頁建立團主資料 → 安排課程並邀請 →
//   老師在總覽確認 → 團主在總覽開放報名 → 複製連結 → 學員未登入看到登入引導、登入後報名。
// - 找老師：已公開的需求收到回應 → 總覽待你處理 → 選老師 → 成立課程（預填）→ 開放報名 → 學員報名。
// 每一步留截圖在 .ai-runs/organizer-journeys/（不進版控）作為驗收證據。
const testEmailDomain = "organizer-journeys-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: emails } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.demandResponse.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: TestInfo, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

function taipeiLocal(daysFromNow: number, time: string): string {
  const date = new Date(Date.now() + daysFromNow * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return `${parts}T${time}`;
}

async function evidence(page: Page, testInfo: TestInfo, journey: string, step: string) {
  // 每一步都確認沒有水平捲動，再留整頁截圖。
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${step} 不應出現水平捲動`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `.ai-runs/organizer-journeys/${testInfo.project.name}/${journey}-${step}.png`, fullPage: true });
}

async function newTeacher(id: string, label: string) {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({ email, displayName: `旅程老師${label} ${id}`, status: "approved" });
}

async function enrolViaLink(browser: import("@playwright/test").Browser, testInfo: TestInfo, journey: string, link: string, title: string, id: string) {
  const memberEmail = `member-${journey}-${id}@${testEmailDomain}`;
  createdEmails.push(memberEmail);
  const member = await createUserSession({ email: memberEmail });
  const context = await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined });
  const page = await context.newPage();
  // 未登入：只看到通用登入引導（不透露課名）。
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "登入後查看這堂課" })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  await evidence(page, testInfo, journey, "08-member-sign-in-guide");
  // 登入後回到同一個連結並報名。
  await addAuthSessionCookie(context, member.sessionToken);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
  await page.getByRole("button", { name: "確認報名" }).click();
  await expect(page.getByText("報名成功。")).toBeVisible();
  await evidence(page, testInfo, journey, "09-member-enrolled");
  await context.close();
  return member;
}

test.describe("organizer journeys", () => {
  // 完整旅程會走過十多頁，給比預設 30 秒長的時限。
  test.setTimeout(150_000);

  test("direct class: entry → first-time profile → invite → teacher confirms → open → share → member enrols", async ({ browser, context, page }, testInfo) => {
    const id = runId(testInfo, "direct");
    const teacher = await newTeacher(id, "D");
    const email = `new-organizer-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const newcomer = await createUserSession({ email });
    await addAuthSessionCookie(context, newcomer.sessionToken);

    await page.goto("/organizers/request");
    await evidence(page, testInfo, "direct", "01-entry");
    await page.getByRole("link", { name: /我已有合作老師/ }).click();
    await page.getByLabel("團主顯示名稱").fill(`旅程團主 ${id}`);
    await page.getByLabel("組織名稱").fill(`旅程團體 ${id}`);
    await page.getByLabel("組織類型").selectOption("company");
    await page.getByLabel("聯絡電話").fill("0912345678");
    await evidence(page, testInfo, "direct", "02-first-profile");
    await page.getByRole("button", { name: "建立團主資料並繼續安排課程" }).click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/new$/);

    const title = `旅程直接開團 ${id}`;
    await page.getByPlaceholder("輸入老師的顯示名稱").fill(`旅程老師D ${id}`);
    await page.getByRole("button", { name: "搜尋老師" }).click();
    await page.getByRole("list", { name: "可邀請的老師" }).getByRole("button", { name: new RegExp(`旅程老師D ${id}`) }).click();
    await page.getByLabel("課程名稱").fill(title);
    await page.getByText("伸展與身體保養", { exact: true }).click();
    await page.getByLabel("開始時間").fill(taipeiLocal(25, "19:00"));
    await page.getByLabel("結束時間").fill(taipeiLocal(25, "20:30"));
    await page.getByLabel("地點").fill("台北市信義區松仁路 100 號");
    await page.getByLabel("名額").fill("20");
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);
    const proposalId = page.url().match(/class-proposals\/([^/]+)\/edit$/)?.[1] as string;
    await evidence(page, testInfo, "direct", "03-proposal-draft");
    await page.getByRole("button", { name: "送出邀請" }).first().click();
    await page.getByRole("button", { name: "確認送出邀請" }).first().click();
    await expect(page.getByText("邀請已送出，老師確認後你就能開放報名。")).toBeVisible();
    await page.goto("/organizer/dashboard");
    await expect(page.getByRole("region", { name: "等待對方回覆" })).toContainText(title);
    await evidence(page, testInfo, "direct", "04-organizer-waiting");

    // 老師：從總覽的待辦進入並確認。
    const teacherContext = await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined });
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/teacher/dashboard");
    await evidence(teacherPage, testInfo, "direct", "05-teacher-todo");
    await teacherPage.getByRole("region", { name: "待你處理" }).getByRole("link", { name: new RegExp(title) }).click();
    await expect(teacherPage).toHaveURL(new RegExp(`/teacher/class-proposals/${proposalId}$`));
    await teacherPage.getByRole("button", { name: "確認授課" }).click();
    await teacherPage.getByRole("button", { name: "確認授課" }).click();
    await expect(teacherPage.getByText(/你已確認授課/)).toBeVisible();
    await teacherContext.close();

    // 團主：總覽待辦 → 開放報名 → 複製完整連結。
    await page.goto("/organizer/dashboard");
    await page.getByRole("region", { name: "待你處理" }).getByRole("link", { name: new RegExp(title) }).click();
    await page.getByRole("button", { name: "開放報名" }).click();
    await page.getByRole("button", { name: "確認開放報名" }).click();
    await expect(page).toHaveURL(/\/organizer\/classes\/[^/?]+\?flash=opened$/);
    await expect(page.getByText("已開放報名，現在可以把課程連結分享給團員。")).toBeVisible();
    // 分享是開放後的主要動作：桌機與手機的第一屏都看得到複製按鈕。
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole("button", { name: "複製報名連結" })).toBeInViewport();
    const link = await page.getByLabel("報名連結", { exact: true }).inputValue();
    expect(link).toMatch(/^https?:\/\/[^/]+\/classes\/[^/]+$/);
    await evidence(page, testInfo, "direct", "06-opened-share");

    await enrolViaLink(browser, testInfo, "direct", link, title, id);
    await page.reload();
    await expect(page.locator("#roster")).toContainText("已報名會員（1 人）");
    await evidence(page, testInfo, "direct", "10-roster");
  });

  test("find a teacher: response arrives → dashboard todo → select teacher → create class (prefilled) → open → share → member enrols", async ({ browser, context, page }, testInfo) => {
    const id = runId(testInfo, "find");
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `找老師團主 ${id}`,
      organizationName: `找老師團體 ${id}`,
      contactName: "聯絡人",
      contactEmail: `contact-${id}@example.com`,
      contactPhone: "0900000000",
    });
    const teacher = await newTeacher(id, "F");
    const title = `旅程找老師 ${id}`;
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "published",
      data: completeDemandRequestData({ title, expectedParticipants: 16, preferredAreas: ["台北市大安區復興南路 1 號"] }),
    });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/dashboard");
    const todo = page.getByRole("region", { name: "待你處理" }).getByRole("link", { name: new RegExp(title) });
    await expect(todo).toContainText("1 位老師已回應：請選擇合作的老師");
    await evidence(page, testInfo, "find", "01-dashboard-todo");
    await todo.click();
    await page.getByRole("region", { name: "下一步提示" }).getByRole("link", { name: "查看老師回應" }).click();
    const response = page.locator("li", { hasText: `旅程老師F ${id}` });
    await response.getByText("選定這位老師…").click();
    await response.getByRole("checkbox", { name: "我確認要選定這位老師。" }).check();
    await response.getByRole("button", { name: "確認選定" }).click();
    await expect(page.getByText("已選定這位老師。")).toBeVisible();
    await evidence(page, testInfo, "find", "02-selected");

    await page.getByRole("region", { name: "下一步提示" }).getByRole("link", { name: "填寫課程資訊" }).click();
    const form = page.locator("#create-class");
    await expect(form.getByLabel("地點")).toHaveValue("台北市大安區復興南路 1 號");
    await expect(form.getByLabel("名額上限")).toHaveValue("16");
    await form.getByLabel("開始時間").fill(taipeiLocal(26, "19:00"));
    await form.getByLabel("結束時間").fill(taipeiLocal(26, "20:00"));
    await form.getByRole("checkbox", { name: "我確認以上資訊無誤，同意建立課程。" }).check();
    await evidence(page, testInfo, "find", "03-create-class");
    await form.getByRole("button", { name: "建立課程" }).click();
    await expect(page).toHaveURL(/\/organizer\/classes\/[^/?]+/);
    await expect(page.getByRole("link", { name: "查看來源需求" })).toHaveAttribute("href", `/organizer/demands/${demand.id}`);

    await page.getByRole("checkbox", { name: "我確認要開放這堂課程的報名。" }).check();
    await page.getByRole("button", { name: "開放報名" }).click();
    await expect(page.getByText("已開放報名。")).toBeVisible();
    const link = await page.getByLabel("報名連結", { exact: true }).inputValue();
    await evidence(page, testInfo, "find", "06-opened-share");

    await enrolViaLink(browser, testInfo, "find", link, title, id);

    // 需求詳情的下一步直接連到這堂課。
    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(page.getByRole("region", { name: "下一步提示" }).getByRole("link", { name: "前往這堂課" })).toHaveAttribute(
      "href",
      new URL(link).pathname.replace("/classes/", "/organizer/classes/"),
    );
    await evidence(page, testInfo, "find", "10-demand-links-class");
  });
});
