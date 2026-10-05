import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// admin-usability 第三批票 10：需求／課程詳情之間的關聯入口。
const testEmailDomain = "admin-detail-links-smoke.local";
const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];

test.afterAll(async () => {
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

test("demand and class details link to each other, the teacher and the exact organization, without dead links", async ({ context, page }, testInfo) => {
  const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`);
  const emails = {
    admin: `admin-${runId}@${testEmailDomain}`,
    organizerA: `org-a-${runId}@${testEmailDomain}`,
    organizerB: `org-b-${runId}@${testEmailDomain}`,
    teacher: `teacher-${runId}@${testEmailDomain}`,
    draftTeacher: `draft-teacher-${runId}@${testEmailDomain}`,
  };
  createdEmails.push(...Object.values(emails));

  const orgName = `Linked Org ${runId}`;
  const a = await createOrganizerProfileWithOrganization({ email: emails.organizerA, displayName: `Organizer A ${runId}`, organizationName: orgName, organizationType: "community" });
  const b = await createOrganizerProfileWithOrganization({ email: emails.organizerB, displayName: `Organizer B ${runId}`, organizationName: orgName, organizationType: "community" });
  createdOrganizationIds.push(a.organizationId, b.organizationId);
  const teacherName = `Linked Teacher ${runId}`;
  const teacher = await createTeacherProfileWithSession({ email: emails.teacher, displayName: teacherName, status: "approved" });

  const demand = (title: string, status: "converted_to_class" | "published" | "draft", targetLevel: string | null = null) =>
    prisma.demandRequest.create({ data: { organizerProfileId: a.organizerProfileId, organizationId: a.organizationId, title, status, targetLevel }, select: { id: true } });
  const converted = await demand(`Converted ${runId}`, "converted_to_class");
  const published = await demand(`Published ${runId}`, "published");
  const hiddenLevel = `hidden-level-${runId}`;
  const draft = await demand(`Draft ${runId}`, "draft", hiddenLevel);

  const classSession = (title: string, options: { demandRequestId?: string; withOrganization: boolean; teacherProfileId?: string }) =>
    prisma.classSession.create({
      data: {
        title, teacherProfileId: options.teacherProfileId ?? teacher.teacherProfileId, status: "open_for_enrollment",
        demandRequestId: options.demandRequestId ?? null,
        organizerProfileId: options.withOrganization ? a.organizerProfileId : null,
        organizationId: options.withOrganization ? a.organizationId : null,
        origin: options.withOrganization ? "organizer_matched" : "teacher_initiated",
        startAt: inDays(9), endAt: inDays(9, 1), location: "Taipei", capacity: 8,
      },
      select: { id: true },
    });
  const matchedClassTitle = `Matched Class ${runId}`;
  const matchedClass = await classSession(matchedClassTitle, { demandRequestId: converted.id, withOrganization: true });
  const soloClass = await classSession(`Solo Class ${runId}`, { withOrganization: false });
  // 防守：課程若連到草稿需求（正常流程不會發生），也不能出現可點的來源需求。
  const draftLinkedClass = await classSession(`Draft Linked ${runId}`, { demandRequestId: draft.id, withOrganization: true });
  // 防守：草稿老師的課程（正常流程不會發生）不能露出老師姓名／email。
  const draftTeacherName = `Hidden Draft Teacher ${runId}`;
  const draftTeacher = await createTeacherProfileWithSession({ email: emails.draftTeacher, displayName: draftTeacherName, status: "draft" });
  const draftTeacherClass = await classSession(`Draft Teacher Class ${runId}`, { withOrganization: false, teacherProfileId: draftTeacher.teacherProfileId });

  const { sessionToken } = await createUserSession({ email: emails.admin, isAdmin: true });
  await addAuthSessionCookie(context, sessionToken);

  // 需求 → 課程。
  await page.goto(`/admin/demands/${converted.id}`);
  await page.getByRole("link", { name: `查看課程「${matchedClassTitle}」` }).click();
  await expect(page.getByRole("heading", { level: 1, name: matchedClassTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: "← 回課程列表" })).toHaveAttribute("href", "/admin/classes");

  // 課程 → 老師 → 回列表是老師列表預設（不建立跨類別返回）。
  const related = page.getByRole("region", { name: "相關資料" });
  await related.getByRole("link", { name: `查看老師「${teacherName}」` }).click();
  await expect(page.getByRole("heading", { level: 1, name: teacherName })).toBeVisible();
  await expect(page.getByRole("link", { name: "← 回老師列表" })).toHaveAttribute("href", "/admin/teachers");

  // 課程 → 來源需求。
  await page.goto(`/admin/classes/${matchedClass.id}`);
  await related.getByRole("link", { name: "查看來源需求" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/demands/${converted.id}`));
  await expect(page.getByRole("link", { name: "← 回需求列表" })).toHaveAttribute("href", "/admin/demands");

  // 課程 → 所屬團體：同名團體只出現所選那一個，可解除限定。
  await page.goto(`/admin/classes/${matchedClass.id}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-class-related.png`, fullPage: true });
  await related.getByRole("link", { name: `查看團體「${orgName}」` }).click();
  await expect(page.getByText(`只看團體「${orgName}」`, { exact: true })).toBeVisible();
  await expect(page.getByText("目前顯示：1 筆", { exact: true })).toBeVisible();
  await expect(page.getByText(`Organizer A ${runId}`)).toBeVisible();
  await expect(page.getByText(`Organizer B ${runId}`)).toHaveCount(0);
  await page.getByRole("searchbox", { name: "搜尋團體" }).fill(orgName);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "解除限定" }).click();
  await expect(page.getByText("搜尋結果：2 筆", { exact: true })).toBeVisible();

  // 已公開但沒有課程的需求：沒有課程連結。
  await page.goto(`/admin/demands/${published.id}`);
  await expect(page.getByRole("link", { name: /查看課程/ })).toHaveCount(0);

  // 老師開課：沒有來源需求、沒有所屬團體，只有中性文字。
  await page.goto(`/admin/classes/${soloClass.id}`);
  await expect(related.getByText("沒有來源需求", { exact: true })).toBeVisible();
  await expect(related.getByText("沒有所屬團體", { exact: true })).toBeVisible();
  await expect(related.getByRole("link")).toHaveCount(1);

  // 連到草稿需求的課程：不給來源需求連結。
  await page.goto(`/admin/classes/${draftLinkedClass.id}`);
  await expect(related.getByText("沒有來源需求", { exact: true })).toBeVisible();
  await expect(related.getByRole("link", { name: "查看來源需求" })).toHaveCount(0);
  await expect(page.getByText(hiddenLevel)).toHaveCount(0);

  await page.goto(`/admin/classes/${draftTeacherClass.id}`);
  await expect(page.getByText(draftTeacherName)).toHaveCount(0);
  await expect(page.getByText(emails.draftTeacher)).toHaveCount(0);
  await expect(related.getByText("老師資料無法查看", { exact: true })).toBeVisible();
  await expect(related.getByRole("link", { name: /查看老師/ })).toHaveCount(0);
  await page.goto(`/admin/classes?q=${encodeURIComponent(draftTeacherName)}`);
  await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();

  // 團體列表的限定 id 查無資料：只說找不到。
  await page.goto("/admin/organizations?organizationId=missing_org_id");
  await expect(page.getByText("找不到這個限定對象，可能已不存在。")).toBeVisible();
  await expect(page.getByText("沒有符合條件的團體。")).toBeVisible();
});
