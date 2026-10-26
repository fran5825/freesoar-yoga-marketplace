import { expect, test, type Browser } from "@playwright/test";

import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { cancelDemandRequestForOrganizer } from "../../src/domain/demand-request/__internal__/cancel-demand-request-core";
import { selectDemandResponseForOrganizer } from "../../src/domain/demand-response/__internal__/select-and-submit-core";
import { getClassDraftKind } from "../../src/domain/class-session/draft-kind";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { buildNotificationCopy } from "../../src/domain/notification/copy";
import { openDirectClassFromProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/open-direct-class-core";
import { futureDateTime } from "./_helpers/future-dates";
import { createDemandResponse, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-post-match-handoff（spec：docs/specs/organizer-post-match-handoff-spec.md）：
// 團主選定老師之後的交接——草稿課程的提醒（票 01–03）與雙方聯絡方式（票 04）。
const testEmailDomain = "organizer-post-match-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  // 直接開團的合作邀請先刪：它跟課程互相關聯。
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: emails } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.demandResponse.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails.filter((email) => email.startsWith("organizer-")));
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await prisma.user.deleteMany({ where: { email: emails } });
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

function slot(daysFromNow: number) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + HOUR) };
}

// 一筆已選定老師、已轉成課程的需求，課程狀態與時間由呼叫端決定。
async function setupMatchedClass(
  id: string,
  classSession: { status: "draft" | "open_for_enrollment"; daysFromNow: number },
) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  const teacherEmail = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Handoff Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Handoff Teacher ${id}`,
    status: "approved",
  });
  const demand = await createDemandRequest({
    organizerProfileId: organizer.organizerProfileId,
    organizationId: organizer.organizationId,
    status: "converted_to_class",
    data: completeDemandRequestData({ title: `交接需求 ${id}` }),
  });
  await createDemandResponse({
    demandRequestId: demand.id,
    teacherProfileId: teacher.teacherProfileId,
    status: "selected",
  });
  const created = await prisma.classSession.create({
    data: {
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      origin: "organizer_matched",
      status: classSession.status,
      title: `交接課程 ${id}`,
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      ...slot(classSession.daysFromNow),
      location: `交接地點 ${id}`,
      capacity: 12,
    },
    select: { id: true },
  });

  return { organizer, teacher, demandId: demand.id, classSessionId: created.id };
}

test.describe("organizer post-match handoff", () => {
  test("draft kind: openable before start, expired at or after start, not_draft otherwise", () => {
    const now = new Date("2026-10-26T12:00:00.000Z");

    expect(getClassDraftKind({ status: "draft", startAt: new Date(now.getTime() + 1) }, now)).toBe("openable_draft");
    expect(getClassDraftKind({ status: "draft", startAt: now }, now)).toBe("expired_draft");
    expect(getClassDraftKind({ status: "draft", startAt: new Date(now.getTime() - HOUR) }, now)).toBe("expired_draft");
    expect(getClassDraftKind({ status: "open_for_enrollment", startAt: new Date(now.getTime() + DAY) }, now)).toBe("not_draft");
    expect(getClassDraftKind({ status: "cancelled", startAt: new Date(now.getTime() - DAY) }, now)).toBe("not_draft");
  });

  test("class page: openable draft explains members cannot see it and offers 開放報名", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "openable");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "draft", daysFromNow: 10 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();

    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByText("學員還看不到這堂課。確認時間、地點後按「開放報名」，就能複製連結分享給團員。")).toBeVisible();
    await expect(page.getByRole("button", { name: "開放報名" })).toBeVisible();
    await expect(page.getByText("開課時間已過，這堂課沒有開放報名，無法再開放。")).toHaveCount(0);
    await context.close();
  });

  test("class page: expired draft hides 開放報名 and points to new demand or direct class", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "expired");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "draft", daysFromNow: -1 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();

    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByText("開課時間已過，這堂課沒有開放報名，無法再開放。")).toBeVisible();
    await expect(page.getByRole("button", { name: "開放報名" })).toHaveCount(0);
    await expect(page.getByText("學員還看不到這堂課。", { exact: false })).toHaveCount(0);

    await page.getByRole("link", { name: "建立新的需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands\/new/);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await page.getByRole("link", { name: "直接邀請合作老師開課" }).click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/new/);
    await context.close();
  });

  test("class page: opened class shows neither draft notice", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "opened");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "open_for_enrollment", daysFromNow: 10 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();

    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByRole("button", { name: "複製報名連結" })).toBeVisible();
    await expect(page.getByText("學員還看不到這堂課。", { exact: false })).toHaveCount(0);
    await expect(page.getByText("開課時間已過，這堂課沒有開放報名", { exact: false })).toHaveCount(0);
    await context.close();
  });
});

// 票 02：總覽待辦、課程列表、需求下一步（需求列表、總覽「我的需求」、需求詳情三處說法一致）。
test.describe("organizer post-match handoff: reminders", () => {
  const cases = [
    {
      label: "openable",
      status: "draft" as const,
      daysFromNow: 10,
      demandShort: "課程已建立，還沒開放報名",
      demandLong: "課程已建立，還沒開放報名。到課程頁按「開放報名」後，就能分享連結。",
      classListLine: "還沒開放報名，學員看不到",
      inTodo: true,
    },
    {
      label: "expired",
      status: "draft" as const,
      daysFromNow: -1,
      demandShort: "課程沒有開放報名（開課時間已過）",
      demandLong: "課程已建立但沒有開放報名，開課時間已過。",
      classListLine: "開課時間已過，沒有開放報名",
      inTodo: false,
    },
    {
      label: "opened",
      status: "open_for_enrollment" as const,
      daysFromNow: 10,
      demandShort: "課程已建立",
      demandLong: "課程已建立。到課程頁可以開放報名、分享連結並查看報名狀況。",
      classListLine: null,
      inTodo: false,
    },
  ];

  for (const testCase of cases) {
    test(`${testCase.label} class: demand next step, dashboard and class list agree`, async ({ browser }, testInfo) => {
      const id = runId(testInfo, `remind-${testCase.label}`);
      const { organizer, demandId, classSessionId } = await setupMatchedClass(id, {
        status: testCase.status,
        daysFromNow: testCase.daysFromNow,
      });
      const context = await browser.newContext();
      await addAuthSessionCookie(context, organizer.sessionToken);
      const page = await context.newPage();
      const todoTitle = `「交接課程 ${id}」還沒開放報名`;

      // 需求列表卡片
      await page.goto("/organizer/demands");
      const listCard = page.getByRole("link").filter({ hasText: `交接需求 ${id}` });
      await expect(listCard.getByText(testCase.demandShort, { exact: true })).toBeVisible();

      // 需求詳情的下一步卡片
      await page.goto(`/organizer/demands/${demandId}`);
      await expect(page.getByLabel("下一步提示").getByText(testCase.demandLong, { exact: true })).toBeVisible();

      // 總覽：「我的需求」卡片與「待你處理」
      await page.goto("/organizer/dashboard");
      const dashboardCard = page.getByRole("link").filter({ hasText: `交接需求 ${id}` });
      await expect(dashboardCard.getByText(testCase.demandShort, { exact: true })).toBeVisible();
      await expect(page.getByText(todoTitle)).toHaveCount(testCase.inTodo ? 1 : 0);

      // 我的課程列表
      await page.goto("/organizer/classes");
      const classCard = page.getByRole("article").filter({ hasText: `交接課程 ${id}` });
      for (const line of ["還沒開放報名，學員看不到", "開課時間已過，沒有開放報名"]) {
        await expect(classCard.getByText(line, { exact: true })).toHaveCount(line === testCase.classListLine ? 1 : 0);
      }

      expect(classSessionId).toBeTruthy();
      await context.close();
    });
  }

  test("dashboard todo links to the class and disappears after 開放報名", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "remind-open");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "draft", daysFromNow: 10 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();
    const todoTitle = `「交接課程 ${id}」還沒開放報名`;

    await page.goto("/organizer/dashboard");
    const pending = page.getByRole("region", { name: "待你處理" });
    await pending.getByRole("link").filter({ hasText: todoTitle }).click();
    await expect(page).toHaveURL(new RegExp(`/organizer/classes/${classSessionId}`));

    await page.getByRole("button", { name: "開放報名" }).click();
    await page.getByRole("button", { name: "確定開放報名" }).click();
    await expect(page.getByText("已開放報名。")).toBeVisible();

    await page.goto("/organizer/dashboard");
    await expect(page.getByText(todoTitle)).toHaveCount(0);
    await context.close();
  });
});

// 票 03：「課程已建立」通知只有團主媒合建課改成「還沒開放報名」，其他兩條路線不變。
test.describe("organizer post-match handoff: class created notice", () => {
  async function bodyFor(userId: string, title: string) {
    const notification = await prisma.notification.findFirst({
      where: { userId, type: "class_session_created", channel: "in_app", body: { contains: title } },
      select: { body: true },
    });
    return notification?.body ?? null;
  }

  test("matched-demand class: organizer and teacher are told enrollment is not open yet", async ({}, testInfo) => {
    const id = runId(testInfo, "notice-matched");
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    const teacherEmail = `teacher-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${id}`,
      organizationName: `Notice Org ${id}`,
      contactName: "聯絡人",
      contactEmail: `contact-${id}@example.com`,
      contactPhone: "0900000000",
    });
    const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: `Notice Teacher ${id}`, status: "approved" });
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `通知需求 ${id}` }),
    });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId, status: "selected" });
    const title = `媒合建課 ${id}`;
    const validation = validateClassSessionCreate({
      title,
      description: null,
      serviceType: "伸展與身體保養",
      startAt: futureDateTime(40, "14:00"),
      endAt: futureDateTime(40, "15:00"),
      location: "Test Studio",
      capacity: 5,
      isPublic: false,
    });
    if (!validation.valid) throw new Error("fixture");
    const created = await createClassSessionForOrganizer(organizer.organizerProfileId, demand.id, validation.normalized);
    expect(created.ok).toBe(true);

    expect(await bodyFor(organizer.userId, title)).toBe(
      `課程「${title}」已建立，還沒開放報名。到課程頁按「開放報名」後，就能分享連結給團員。`,
    );
    expect(await bodyFor(teacher.userId, title)).toBe(`團主建立了課程「${title}」。團主開放報名後，學員才能報名。`);
  });

  test("direct class: the invited teacher's notice keeps the original wording", async ({}, testInfo) => {
    const id = runId(testInfo, "notice-direct");
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    const teacherEmail = `teacher-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${id}`,
      organizationName: `Direct Org ${id}`,
      contactName: "聯絡人",
      contactEmail: `contact-${id}@example.com`,
      contactPhone: "0900000000",
    });
    const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: `Direct Teacher ${id}`, status: "approved" });
    const title = `直接開團 ${id}`;
    const proposal = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        teacherProfileId: teacher.teacherProfileId,
        title,
        description: "直接開團的課程說明。",
        serviceType: "伸展與身體保養",
        serviceTypes: ["伸展與身體保養"],
        ...slot(30),
        location: "Direct Studio",
        capacity: 10,
        isPublic: false,
        status: "confirmed",
        submittedAt: new Date(),
        confirmedVersion: 1,
        confirmedAt: new Date(),
        confirmedByUserId: teacher.userId,
        transitionSeq: 3,
      },
    });
    const opened = await openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1);
    expect(opened.ok).toBe(true);

    expect(await bodyFor(teacher.userId, title)).toBe(`你的課程「${title}」已經建立完成。`);
  });

  test("teacher-created class copy (no notYetOpen) keeps the original wording", () => {
    expect(buildNotificationCopy("class_session_created", "self", { classSessionTitle: "老師的課" }).body).toBe(
      "課程「老師的課」已經建立完成。",
    );
    expect(
      buildNotificationCopy("class_session_created", "self", { classSessionTitle: "老師的系列", sessionCount: 3, dateRange: "11/02–11/16" }).body,
    ).toBe("課程「老師的系列」共 3 堂（11/02–11/16）已經建立完成。");
  });
});

// 票 04：選定後雙方看到聯絡方式（權限變更，重點是誰「看不到」）。
test.describe("organizer post-match handoff: contacts after selection", () => {
  // 一筆已公開的需求、三位老師回應；每位老師都有自己的 contactInfo（用來檢查沒有外洩）。
  async function setupResponses(
    id: string,
    options: { selectedHasContact?: boolean } = {},
  ) {
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${id}`,
      organizationName: `Contact Org ${id}`,
      contactName: `窗口 ${id}`,
      contactEmail: `window-${id}@example.com`,
      contactPhone: "0911222333",
    });
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `聯絡需求 ${id}` }),
    });
    const teachers = [];
    for (const label of ["a", "b", "c"]) {
      const email = `teacher-${label}-${id}@${testEmailDomain}`;
      createdEmails.push(email);
      const teacher = await createTeacherProfileWithSession({ email, displayName: `Contact Teacher ${label} ${id}`, status: "approved" });
      const contactInfo = label === "a" && options.selectedHasContact === false ? null : `LINE secret-${label}-${id}`;
      await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { contactInfo } });
      const response = await createDemandResponse({
        demandRequestId: demand.id,
        teacherProfileId: teacher.teacherProfileId,
        proposedTimeSlots: ["平日晚上", "週末早上"],
      });
      teachers.push({ ...teacher, label, contactInfo, responseId: response.id });
    }

    return { organizer, demandId: demand.id, teachers };
  }

  async function asUser(browser: Browser, sessionToken: string) {
    const context = await browser.newContext();
    await addAuthSessionCookie(context, sessionToken);
    return { context, page: await context.newPage() };
  }

  test("organizer sees only the selected teacher's contact, and only after selecting", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "contact-org");
    const { organizer, demandId, teachers } = await setupResponses(id);
    const { context, page } = await asUser(browser, organizer.sessionToken);

    await page.goto(`/organizer/demands/${demandId}`);
    let html = await page.content();
    for (const teacher of teachers) expect(html).not.toContain(teacher.contactInfo!);
    await expect(page.getByText("老師的聯絡方式")).toHaveCount(0);

    const selected = await selectDemandResponseForOrganizer(organizer.organizerProfileId, teachers[0].responseId);
    expect(selected.ok).toBe(true);

    await page.goto(`/organizer/demands/${demandId}`);
    const selectedCard = page.getByRole("listitem").filter({ hasText: `Contact Teacher a ${id}` });
    await expect(selectedCard.getByText("老師的聯絡方式")).toBeVisible();
    await expect(selectedCard.getByText(teachers[0].contactInfo!)).toBeVisible();
    html = await page.content();
    expect(html).not.toContain(teachers[1].contactInfo!);
    expect(html).not.toContain(teachers[2].contactInfo!);

    // 建課區塊：時間欄上方有確認提醒與老師的可配合時段。
    await expect(page.getByText("請先跟老師確認時間再填。")).toBeVisible();
    await expect(page.getByText("老師回應時寫的可配合時段：平日晚上、週末早上")).toBeVisible();

    // 手機寬度不因聯絡資料出現水平捲動。
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await context.close();

    // 另一位團主打開這筆需求 → not-found。
    const otherEmail = `organizer-other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createOrganizerProfileWithOrganization({ email: otherEmail, displayName: `Other ${id}`, organizationName: `Other Org ${id}` });
    const otherSession = await asUser(browser, other.sessionToken);
    const response = await otherSession.page.goto(`/organizer/demands/${demandId}`);
    expect(response?.status()).toBe(404);
    expect(await otherSession.page.content()).not.toContain(teachers[0].contactInfo!);
    await otherSession.context.close();
  });

  test("only the selected teacher sees the organization contact window, until the demand is cancelled", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "contact-teacher");
    const { organizer, demandId, teachers } = await setupResponses(id);
    expect((await selectDemandResponseForOrganizer(organizer.organizerProfileId, teachers[0].responseId)).ok).toBe(true);

    const selected = await asUser(browser, teachers[0].sessionToken);
    await selected.page.goto(`/teacher/demands/${demandId}`);
    await expect(selected.page.getByText(`Contact Org ${id}`)).toBeVisible();
    await expect(selected.page.getByText(`窗口 ${id}`, { exact: true })).toBeVisible();
    await expect(selected.page.getByText(`window-${id}@example.com`)).toBeVisible();
    await expect(
      selected.page.getByText("團主選擇了你的回應。請用下方的團體聯絡窗口跟團主確認上課時間；團主建立課程後，你會收到通知。"),
    ).toBeVisible();
    await expect(selected.page.getByText("你還沒有填聯絡方式", { exact: false })).toHaveCount(0);

    // 選定通知連到這一頁；團主那則連到需求詳情。
    await selected.page.goto("/notifications");
    await expect(
      selected.page.locator("article").filter({ hasText: `聯絡需求 ${id}` }).getByRole("link"),
    ).toHaveAttribute("href", `/teacher/demands/${demandId}`);
    const organizerSession = await asUser(browser, organizer.sessionToken);
    await organizerSession.page.goto("/notifications");
    await expect(
      organizerSession.page.locator("article").filter({ hasText: "請先跟老師確認上課時間" }).getByRole("link"),
    ).toHaveAttribute("href", `/organizer/demands/${demandId}`);
    await organizerSession.context.close();

    // 老師總覽「等待團主建立課程」有聯絡指引，仍連到回應頁。
    await selected.page.goto("/teacher/dashboard");
    const todo = selected.page.getByRole("link").filter({ hasText: `團主已選你合作「聯絡需求 ${id}」` });
    await expect(todo).toContainText("請跟團主確認上課時間，團體聯絡窗口在回應頁");
    await expect(todo).toHaveAttribute("href", `/teacher/demands/${demandId}`);

    // 沒被選上的老師、從沒回應的老師看不到。
    const declined = await asUser(browser, teachers[1].sessionToken);
    await declined.page.goto(`/teacher/demands/${demandId}`);
    expect(await declined.page.content()).not.toContain(`window-${id}@example.com`);
    await declined.context.close();

    const strangerEmail = `teacher-stranger-${id}@${testEmailDomain}`;
    createdEmails.push(strangerEmail);
    const stranger = await createTeacherProfileWithSession({ email: strangerEmail, displayName: `Stranger ${id}`, status: "approved" });
    const strangerSession = await asUser(browser, stranger.sessionToken);
    await strangerSession.page.goto(`/teacher/demands/${demandId}`);
    expect(await strangerSession.page.content()).not.toContain(`window-${id}@example.com`);
    await strangerSession.context.close();

    // 需求取消後，原選定老師也看不到。
    expect(await cancelDemandRequestForOrganizer(organizer.organizerProfileId, demandId)).toMatchObject({ ok: true });
    await selected.page.goto(`/teacher/demands/${demandId}`);
    expect(await selected.page.content()).not.toContain(`window-${id}@example.com`);
    await selected.context.close();
  });

  test("teacher without contactInfo: organizer is told the teacher will reach out, teacher is reminded", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "contact-missing");
    const { organizer, demandId, teachers } = await setupResponses(id, { selectedHasContact: false });
    expect((await selectDemandResponseForOrganizer(organizer.organizerProfileId, teachers[0].responseId)).ok).toBe(true);

    const organizerSession = await asUser(browser, organizer.sessionToken);
    await organizerSession.page.goto(`/organizer/demands/${demandId}`);
    await expect(
      organizerSession.page.getByText("老師還沒留下聯絡方式。老師看得到你團體的聯絡窗口，會主動跟你聯絡確認時間。"),
    ).toBeVisible();
    await organizerSession.context.close();

    const teacherSession = await asUser(browser, teachers[0].sessionToken);
    await teacherSession.page.goto(`/teacher/demands/${demandId}`);
    await expect(teacherSession.page.getByText("你還沒有填聯絡方式，團主目前聯絡不到你。", { exact: false })).toBeVisible();
    await expect(teacherSession.page.getByRole("link", { name: "填寫聯絡方式" })).toHaveAttribute("href", "/teacher/profile/payment");
    await teacherSession.context.close();
  });

  test("organization contact cleared after submission: both sides are told who must fill it in", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "contact-none");
    const { organizer, demandId, teachers } = await setupResponses(id, { selectedHasContact: false });
    expect((await selectDemandResponseForOrganizer(organizer.organizerProfileId, teachers[0].responseId)).ok).toBe(true);
    // 送審後團主在「我的團體」把聯絡欄位清空（目前的編輯驗證允許）。
    await prisma.organization.update({
      where: { id: organizer.organizationId },
      data: { contactName: null, contactEmail: null, contactPhone: null },
    });

    const teacherSession = await asUser(browser, teachers[0].sessionToken);
    await teacherSession.page.goto(`/teacher/demands/${demandId}`);
    await expect(teacherSession.page.getByText("團主尚未填寫", { exact: true })).toHaveCount(3);
    await expect(
      teacherSession.page.getByText("團主目前沒有留下聯絡方式，請先到老師資料填寫你的聯絡方式，讓團主聯絡你。"),
    ).toBeVisible();
    await teacherSession.context.close();

    const organizerSession = await asUser(browser, organizer.sessionToken);
    const page = organizerSession.page;
    await page.goto(`/organizer/demands/${demandId}`);
    await expect(
      page.getByText("你和老師目前都沒有可用的聯絡方式。請先補齊團體聯絡資料，老師才聯絡得到你。", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: "補齊團體聯絡資料" }).click();
    await expect(page).toHaveURL(new RegExp(`/organizer/organizations/${organizer.organizationId}\\?returnTo=`));
    await page.getByLabel("聯絡窗口姓名").fill(`新窗口 ${id}`);
    await page.getByLabel("聯絡信箱").fill(`new-${id}@example.com`);
    await page.getByLabel("聯絡電話").fill("0922333444");
    await page.getByRole("button", { name: "儲存並回到剛剛的頁面" }).click();
    await expect(page).toHaveURL(new RegExp(`/organizer/demands/${demandId}$`));
    await expect(page.getByText("老師還沒留下聯絡方式。老師看得到你團體的聯絡窗口，會主動跟你聯絡確認時間。")).toBeVisible();
    await organizerSession.context.close();
  });
});
