import { expect, test, type Page } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 05：建立合作邀請並送給老師（OrganizerClassProposal）。
const testEmailDomain = "organizer-class-proposals-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  // 合作邀請對老師是 Restrict，要先刪邀請再刪老師資料。
  await prisma.organizerClassProposal.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

// 回傳 N 天後在台灣時間 hh:mm 的 datetime-local 字串。
function taipeiLocal(daysFromNow: number, time: string): string {
  const date = new Date(Date.now() + daysFromNow * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${parts}T${time}`;
}

async function setup(id: string, { contactComplete = true }: { contactComplete?: boolean } = {}) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  const teacherEmail = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Proposal Org ${id}`,
    contactName: "聯絡人",
    contactEmail: contactComplete ? `contact-${id}@example.com` : null,
    contactPhone: "0900000000",
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Invite Teacher ${id}`,
    status: "approved",
  });
  return { organizer, teacher, teacherEmail };
}

async function pickTeacher(page: Page, name: string) {
  await page.getByPlaceholder("輸入老師的顯示名稱").fill(name);
  await page.getByRole("button", { name: "搜尋老師" }).click();
  await page.getByRole("list", { name: "可邀請的老師" }).getByRole("button", { name: new RegExp(name) }).click();
}

async function fillCourse(page: Page, title: string, start = taipeiLocal(20, "19:00"), end = taipeiLocal(20, "20:30")) {
  await page.getByLabel("課程名稱").fill(title);
  await page.getByText("伸展與身體保養", { exact: true }).click();
  await page.getByLabel("開始時間").fill(start);
  await page.getByLabel("結束時間").fill(end);
  await page.getByLabel("地點").fill("台北市信義區松仁路 100 號");
  await page.getByLabel("名額").fill("20");
}

test.describe("organizer class proposals smoke", () => {
  test("saves a draft on a stable URL, rejects a stale version, and submits to the invited teacher without creating a class", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "flow");
    const { organizer, teacher } = await setup(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    await page.getByLabel("課程名稱").fill(`草稿課程 ${id}`);
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    const proposalId = page.url().match(/class-proposals\/([^/]+)\/edit$/)?.[1] as string;

    const draft = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: { status: true, version: true, organizerProfileId: true, transitionSeq: true },
    });
    expect(draft).toMatchObject({
      status: "draft",
      version: 1,
      transitionSeq: 1,
      organizerProfileId: organizer.organizerProfileId,
    });

    // 草稿的有界驗證：名額超出範圍時不存檔，欄位保留。
    await page.getByLabel("名額").fill("600");
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page.getByText("名額需介於 1–500 人之間。").first()).toBeVisible();
    await expect(page.getByLabel("名額")).toHaveValue("600");
    await page.getByLabel("名額").fill("");

    // 另一個分頁先存了一次（version 變了）：這一頁再存會得到「剛剛被修改過」，不會覆蓋。
    await prisma.organizerClassProposal.update({ where: { id: proposalId }, data: { version: { increment: 1 } } });
    await page.getByLabel("課程名稱").fill(`草稿課程 ${id} 修改`);
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page.getByText("這份邀請剛剛在別處被修改過，請重新整理後再編輯。").first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("課程名稱")).toHaveValue(`草稿課程 ${id}`);
    await pickTeacher(page, `Invite Teacher ${id}`);
    await fillCourse(page, `合作課程 ${id}`);

    await page.getByRole("button", { name: "送出邀請" }).first().click();
    // 確認畫面列出團體、老師與時間，並說明老師確認前不會保留時段。
    await expect(page.getByText(`Proposal Org ${id}`).first()).toBeVisible();
    await expect(page.getByText(`Invite Teacher ${id}`).first()).toBeVisible();
    await expect(page.getByText("老師確認前還不會保留老師的時間").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出邀請" }).first().click();

    await expect(page).toHaveURL(new RegExp(`/organizer/class-proposals/${proposalId}\\?flash=submitted$`));
    await expect(page.getByText("邀請已送出，老師確認後你就能開放報名。")).toBeVisible();
    await expect(page.getByText("下一步：老師")).toBeVisible();
    await expect(page.getByText("等待老師確認").first()).toBeVisible();

    const submitted = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: {
        status: true,
        submittedAt: true,
        teacherProfileId: true,
        classSessionId: true,
        startAt: true,
        version: true,
        transitionSeq: true,
      },
    });
    // 每次成功寫入 transitionSeq +1：建立 1、（模擬別分頁 +0）、重新整理後存檔＋送出共兩次寫入。
    expect(submitted.transitionSeq).toBe(3);
    expect(submitted.status).toBe("pending_confirmation");
    expect(submitted.submittedAt).not.toBeNull();
    expect(submitted.teacherProfileId).toBe(teacher.teacherProfileId);
    expect(submitted.classSessionId).toBeNull();
    // 台灣時間 19:00 存成 UTC 11:00。
    expect(submitted.startAt?.toISOString()).toMatch(/T11:00:00\.000Z$/);
    // 送出邀請不建立正式課程。
    expect(await prisma.classSession.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(0);

    // 送出後不能再進編輯頁，導回詳情。
    await page.goto(`/organizer/class-proposals/${proposalId}/edit`);
    await expect(page).toHaveURL(new RegExp(`/organizer/class-proposals/${proposalId}$`));
  });

  test("teacher lookup lists only approved teachers and only public card fields", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "lookup");
    const { organizer, teacherEmail } = await setup(id);
    const suspendedEmail = `suspended-${id}@${testEmailDomain}`;
    createdEmails.push(suspendedEmail);
    await createTeacherProfileWithSession({
      email: suspendedEmail,
      displayName: `Invite Teacher ${id} Suspended`,
      status: "suspended",
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    await page.getByPlaceholder("輸入老師的顯示名稱").fill(`Invite Teacher ${id}`);
    await page.getByRole("button", { name: "搜尋老師" }).click();
    const results = page.getByRole("list", { name: "可邀請的老師" });
    await expect(results.getByRole("listitem")).toHaveCount(1);
    await expect(results).toContainText(`Invite Teacher ${id}`);
    await expect(results).not.toContainText("Suspended");
    // 名片只顯示公開資訊，不含 email 或電話。
    await expect(page.getByText(teacherEmail)).toHaveCount(0);
  });

  test("blocks submitting to a teacher who lost approval or for a past time, keeping every field", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "guards");
    const { organizer, teacher } = await setup(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    await pickTeacher(page, `Invite Teacher ${id}`);
    await fillCourse(page, `守衛課程 ${id}`, taipeiLocal(-2, "19:00"), taipeiLocal(-2, "20:00"));

    // 開始時間已過：畫面上就擋下並指出欄位，不能送出。
    await expect(page.getByRole("button", { name: "送出邀請" }).first()).toBeDisabled();
    await page.getByRole("button", { name: "開始時間（須晚於現在）" }).first().click();
    await expect(page.getByLabel("開始時間")).toBeFocused();
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);

    // 改成未來時間，但老師剛被暫停：伺服器擋下。
    await page.getByLabel("開始時間").fill(taipeiLocal(15, "19:00"));
    await page.getByLabel("結束時間").fill(taipeiLocal(15, "20:00"));
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    await page.getByRole("button", { name: "送出邀請" }).first().click();
    await page.getByRole("button", { name: "確認送出邀請" }).first().click();
    await expect(page.getByText("這位老師目前無法接受邀請，請選擇其他老師。").first()).toBeVisible();
    await expect(page.getByLabel("課程名稱")).toHaveValue(`守衛課程 ${id}`);

    const proposals = await prisma.organizerClassProposal.findMany({
      where: { organizerProfileId: organizer.organizerProfileId },
      select: { status: true },
    });
    expect(proposals).toEqual([{ status: "draft" }]);
  });

  test("an organization with incomplete contact info cannot send an invitation and offers to save and complete it", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "contact");
    const { organizer } = await setup(id, { contactComplete: false });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    await pickTeacher(page, `Invite Teacher ${id}`);
    await fillCourse(page, `聯絡資料課程 ${id}`);
    await expect(page.getByRole("button", { name: "送出邀請" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "團體聯絡資料" }).first()).toBeVisible();

    await page.getByRole("button", { name: "儲存草稿並補齊聯絡資料" }).click();
    await expect(page).toHaveURL(/\/organizer\/organizations\/[^/?]+\?returnTo=/);
    await page.getByLabel("聯絡信箱").fill(`contact-${id}@example.com`);
    await page.getByRole("button", { name: "儲存並回到剛剛的頁面" }).click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);
    await expect(page.getByLabel("課程名稱")).toHaveValue(`聯絡資料課程 ${id}`);
    await expect(page.getByRole("button", { name: "送出邀請" }).first()).toBeEnabled();
  });

  test("keeps proposals private: other organizers and teachers get 404, the invited teacher sees only sent invitations", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "access");
    const { organizer, teacher } = await setup(id);
    const otherOrganizerEmail = `other-organizer-${id}@${testEmailDomain}`;
    const otherTeacherEmail = `other-teacher-${id}@${testEmailDomain}`;
    createdEmails.push(otherOrganizerEmail, otherTeacherEmail);
    const otherOrganizer = await createOrganizerProfileWithOrganization({
      email: otherOrganizerEmail,
      displayName: `Other ${id}`,
      organizationName: `Other Org ${id}`,
    });
    const otherTeacher = await createTeacherProfileWithSession({
      email: otherTeacherEmail,
      displayName: `Other Teacher ${id}`,
      status: "approved",
    });

    const base = {
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      teacherProfileId: teacher.teacherProfileId,
      title: `私人邀請 ${id}`,
      serviceTypes: ["伸展與身體保養"],
      startAt: new Date(Date.now() + 20 * 86_400_000),
      endAt: new Date(Date.now() + 20 * 86_400_000 + 3_600_000),
      location: "台北",
      capacity: 10,
    };
    const draft = await prisma.organizerClassProposal.create({ data: { ...base, status: "draft" } });
    const pending = await prisma.organizerClassProposal.create({
      data: { ...base, status: "pending_confirmation", submittedAt: new Date() },
    });

    async function statusFor(sessionToken: string, path: string) {
      const context = await browser.newContext();
      await addAuthSessionCookie(context, sessionToken);
      const page = await context.newPage();
      const response = await page.goto(path);
      const status = response?.status();
      const text = await page.locator("body").innerText();
      await context.close();
      return { status, text };
    }

    // 其他團主：詳情與編輯都 404。
    expect((await statusFor(otherOrganizer.sessionToken, `/organizer/class-proposals/${pending.id}`)).status).toBe(404);
    expect((await statusFor(otherOrganizer.sessionToken, `/organizer/class-proposals/${draft.id}/edit`)).status).toBe(404);
    // 受邀老師：看得到已送出的邀請完整內容，看不到草稿。
    const invited = await statusFor(teacher.sessionToken, `/teacher/class-proposals/${pending.id}`);
    expect(invited.status).toBe(200);
    expect(invited.text).toContain(`私人邀請 ${id}`);
    expect(invited.text).toContain(`Proposal Org ${id}`);
    expect((await statusFor(teacher.sessionToken, `/teacher/class-proposals/${draft.id}`)).status).toBe(404);
    // 其他老師：404。
    expect((await statusFor(otherTeacher.sessionToken, `/teacher/class-proposals/${pending.id}`)).status).toBe(404);
  });
  test("after a failed first submit lands on the edit page, field errors are still clickable", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "flash-locate");
    const { organizer, teacher } = await setup(id);
    // 開始時間已過的草稿（例如送出時剛好過了時間），從送出失敗的換頁進到編輯頁。
    const draft = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        teacherProfileId: teacher.teacherProfileId,
        title: `過期草稿 ${id}`,
        serviceTypes: ["伸展與身體保養"],
        startAt: new Date(Date.now() - 2 * 86_400_000),
        endAt: new Date(Date.now() - 2 * 86_400_000 + 3_600_000),
        location: "台北",
        capacity: 10,
      },
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/class-proposals/${draft.id}/edit?flash=proposal_starts_in_past`);
    await expect(page.getByText(/開始時間已經過了/).first()).toBeVisible();
    await page.getByRole("button", { name: "開始時間必須晚於現在。" }).first().click();
    await expect(page.getByLabel("開始時間")).toBeFocused();
  });

  test("when contact info is removed elsewhere, the rejected submit offers to save and complete it", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "contact-race");
    const { organizer } = await setup(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    // 資料完整時也有團體編輯入口。
    await expect(page.getByRole("button", { name: "儲存草稿並編輯團體資料" })).toBeVisible();
    await pickTeacher(page, `Invite Teacher ${id}`);
    await fillCourse(page, `聯絡資料異動 ${id}`);
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);

    // 另一個分頁清掉了聯絡電話。
    await prisma.organization.update({ where: { id: organizer.organizationId }, data: { contactPhone: null } });
    await page.getByRole("button", { name: "送出邀請" }).first().click();
    await page.getByRole("button", { name: "確認送出邀請" }).first().click();
    await expect(page.getByText("這個團體的聯絡資料還沒補齊，請先補齊聯絡資料再送出邀請。").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存草稿並補齊聯絡資料" })).toBeVisible();
    await expect(page.getByRole("button", { name: "送出邀請" }).first()).toBeDisabled();
    await expect(page.getByLabel("課程名稱")).toHaveValue(`聯絡資料異動 ${id}`);
  });
});
