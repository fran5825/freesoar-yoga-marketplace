import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// admin-usability 第三批票 09：團體→需求／課程、老師→課程的關聯限定列表。
const testEmailDomain = "admin-related-lists-smoke.local";
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

test.describe("admin related lists", () => {
  test("non-admin cannot read a relation-limited list", async ({ context, page }, testInfo) => {
    const email = `non-admin-${normalizeForEmail(`${testInfo.project.name}-${Date.now()}`)}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email, isAdmin: false });
    await addAuthSessionCookie(context, sessionToken);

    expect((await page.goto("/admin/demands?organizationId=someorg&status=all"))?.status()).toBe(404);
    expect((await page.goto("/admin/classes?teacherProfileId=someteacher"))?.status()).toBe(404);
  });

  test("organization and teacher links open id-exact lists that combine with search, status and return", async ({ context, page }, testInfo) => {
    const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`);
    const emails = {
      admin: `admin-${runId}@${testEmailDomain}`,
      organizerA: `org-a-${runId}@${testEmailDomain}`,
      organizerB: `org-b-${runId}@${testEmailDomain}`,
      teacher: `teacher-${runId}@${testEmailDomain}`,
      teacherTwin: `teacher-twin-${runId}@${testEmailDomain}`,
    };
    createdEmails.push(...Object.values(emails));

    // 兩個同名團體、兩位同名老師：限定一定要靠 id，不能靠名稱。
    const orgName = `Same Org ${runId}`;
    const teacherName = `Same Teacher ${runId}`;
    const a = await createOrganizerProfileWithOrganization({ email: emails.organizerA, displayName: `Organizer A ${runId}`, organizationName: orgName, organizationType: "community" });
    const b = await createOrganizerProfileWithOrganization({ email: emails.organizerB, displayName: `Organizer B ${runId}`, organizationName: orgName, organizationType: "community" });
    createdOrganizationIds.push(a.organizationId, b.organizationId);

    const demand = (organizer: typeof a, title: string, status: "submitted" | "published" | "draft") =>
      prisma.demandRequest.create({ data: { organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, title, status }, select: { id: true } });
    await demand(a, `A Pending ${runId}`, "submitted");
    await demand(a, `A Published ${runId}`, "published");
    await demand(a, `A Draft ${runId}`, "draft");
    await demand(b, `B Pending ${runId}`, "submitted");

    const teacher = await createTeacherProfileWithSession({ email: emails.teacher, displayName: teacherName, status: "approved" });
    const twin = await createTeacherProfileWithSession({ email: emails.teacherTwin, displayName: teacherName, status: "approved" });
    const classSession = (title: string, teacherProfileId: string, organizer: typeof a | null, status: "open_for_enrollment" | "draft") =>
      prisma.classSession.create({
        data: {
          title, teacherProfileId, status,
          organizerProfileId: organizer?.organizerProfileId ?? null,
          organizationId: organizer?.organizationId ?? null,
          origin: organizer ? "organizer_matched" : "teacher_initiated",
          startAt: inDays(10), endAt: inDays(10, 1), location: "Taipei", capacity: 10,
        },
      });
    await classSession(`Class A Teacher ${runId}`, teacher.teacherProfileId, a, "open_for_enrollment");
    await classSession(`Class B Twin ${runId}`, twin.teacherProfileId, b, "open_for_enrollment");
    await classSession(`Class Solo Teacher ${runId}`, teacher.teacherProfileId, null, "draft");

    const { sessionToken } = await createUserSession({ email: emails.admin, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    // 團體卡片：需求數只算非草稿，點進去「全部」數量一致；同名團體只看自己的。
    await page.goto(`/admin/organizations?q=${encodeURIComponent(orgName)}`);
    const cardA = page.locator("article").filter({ hasText: `Organizer A ${runId}` });
    await expect(cardA.getByRole("link", { name: "查看課程（1）" })).toBeVisible();
    await cardA.getByRole("link", { name: "查看需求（2）" }).click();
    await expect(page).toHaveURL(new RegExp(`organizationId=${a.organizationId}`));
    await expect(page.getByText(`只看團體「${orgName}」的需求`)).toBeVisible();
    await expect(page.getByRole("link", { name: "全部・2" })).toBeVisible();
    await expect(page.getByText(`A Pending ${runId}`)).toBeVisible();
    await expect(page.getByText(`A Published ${runId}`)).toBeVisible();
    await expect(page.getByText(`B Pending ${runId}`)).toHaveCount(0);
    await expect(page.getByText(`A Draft ${runId}`)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-related-demands.png`, fullPage: true });

    // 關鍵字＋分類＋限定可以組合；切分類、清除關鍵字都保留限定。
    await page.getByRole("searchbox", { name: "搜尋需求" }).fill("Published");
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`organizationId=${a.organizationId}`));
    await page.getByRole("link", { name: "待審・0" }).click();
    await expect(page.getByText("這個分類沒有符合條件的需求。")).toBeVisible();
    await expect(page.getByText(`只看團體「${orgName}」的需求`)).toBeVisible();
    await page.getByRole("link", { name: "清除關鍵字", exact: true }).click();
    await expect(page.getByText(`只看團體「${orgName}」的需求`)).toBeVisible();
    await expect(page.getByRole("link", { name: "待審・1" })).toBeVisible();

    // 進詳情再返回，限定與分類都還在。
    await page.getByRole("link", { name: new RegExp(`A Pending ${runId}`) }).click();
    await page.getByRole("link", { name: /回需求列表/ }).first().click();
    await expect(page.getByText(`只看團體「${orgName}」的需求`)).toBeVisible();
    await expect(page.getByText(`A Pending ${runId}`)).toBeVisible();

    // 解除限定：回到一般列表，保留分類。
    await page.getByRole("link", { name: "解除限定" }).click();
    await expect(page).not.toHaveURL(/organizationId=/);
    await expect(page.getByText(`B Pending ${runId}`)).toBeVisible();

    // 老師詳情 → 這位老師的課程：同名老師的課不會出現，老師自建草稿課會出現。
    await page.goto(`/admin/teachers/${teacher.teacherProfileId}`);
    await page.getByRole("link", { name: "這位老師的課程（2）" }).click();
    await expect(page.getByText(`只看老師「${teacherName}」的課程`)).toBeVisible();
    await expect(page.getByRole("link", { name: "全部・2" })).toBeVisible();
    await expect(page.getByText(`Class A Teacher ${runId}`)).toBeVisible();
    await expect(page.getByText(`Class Solo Teacher ${runId}`)).toBeVisible();
    await expect(page.getByText(`Class B Twin ${runId}`)).toHaveCount(0);
    await page.getByRole("link", { name: new RegExp(`Class A Teacher ${runId}`) }).click();
    await page.getByRole("link", { name: /回課程列表/ }).first().click();
    await expect(page.getByText(`只看老師「${teacherName}」的課程`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-related-classes.png`, fullPage: true });

    // 團體 → 課程。
    await page.goto(`/admin/organizations?q=${encodeURIComponent(orgName)}`);
    await cardA.getByRole("link", { name: "查看課程（1）" }).click();
    await expect(page.getByText(`只看團體「${orgName}」的課程`)).toBeVisible();
    await expect(page.getByText(`Class A Teacher ${runId}`)).toBeVisible();
    await expect(page.getByText(`Class B Twin ${runId}`)).toHaveCount(0);

    // 查無 id：說找不到、沒有資料；格式不合法的 id 直接丟掉。
    await page.goto("/admin/classes?organizationId=missing_org_id");
    await expect(page.getByText("找不到這個限定對象，可能已不存在。")).toBeVisible();
    await expect(page.getByText("目前顯示：0 筆", { exact: true })).toBeVisible();
    await page.goto("/admin/classes?organizationId=bad%20id");
    await expect(page.getByText("找不到這個限定對象，可能已不存在。")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "解除限定" })).toHaveCount(0);
  });

  test("publishing and cancelling from a limited list return with relation, keyword and status kept; draft and zero-class teachers stay safe", async ({ context, page }, testInfo) => {
    const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-ops-${Date.now()}`);
    const emails = {
      admin: `admin-ops-${runId}@${testEmailDomain}`,
      organizer: `org-ops-${runId}@${testEmailDomain}`,
      teacher: `teacher-ops-${runId}@${testEmailDomain}`,
      idle: `teacher-idle-${runId}@${testEmailDomain}`,
      draft: `teacher-draft-${runId}@${testEmailDomain}`,
    };
    createdEmails.push(...Object.values(emails));

    const orgName = `Ops Org ${runId}`;
    const org = await createOrganizerProfileWithOrganization({ email: emails.organizer, displayName: `Ops Organizer ${runId}`, organizationName: orgName, organizationType: "community" });
    createdOrganizationIds.push(org.organizationId);
    const demandTitle = `Publish Me ${runId}`;
    await prisma.demandRequest.create({ data: { organizerProfileId: org.organizerProfileId, organizationId: org.organizationId, title: demandTitle, status: "submitted" } });
    const teacher = await createTeacherProfileWithSession({ email: emails.teacher, displayName: `Ops Teacher ${runId}`, status: "approved" });
    const idle = await createTeacherProfileWithSession({ email: emails.idle, displayName: `Idle Teacher ${runId}`, status: "approved" });
    const draftName = `Draft Teacher ${runId}`;
    const draft = await createTeacherProfileWithSession({ email: emails.draft, displayName: draftName, status: "draft" });
    const classTitle = `Cancel Me ${runId}`;
    await prisma.classSession.create({
      data: {
        title: classTitle, teacherProfileId: teacher.teacherProfileId, status: "open_for_enrollment",
        organizerProfileId: org.organizerProfileId, organizationId: org.organizationId,
        startAt: inDays(12), endAt: inDays(12, 1), location: "Taipei", capacity: 10,
      },
    });

    const { sessionToken } = await createUserSession({ email: emails.admin, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);
    const notice = (kind: string) => page.getByText(`只看團體「${orgName}」的${kind}`);

    // 需求：限定＋關鍵字＋待審 → 公開成功回同一個限定列表，已移出分類的需求仍可追查。
    await page.goto(`/admin/demands?organizationId=${org.organizationId}&q=${encodeURIComponent(demandTitle)}`);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: demandTitle, exact: true }) }).click();
    await page.getByRole("button", { name: "公開需求", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/demands" && url.searchParams.get("organizationId") === org.organizationId && url.searchParams.get("q") === demandTitle && !url.searchParams.has("status") && url.searchParams.get("result") === "success");
    await expect(notice("需求")).toBeVisible();
    await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `查看 ${demandTitle}`, exact: true }).click();
    await page.getByRole("link", { name: /回需求列表/ }).first().click();
    await expect(notice("需求")).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue(demandTitle);

    // 課程：限定＋關鍵字＋開放中 → 取消整堂成功回同一個限定列表；重新整理不遺失。
    await page.goto(`/admin/classes?organizationId=${org.organizationId}&status=open&q=${encodeURIComponent(classTitle)}`);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: classTitle, exact: true }) }).click();
    await page.getByRole("button", { name: "取消課程", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認取消課程", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/classes" && url.searchParams.get("organizationId") === org.organizationId && url.searchParams.get("q") === classTitle && url.searchParams.get("status") === "open" && url.searchParams.get("result") === "success");
    await expect(notice("課程")).toBeVisible();
    await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `查看 ${classTitle}`, exact: true })).toBeVisible();
    await page.reload();
    await expect(notice("課程")).toBeVisible();
    await expect(page.getByRole("link", { name: "已取消・1" })).toBeVisible();
    await page.getByRole("link", { name: "清除全部條件", exact: true }).first().click();
    await expect(page).toHaveURL(/\/admin\/classes$/);

    // 草稿老師的 id 與不存在的 id 看起來一樣：不顯示姓名、不透露草稿存在，可解除。
    for (const id of [draft.teacherProfileId, "missing_teacher_id"]) {
      await page.goto(`/admin/classes?teacherProfileId=${id}`);
      await expect(page.getByText("找不到這個限定對象，可能已不存在。")).toBeVisible();
      await expect(page.getByText(draftName)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "解除限定" })).toBeVisible();
    }

    // 沒有課程的老師不給死連結。
    await page.goto(`/admin/teachers/${idle.teacherProfileId}`);
    await expect(page.getByText("尚無課程", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /這位老師的課程/ })).toHaveCount(0);
  });
});
