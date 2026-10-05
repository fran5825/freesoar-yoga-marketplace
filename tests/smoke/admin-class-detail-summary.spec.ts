import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// admin-usability 第三批票 11：課程詳情摘要優先與完整課程資料。
const testEmailDomain = "admin-class-detail-summary-smoke.local";
const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.demandRequest.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.organizerProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.session.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

const inDays = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);

test("class detail leads with time, place, teacher, origin and a full-roster enrolment summary, then course content", async ({ context, page }, testInfo) => {
  const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`);
  const adminEmail = `admin-${runId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${runId}@${testEmailDomain}`;
  const organizerEmail = `organizer-${runId}@${testEmailDomain}`;
  createdEmails.push(adminEmail, teacherEmail, organizerEmail);

  const teacherName = `Summary Teacher ${runId}`;
  const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: teacherName, status: "approved" });

  // 老師開課：多個課程風格、瑜伽類型、需老師確認、公開。
  const teacherClass = await prisma.classSession.create({
    data: {
      title: `Teacher Class ${runId}`, teacherProfileId: teacher.teacherProfileId, status: "open_for_enrollment",
      origin: "teacher_initiated", requiresApproval: true, isPublic: true,
      serviceType: "哈達", serviceTypes: ["哈達", "陰瑜伽"], yogaStyles: [`Hatha ${runId}`, `Yin ${runId}`],
      // 長說明：含沒有空白的長字串，驗證會換行、不撐開手機版面。
      description: `${"這堂課帶大家慢慢暖身、調整呼吸，再進入站姿與平衡練習。".repeat(8)}${"x".repeat(160)}`,
      startAt: inDays(7), endAt: inDays(7, 1), location: `Studio ${runId}`, capacity: 10,
    },
    select: { id: true },
  });
  // 名單：2 已報名、1 待老師確認、1 已取消。摘要用完整名單，已取消不佔名額。
  for (const [index, status] of (["confirmed", "confirmed", "pending", "cancelled"] as const).entries()) {
    const email = `member-${index}-${runId}@${testEmailDomain}`;
    createdEmails.push(email);
    const { userId } = await createUserSession({ email });
    await prisma.enrollment.create({ data: { classSessionId: teacherClass.id, userId, status, consentedAt: new Date() } });
  }

  // 舊資料／團主團課：只有單一 serviceType、serviceTypes 為空、直接報名、不公開。
  const organizer = await createOrganizerProfileWithOrganization({ email: organizerEmail, displayName: `Organizer ${runId}`, organizationName: `Org ${runId}`, organizationType: "company" });
  createdOrganizationIds.push(organizer.organizationId);
  const demand = await prisma.demandRequest.create({
    data: { organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, title: `Demand ${runId}`, status: "converted_to_class", targetLevel: "beginner" },
    select: { id: true },
  });
  const legacyClass = await prisma.classSession.create({
    data: {
      title: `Legacy Class ${runId}`, teacherProfileId: teacher.teacherProfileId, status: "completed",
      origin: "organizer_matched", demandRequestId: demand.id,
      organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId,
      requiresApproval: false, isPublic: false, serviceType: `伸展 ${runId}`, serviceTypes: [],
      startAt: inDays(-3), endAt: inDays(-3, 1), location: "Taipei", capacity: 6,
    },
    select: { id: true },
  });

  const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
  await addAuthSessionCookie(context, sessionToken);

  await page.goto(`/admin/classes/${teacherClass.id}`);
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  // 首屏（還沒捲動前）就看得到：課程名稱、狀態、時間與報名摘要；整頁沒有橫向溢出。
  await expect(page.getByRole("heading", { level: 1, name: `Teacher Class ${runId}` })).toBeInViewport();
  await expect(header.getByText("開放報名", { exact: true })).toBeInViewport();
  await expect(header.getByText(/ – /)).toBeInViewport();
  await expect(header.getByText(/已報名 2 人・待老師確認 1 人/)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(header).toContainText(`Studio ${runId}`);
  await expect(header).toContainText(teacherName);
  await expect(header).toContainText("老師開課");
  await expect(header).toContainText("已報名 2 人・待老師確認 1 人・名額佔用 3／10");
  await expect(header).toContainText("已報名與待老師確認都會佔用名額。");

  const content = page.getByRole("region", { name: "課程內容" });
  await expect(content).toContainText("哈達、陰瑜伽");
  await expect(content).toContainText(`Hatha ${runId}、Yin ${runId}`);
  await expect(content.getByText("需老師確認", { exact: true })).toBeVisible();
  await expect(content.getByText("公開", { exact: true })).toBeVisible();

  // 順序：摘要 → 課程內容 → 團主、老師與團體 → 相關資料 → 名單 → 取消。
  const top = async (name: string) => (await page.getByRole("heading", { level: 2, name }).boundingBox())!.y;
  const order = [await top("課程內容"), await top("團主、老師與團體"), await top("相關資料"), await top("報名名單（4 人）"), await top("取消課程")];
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  // 有合法取消時，摘要提供頁內跳轉。
  await expect(page.getByRole("link", { name: "前往取消操作" })).toHaveAttribute("href", "#class-actions");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-class-summary.png`, fullPage: true });
  await page.getByRole("link", { name: "前往取消操作" }).click();
  await expect(page.getByRole("button", { name: "取消課程", exact: true })).toBeInViewport();

  // 舊資料：課程風格退回單一 serviceType；直接報名、不公開、團主媒合；已結束的課沒有取消入口。
  await page.goto(`/admin/classes/${legacyClass.id}`);
  await expect(header).toContainText("團主媒合");
  await expect(header).toContainText("已報名 0 人・待老師確認 0 人・名額佔用 0／6");
  await expect(content).toContainText(`伸展 ${runId}`);
  await expect(content.getByText("直接報名", { exact: true })).toBeVisible();
  await expect(content.getByText("不公開", { exact: true })).toBeVisible();
  await expect(content.getByText("公開", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "前往取消操作" })).toHaveCount(0);
});
