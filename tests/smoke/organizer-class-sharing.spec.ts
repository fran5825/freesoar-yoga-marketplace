import { expect, test, type Page } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { openDirectClassFromProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/open-direct-class-core";
import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 13：分享連結、登入與學員報名。
// - 訪客打開公開規則讀不到的課程網址，一律看到同一個通用登入引導，不透露課程是否存在或內容。
// - 已登入學員依既有 Member 規則讀取／報名；讀不到就 not-found。
// - 團主開放後主要動作是複製完整報名連結；名單只有本人團主看得到。
const testEmailDomain = "organizer-class-sharing-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: emails } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

function slot(daysFromNow: number, startHourOffset = 0) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR + startHourOffset * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + HOUR) };
}

async function setup(id: string) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  const teacherEmail = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Share Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Share Teacher ${id}`,
    status: "approved",
  });
  const teacherUser = await prisma.teacherProfile.findUniqueOrThrow({
    where: { id: teacher.teacherProfileId },
    select: { userId: true },
  });
  return { organizer, teacher: { ...teacher, userId: teacherUser.userId } };
}

// 團主直接開團並開放報名（合作邀請已確認，直接寫入）。
async function openDirectClass(
  organizer: { organizerProfileId: string; organizationId: string },
  teacher: { teacherProfileId: string; userId: string },
  title: string,
  times: { startAt: Date; endAt: Date },
  extra: { isPublic?: boolean; capacity?: number } = {},
) {
  const proposal = await prisma.organizerClassProposal.create({
    data: {
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      teacherProfileId: teacher.teacherProfileId,
      title,
      description: "只透過連結招募的課程說明。",
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      ...times,
      location: `秘密地點 ${title}`,
      capacity: extra.capacity ?? 18,
      isPublic: extra.isPublic ?? false,
      status: "confirmed",
      submittedAt: new Date(),
      confirmedVersion: 1,
      confirmedAt: new Date(),
      confirmedByUserId: teacher.userId,
      transitionSeq: 3,
    },
  });
  const opened = await openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1);
  if (!opened.ok) throw new Error(`open failed: ${opened.code}`);
  return opened.classSessionId;
}

async function guideText(page: Page, classSessionId: string) {
  const text = await page.locator("main").innerText();
  return text.replaceAll(classSessionId, "<id>");
}

test.describe("organizer class sharing", () => {
  test("anonymous visitors see the same generic sign-in guide for every class they cannot read publicly", async ({ page }, testInfo) => {
    const id = runId(testInfo, "anon");
    const { organizer, teacher } = await setup(id);

    const unlistedId = await openDirectClass(organizer, teacher, `僅連結 ${id}`, slot(30));
    const draft = await prisma.classSession.create({
      data: { teacherProfileId: teacher.teacherProfileId, origin: "teacher_initiated", status: "draft", isPublic: true, title: `草稿 ${id}`, ...slot(30, 2), location: `草稿地點 ${id}`, capacity: 10 },
    });
    const cancelled = await prisma.classSession.create({
      data: { teacherProfileId: teacher.teacherProfileId, origin: "teacher_initiated", status: "cancelled", isPublic: true, title: `已取消 ${id}`, ...slot(30, 4), location: `取消地點 ${id}`, capacity: 10 },
    });
    const suspendedEmail = `teacher-suspended-${id}@${testEmailDomain}`;
    createdEmails.push(suspendedEmail);
    const suspendedTeacher = await createTeacherProfileWithSession({ email: suspendedEmail, displayName: `暫停老師 ${id}`, status: "suspended" });
    const suspendedClass = await prisma.classSession.create({
      data: { teacherProfileId: suspendedTeacher.teacherProfileId, origin: "teacher_initiated", status: "open_for_enrollment", isPublic: true, title: `暫停老師的課 ${id}`, ...slot(30, 6), location: `暫停地點 ${id}`, capacity: 10 },
    });

    const cases = [unlistedId, draft.id, cancelled.id, suspendedClass.id, `missing${id}`];
    const responses: { status: number | undefined; text: string; title: string }[] = [];
    for (const classSessionId of cases) {
      const response = await page.goto(`/classes/${classSessionId}`);
      await expect(page.getByRole("heading", { name: "登入後查看這堂課" })).toBeVisible();
      await expect(page.locator('input[name="classSessionId"]').first()).toHaveValue(classSessionId);
      responses.push({ status: response?.status(), text: await guideText(page, classSessionId), title: await page.title() });
    }
    // HTTP 狀態、畫面文字與頁面標題完全相同，看不出是哪一種情況。
    for (const response of responses.slice(1)) {
      expect(response).toEqual(responses[0]);
    }
    expect(responses[0].status).toBe(200);
    for (const secret of [`僅連結 ${id}`, `秘密地點`, `Share Teacher ${id}`, `草稿 ${id}`, `暫停老師`, `contact-${id}`]) {
      expect(responses[0].text).not.toContain(secret);
    }

    // 原始 HTML（含 RSC payload 與 metadata）也不能夾帶任何課程資料。
    for (const classSessionId of cases) {
      const html = await (await page.request.get(`/classes/${classSessionId}`)).text();
      for (const secret of [`僅連結 ${id}`, `秘密地點`, `Share Teacher ${id}`, `草稿 ${id}`, `已取消 ${id}`, `暫停老師`, `contact-${id}`]) {
        expect(html).not.toContain(secret);
      }
    }

    // 公開且可讀的課程照常顯示內容。
    const publicId = await openDirectClass(organizer, teacher, `公開課 ${id}`, slot(31), { isPublic: true });
    await page.goto(`/classes/${publicId}`);
    await expect(page.getByRole("heading", { name: `公開課 ${id}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "登入後查看這堂課" })).toHaveCount(0);
  });

  test("the guide keeps only safe return context, and a signed-in member reads and enrols in an unlisted class through the link", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "member");
    const { organizer, teacher } = await setup(id);
    const unlistedId = await openDirectClass(organizer, teacher, `連結報名 ${id}`, slot(32));

    // 不安全的 returnTo 一律換成課程列表。
    await page.goto(`/classes/${unlistedId}?returnTo=${encodeURIComponent("https://evil.example/")}`);
    await expect(page.getByRole("link", { name: "返回課程列表" })).toHaveAttribute("href", "/classes");
    await expect(page.locator('input[name="returnTo"]').first()).toHaveValue("/classes");

    // 不公開的課不會出現在公開探索。
    await page.goto("/classes");
    await expect(page.getByText(`連結報名 ${id}`)).toHaveCount(0);

    const memberEmail = `member-${id}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const member = await createUserSession({ email: memberEmail });
    await addAuthSessionCookie(context, member.sessionToken);

    // 登入後回到同一個網址：依 Member 規則看得到內容並報名。
    await page.goto(`/classes/${unlistedId}`);
    await expect(page.getByRole("heading", { name: `連結報名 ${id}` })).toBeVisible();
    await expect(page.getByText(`秘密地點 連結報名 ${id}`)).toBeVisible();
    await page.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
    await page.getByRole("button", { name: "確認報名" }).click();
    await expect(page.getByText("報名成功。")).toBeVisible();
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: member.userId, classSessionId: unlistedId } })).status,
    ).toBe("confirmed");

    // 已登入但讀不到（草稿、不存在）仍是 not-found，不顯示登入引導。
    const draft = await prisma.classSession.create({
      data: { teacherProfileId: teacher.teacherProfileId, origin: "teacher_initiated", status: "draft", title: `會員草稿 ${id}`, ...slot(32, 3), location: "台北", capacity: 10 },
    });
    for (const classSessionId of [draft.id, `missing${id}`]) {
      const response = await page.goto(`/classes/${classSessionId}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "登入後查看這堂課" })).toHaveCount(0);
      await expect(page.getByText(`會員草稿 ${id}`)).toHaveCount(0);
    }
  });

  test("two members racing for the last seat: exactly one enrolment succeeds", async ({}, testInfo) => {
    const id = runId(testInfo, "race");
    const { organizer, teacher } = await setup(id);
    const classSessionId = await openDirectClass(organizer, teacher, `最後一席 ${id}`, slot(33), { capacity: 1 });
    const members = [];
    for (const label of ["a", "b"]) {
      const email = `member-${label}-${id}@${testEmailDomain}`;
      createdEmails.push(email);
      members.push(await createUserSession({ email }));
    }
    const results = await Promise.all(
      members.map((member) => createEnrollmentForUser(member.userId, classSessionId, { notes: null })),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.enrollment.count({ where: { classSessionId, status: "confirmed" } })).toBe(1);
  });

  test("the organizer copies the full enrolment link, opens the class page and sees the roster; another organizer cannot", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "share");
    const { organizer, teacher } = await setup(id);
    const classSessionId = await openDirectClass(organizer, teacher, `分享連結 ${id}`, slot(34));
    const memberEmail = `member-${id}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const member = await createUserSession({ email: memberEmail });
    expect(await createEnrollmentForUser(member.userId, classSessionId, { notes: "膝蓋舊傷" })).toMatchObject({ ok: true });

    const context = await browser.newContext();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();
    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByText("這堂課只透過連結招募，不會出現在公開課程列表。")).toBeVisible();
    await expect(page.getByText(/連結可以被轉傳/)).toBeVisible();
    const origin = new URL(page.url()).origin;
    const fullUrl = `${origin}/classes/${classSessionId}`;
    await expect(page.getByLabel("報名連結", { exact: true })).toHaveValue(fullUrl);
    await page.getByRole("button", { name: "複製報名連結" }).click();
    await expect(page.getByText("已複製，可以貼到 LINE 或群組傳給團員。")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(fullUrl);

    await expect(page.getByRole("link", { name: "看報名名單" })).toHaveAttribute("href", "#roster");
    await expect(page.locator("#roster")).toContainText("已報名會員（1 人）");
    await expect(page.locator("#roster")).toContainText("膝蓋舊傷");
    await page.getByRole("link", { name: "開啟課程頁" }).click();
    await expect(page).toHaveURL(new RegExp(`/classes/${classSessionId}$`));
    await expect(page.getByRole("heading", { name: `分享連結 ${id}` })).toBeVisible();
    await context.close();

    // 其他團主看不到這堂課與名單。
    const otherEmail = `other-organizer-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createOrganizerProfileWithOrganization({ email: otherEmail, displayName: `Other ${id}`, organizationName: `Other Org ${id}` });
    const otherContext = await browser.newContext();
    await addAuthSessionCookie(otherContext, other.sessionToken);
    const otherPage = await otherContext.newPage();
    const response = await otherPage.goto(`/organizer/classes/${classSessionId}`);
    expect(response?.status()).toBe(404);
    await expect(otherPage.getByText("膝蓋舊傷")).toHaveCount(0);
    await otherContext.close();
  });
});
