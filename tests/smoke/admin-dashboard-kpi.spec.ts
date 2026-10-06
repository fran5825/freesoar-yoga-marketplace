import { expect, test, type Page } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// admin-usability 第三批票 13：工作總覽 KPI 精準入口與「即將開始」課程條件。
const testEmailDomain = "admin-dashboard-kpi-smoke.local";
const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.demandRequest.deleteMany({ where: { organizerProfile: { user: { email: { in: createdEmails } } } } });
  await prisma.organizerProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.session.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

const inDays = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);

// 讀 KPI 卡片上的數字，再讀點進去的列表「全部」數量；共用資料庫可能被其他測試同時改動，所以用 poll 比對。
async function kpiValue(page: Page, label: string): Promise<number> {
  await page.goto("/admin/dashboard");
  const card = page.getByRole("link").filter({ has: page.getByText(label, { exact: true }) });
  return Number((await card.locator("p.text-3xl").textContent())?.trim());
}
async function listTabCount(page: Page, href: string, tabLabel: string): Promise<number> {
  await page.goto(href);
  const text = await page.getByRole("link", { name: new RegExp(`^${tabLabel}・\\d+$`) }).textContent();
  return Number(text?.split("・")[1]);
}

test("dashboard keeps pending work first and every KPI opens a list with exactly the same condition", async ({ context, page }, testInfo) => {
  // 長流程（多次換頁＋共用資料庫重試比對），高負載時超過預設 30 秒。
  test.slow();
  const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`);
  const adminEmail = `admin-${runId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${runId}@${testEmailDomain}`;
  createdEmails.push(adminEmail, teacherEmail);
  const teacherName = `KPI Teacher ${runId}`;
  const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: teacherName, status: "approved" });
  const makeClass = (label: string, status: "open_for_enrollment" | "draft" | "cancelled", startInDays: number) =>
    prisma.classSession.create({
      data: {
        title: `${label} ${runId}`, teacherProfileId: teacher.teacherProfileId, status, origin: "teacher_initiated",
        startAt: inDays(startInDays), endAt: inDays(startInDays, 1), location: "Taipei", capacity: 8,
      },
      select: { id: true },
    });
  // 只有「開放報名且尚未開始」算即將開始：已開始、草稿、已取消都不算。
  const upcoming = await makeClass("Upcoming", "open_for_enrollment", 6);
  await makeClass("Started", "open_for_enrollment", -1);
  await makeClass("Draft", "draft", 6);
  await makeClass("Cancelled", "cancelled", 6);

  await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);

  // 待你處理仍在最上方；KPI 卡片連到精準分類；已確認報名沒有連結。
  await page.goto("/admin/dashboard");
  const pendingTop = (await page.getByRole("heading", { name: "待你處理" }).boundingBox())!.y;
  const statsTop = (await page.getByRole("heading", { name: "數字概況" }).boundingBox())!.y;
  expect(pendingTop).toBeLessThan(statsTop);
  const card = (label: string) => page.getByRole("link").filter({ has: page.getByText(label, { exact: true }) });
  await expect(card("已通過的老師")).toHaveAttribute("href", "/admin/teachers?status=approved");
  await expect(card("已公開的需求")).toHaveAttribute("href", "/admin/demands?status=published");
  await expect(card("已媒合的需求")).toHaveAttribute("href", "/admin/demands?status=matched");
  await expect(card("即將開始的課程")).toHaveAttribute("href", "/admin/classes?when=upcoming");
  await expect(card("已確認的報名")).toHaveCount(0);
  await expect(page.getByText("已確認的報名", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-dashboard-kpi.png`, fullPage: true });

  // 數字與點進去的列表一致（同一時間點；其他測試可能同時改資料，所以重試比對）。
  for (const [label, href, tab] of [
    ["已通過的老師", "/admin/teachers?status=approved", "已通過"],
    ["已公開的需求", "/admin/demands?status=published", "已公開"],
    ["已媒合的需求", "/admin/demands?status=matched", "已媒合"],
    ["即將開始的課程", "/admin/classes?when=upcoming", "全部"],
  ] as const) {
    await expect.poll(async () => (await kpiValue(page, label)) - (await listTabCount(page, href, tab)), { timeout: 20_000 }).toBe(0);
  }

  // 鍵盤可以從 KPI 卡片進入列表。
  await page.goto("/admin/dashboard");
  await card("即將開始的課程").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/classes\?when=upcoming$/);
  await expect(page.getByText("只看即將開始的課程：開放報名中，且還沒到開始時間。")).toBeVisible();

  // 條件可與關鍵字、老師限定組合：只剩真正即將開始的那一堂。
  await page.getByRole("searchbox", { name: "搜尋課程" }).fill(runId);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("when") === "upcoming" && url.searchParams.get("q") === runId);
  await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Upcoming ${runId}`, exact: true })).toBeVisible();
  for (const hidden of ["Started", "Draft", "Cancelled"]) await expect(page.getByRole("heading", { name: `${hidden} ${runId}`, exact: true })).toHaveCount(0);
  await page.goto(`/admin/classes?when=upcoming&teacherProfileId=${teacher.teacherProfileId}`);
  await expect(page.getByText(`只看老師「${teacherName}」的課程`)).toBeVisible();
  await expect(page.getByText("只看即將開始的課程：開放報名中，且還沒到開始時間。")).toBeVisible();
  await expect(page.getByRole("link", { name: "全部・1" })).toBeVisible();
  // 切分類保留條件；清除這個條件只拿掉即將開始，保留老師限定。
  await page.getByRole("link", { name: "草稿・0" }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("when") === "upcoming" && url.searchParams.get("status") === "draft");
  await page.getByRole("link", { name: "清除這個條件" }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has("when") && url.searchParams.get("teacherProfileId") === teacher.teacherProfileId && url.searchParams.get("status") === "draft");
  await expect(page.getByRole("link", { name: "草稿・1" })).toBeVisible();

  // 從即將開始列表進課程、取消整堂，成功回到同一個條件的列表；重新整理不遺失。
  await page.goto(`/admin/classes?when=upcoming&q=${encodeURIComponent(runId)}`);
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: `Upcoming ${runId}`, exact: true }) }).click();
  await page.getByRole("button", { name: "取消課程", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消課程", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/classes" && url.searchParams.get("when") === "upcoming" && url.searchParams.get("q") === runId && url.searchParams.get("item") === upcoming.id);
  await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `查看 Upcoming ${runId}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("只看即將開始的課程：開放報名中，且還沒到開始時間。")).toBeVisible();
  await page.getByRole("link", { name: "清除全部條件", exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/classes$/);
});

test("the upcoming condition survives detail return, single-enrolment cancellation and partial clears together with other conditions", async ({ context, page }, testInfo) => {
  // 長流程（多次換頁＋共用資料庫重試比對），高負載時超過預設 30 秒。
  test.slow();
  const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-combo-${Date.now()}`);
  const adminEmail = `admin-combo-${runId}@${testEmailDomain}`;
  const teacherEmail = `teacher-combo-${runId}@${testEmailDomain}`;
  const memberEmail = `member-combo-${runId}@${testEmailDomain}`;
  createdEmails.push(adminEmail, teacherEmail, memberEmail);
  const teacherName = `Combo Teacher ${runId}`;
  const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: teacherName, status: "approved" });
  const title = `Combo Class ${runId}`;
  const classSession = await prisma.classSession.create({
    data: { title, teacherProfileId: teacher.teacherProfileId, status: "open_for_enrollment", origin: "teacher_initiated", startAt: inDays(4), endAt: inDays(4, 1), location: "Taipei", capacity: 8 },
    select: { id: true },
  });
  const { userId } = await createUserSession({ email: memberEmail });
  await prisma.enrollment.create({ data: { classSessionId: classSession.id, userId, status: "confirmed", consentedAt: new Date() } });
  await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);

  const upcomingNotice = page.getByText("只看即將開始的課程：開放報名中，且還沒到開始時間。");
  const teacherNotice = page.getByText(`只看老師「${teacherName}」的課程`);
  const hasAll = (url: URL) => url.searchParams.get("when") === "upcoming" && url.searchParams.get("teacherProfileId") === teacher.teacherProfileId && url.searchParams.get("q") === runId && url.searchParams.get("status") === "open";

  // 即將開始＋老師限定＋關鍵字＋開放中分類，全部同時成立。
  await page.goto(`/admin/classes?when=upcoming&teacherProfileId=${teacher.teacherProfileId}&status=open&q=${encodeURIComponent(runId)}`);
  await expect(upcomingNotice).toBeVisible();
  await expect(teacherNotice).toBeVisible();
  await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();

  // 進詳情 → 回列表：四個條件都在。
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
  await page.getByRole("link", { name: "← 回課程列表" }).click();
  await expect(page).toHaveURL(hasAll);

  // 詳情裡取消單筆報名（留在名單）→ 回列表：條件仍在。
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
  await page.getByRole("button", { name: "取消這筆報名" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page.getByText(/的報名，同一位學員不能再報名這堂課。$/)).toBeVisible();
  await page.getByRole("link", { name: "← 回課程列表" }).click();
  await expect(page).toHaveURL(hasAll);

  // 清除關鍵字：保留即將開始、老師限定與分類。
  await page.getByRole("link", { name: "清除關鍵字", exact: true }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q") && url.searchParams.get("when") === "upcoming" && url.searchParams.get("teacherProfileId") === teacher.teacherProfileId && url.searchParams.get("status") === "open");
  await expect(upcomingNotice).toBeVisible();
  await expect(teacherNotice).toBeVisible();

  // 解除限定：只拿掉老師限定，保留即將開始與分類。
  await page.getByRole("link", { name: "解除限定" }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has("teacherProfileId") && url.searchParams.get("when") === "upcoming" && url.searchParams.get("status") === "open");
  await expect(upcomingNotice).toBeVisible();
  await expect(teacherNotice).toHaveCount(0);
});

test("pending work lists the five oldest teacher applications and demands with exact totals, and KPI cards stack on mobile", async ({ context, page }, testInfo) => {
  // 長流程（多次換頁＋共用資料庫重試比對），高負載時超過預設 30 秒。
  test.slow();
  const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-pending-${Date.now()}`);
  const adminEmail = `admin-pending-${runId}@${testEmailDomain}`;
  createdEmails.push(adminEmail);

  // 六筆極舊的待審老師申請與需求：一定是全平台最久的，前 5 筆依最久優先，第 6 筆不顯示。
  const base = Date.UTC(2000, 0, 1) + testInfo.workerIndex * 86_400_000 * 30 + (testInfo.project.name.includes("mobile") ? 86_400_000 * 10 : 0);
  const teacherIds: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const email = `old-teacher-${index}-${runId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { teacherProfileId } = await createTeacherProfileWithSession({ email, displayName: `Old Teacher ${index} ${runId}`, status: "submitted" });
    await prisma.teacherProfile.update({ where: { id: teacherProfileId }, data: { updatedAt: new Date(base + index * 60_000) } });
    teacherIds.push(teacherProfileId);
  }
  const organizerEmail = `old-organizer-${runId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail);
  const organizer = await createOrganizerProfileWithOrganization({ email: organizerEmail, displayName: `Old Organizer ${runId}`, organizationName: `Old Org ${runId}`, organizationType: "community" });
  createdOrganizationIds.push(organizer.organizationId);
  const demandIds: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const demand = await prisma.demandRequest.create({
      data: { organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, title: `Old Demand ${index} ${runId}`, status: "submitted", updatedAt: new Date(base + index * 60_000) },
      select: { id: true },
    });
    demandIds.push(demand.id);
  }

  await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);
  const group = (title: string) => page.locator("div.grid").filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`^${title}・\\d+$`) }) });
  const hrefs = async (title: string) => (await group(title).getByRole("listitem").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href"))));

  for (const [title, ids, prefix, count] of [
    ["老師申請待審", teacherIds, "/admin/teachers/", () => prisma.teacherProfile.count({ where: { status: "submitted" } })],
    ["需求待審", demandIds, "/admin/demands/", () => prisma.demandRequest.count({ where: { status: "submitted" } })],
  ] as const) {
    await page.goto("/admin/dashboard");
    expect(await hrefs(title)).toEqual(ids.slice(0, 5).map((id) => `${prefix}${id}`));
    // 標題總數＝目前全平台待審數（共用資料庫可能同時變動，所以重試比對）。
    await expect.poll(async () => {
      await page.goto("/admin/dashboard");
      const heading = await group(title).getByRole("heading", { level: 3 }).textContent();
      return Number(heading?.split("・")[1]) - (await count());
    }, { timeout: 20_000 }).toBe(0);
  }

  // 手機（390px）KPI 卡片單欄：每張卡片左緣對齊、由上往下排。
  if ((page.viewportSize()?.width ?? 0) < 640) {
    const cards = page.locator("section").filter({ has: page.getByRole("heading", { name: "數字概況" }) }).locator("a, div.rounded-2xl");
    const boxes = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()).map((rect) => ({ x: Math.round(rect.x), y: Math.round(rect.y) })));
    expect(boxes.length).toBe(5);
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].x).toBe(boxes[0].x);
      expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y);
    }
  }
});
