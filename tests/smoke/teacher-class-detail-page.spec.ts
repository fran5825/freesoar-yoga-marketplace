import { expect, test } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { getTeacherClassNextStep } from "../../src/domain/class-session/teacher-next-step";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { pickServiceType } from "./_helpers/class-form";
import { futureDateString, futureDateTime } from "./_helpers/future-dates";
import { selectFormTime } from "./_helpers/time-select";

// teacher-usability 第 06、07 票：單堂課詳情頁、列表卡片整張可點、建課後導向詳情頁、
// 建課表單帶入上一次的設定。

const testEmailDomain = "teacher-class-detail-page-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedTeacher(testRunId: string, label = "owner") {
  const email = `${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({
    email,
    displayName: `Teacher ${label} ${testRunId}`,
    status: "approved",
  });
}

async function seedClass(
  teacherProfileId: string,
  options: { title: string; daysFromToday: number; requiresApproval?: boolean; location?: string; capacity?: number },
) {
  const validation = validateClassSessionCreate(
    {
      title: options.title,
      description: "詳情頁測試用。",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["陰瑜伽"],
      startAt: futureDateTime(options.daysFromToday, "10:00"),
      endAt: futureDateTime(options.daysFromToday, "11:00"),
      location: options.location ?? "台北市詳情測試教室",
      capacity: options.capacity ?? 8,
      isPublic: false,
    },
    { requireYogaStyles: true },
  );
  if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

  const created = await createClassSessionForTeacher(teacherProfileId, {
    ...validation.normalized,
    requiresApproval: options.requiresApproval ?? false,
  });
  if (!created.ok) throw new Error("unexpected create failure in test fixture");
  return created.classSessionId;
}

test.describe("getTeacherClassNextStep (pure function)", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 3_600_000);

  test("pending enrollments come first, then draft / ended / open states, per origin", () => {
    expect(
      getTeacherClassNextStep({
        status: "open_for_enrollment",
        origin: "teacher_initiated",
        pendingEnrollmentCount: 2,
        endAt: future,
      }),
    ).toMatchObject({ kind: "action", shortMessage: "2 筆報名待確認" });
    expect(
      getTeacherClassNextStep({
        status: "draft",
        origin: "teacher_initiated",
        pendingEnrollmentCount: 0,
        endAt: future,
      }),
    ).toMatchObject({ kind: "action", shortMessage: "草稿：請開放報名" });
    expect(
      getTeacherClassNextStep({
        status: "draft",
        origin: "organizer_matched",
        pendingEnrollmentCount: 0,
        endAt: future,
      }).kind,
    ).toBe("waiting");
    expect(
      getTeacherClassNextStep({
        status: "open_for_enrollment",
        origin: "teacher_initiated",
        pendingEnrollmentCount: 0,
        endAt: past,
      }),
    ).toMatchObject({ kind: "action", shortMessage: "已結束：請標記完成" });
    expect(
      getTeacherClassNextStep({
        status: "open_for_enrollment",
        origin: "organizer_matched",
        pendingEnrollmentCount: 0,
        endAt: past,
      }).kind,
    ).toBe("waiting");
    expect(
      getTeacherClassNextStep({
        status: "cancelled",
        origin: "teacher_initiated",
        pendingEnrollmentCount: 0,
        endAt: future,
      }).kind,
    ).toBe("info");
  });
});

test.describe("teacher class detail page", () => {
  test("the list card links to the detail page, which shows next step, enrollments, content and actions in that order; open-for-enrollment returns to the detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-detail-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const title = `詳情頁課程 ${testRunId}`;
    const classSessionId = await seedClass(teacher.teacherProfileId, {
      title,
      daysFromToday: 80,
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    // teacher-usability-redesign 票 04：我的課程預設只列「即將上課」，草稿在「草稿」分頁；卡片連結帶著返回分頁。
    await page.goto("/teacher/classes?tab=drafts");

    const card = page.locator(`a[href^="/teacher/classes/${classSessionId}"]`);
    await expect(card).toContainText("草稿：請開放報名");
    await expect(card).toContainText("已報名 0 / 8 人");
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSessionId}\\?from=list&tab=drafts$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("region", { name: "下一步" })).toContainText("開放報名");

    // 區塊順序（票 03）：課程重點（含下一步與開放報名）→ 草稿先看課程內容 → 報名狀況 → 取消這堂課。
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toEqual(["課程重點", "課程內容", "報名狀況", "取消這堂課"]);
    await expect(page.getByText("放鬆紓壓", { exact: true })).toBeVisible();
    await expect(page.getByText("陰瑜伽", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "開放報名" }).click();
    await expect(page.getByText("已開放報名。")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSessionId}\\?`));
    await expect(page.getByText("已報名會員（0 人）")).toBeVisible();
    await expect(page.getByRole("button", { name: "開放報名" })).toBeHidden();
  });

  test("pending enrollments show as the next step and can be confirmed on the detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-pending-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const classSessionId = await seedClass(teacher.teacherProfileId, {
      title: `待確認課程 ${testRunId}`,
      daysFromToday: 81,
      requiresApproval: true,
    });
    await prisma.classSession.update({
      where: { id: classSessionId },
      data: { status: "open_for_enrollment" },
    });
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { userId } = await createUserSession({ email: memberEmail });
    await prisma.enrollment.create({
      data: { userId, classSessionId, status: "pending", consentedAt: new Date(), notes: "第一次上課" },
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${classSessionId}`);

    await expect(page.getByRole("region", { name: "下一步" })).toContainText("有 1 筆報名等你確認");
    await expect(page.getByText("待確認報名（1 人）")).toBeVisible();
    await expect(page.getByText("第一次上課")).toBeVisible();

    await page.getByRole("button", { name: "確認報名" }).click();
    await expect(page.getByText("已確認這筆報名。")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSessionId}\\?`));
    await expect(page.getByText("已報名會員（1 人）")).toBeVisible();
  });

  test("another teacher's class detail page is a 404", async ({ context, page }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const owner = await seedTeacher(testRunId, "owner");
    const intruder = await seedTeacher(testRunId, "intruder");
    const classSessionId = await seedClass(owner.teacherProfileId, {
      title: `別人的課 ${testRunId}`,
      daysFromToday: 82,
    });

    await addAuthSessionCookie(context, intruder.sessionToken);
    const response = await page.goto(`/teacher/classes/${classSessionId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(`別人的課 ${testRunId}`)).toHaveCount(0);
  });

  test("the create form pre-fills location, capacity and approval from the last own class, and creating a single class lands on its detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-defaults-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);

    // 還沒開過課：沒有預設值。
    await page.goto("/teacher/classes/new");
    await expect(page.locator("#location")).toHaveValue("");

    await seedClass(teacher.teacherProfileId, {
      title: `上一堂課 ${testRunId}`,
      daysFromToday: 83,
      location: "新北市板橋區預設教室",
      capacity: 14,
      requiresApproval: true,
    });

    await page.goto("/teacher/classes/new");
    await expect(page.locator("#location")).toHaveValue("新北市板橋區預設教室");
    await expect(page.locator("#capacity")).toHaveValue("14");
    await expect(page.locator("#requiresApproval")).toBeChecked();
    await expect(page.getByText("已帶入你上一次開課的設定")).toBeVisible();

    const title = `新的單堂課 ${testRunId}`;
    await page.locator("#title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("修復瑜伽", { exact: true }).click();
    await page.locator("#single-date").fill(futureDateString(84));
    await selectFormTime(page, "single-", "start", "19:00");
    await selectFormTime(page, "single-", "end", "20:00");
    await page.getByRole("button", { name: "建立課程" }).click();

    await expect(page.getByText("課程已建立。下一步：確認內容後按「開放報名」。")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const created = await prisma.classSession.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title },
      select: { id: true, location: true, capacity: true, requiresApproval: true },
    });
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${created.id}\\?`));
    expect(created).toMatchObject({
      location: "新北市板橋區預設教室",
      capacity: 14,
      requiresApproval: true,
    });
  });
});

// teacher-usability-redesign 票 03：頂端課程重點、婉拒／取消先確認影響、確認視窗可返回且不寫入。
test.describe("teacher class detail actions (ticket 03)", () => {
  test("decline and cancel open a confirm dialog with the real impact; backing out (button or Escape) writes nothing and returns focus; confirming does", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-dialogs-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const title = `確認視窗課程 ${testRunId}`;
    const classSessionId = await seedClass(teacher.teacherProfileId, {
      title,
      daysFromToday: 83,
      requiresApproval: true,
      capacity: 10,
    });
    await prisma.classSession.update({
      where: { id: classSessionId },
      data: { status: "open_for_enrollment" },
    });
    const memberIds: string[] = [];
    for (const label of ["a", "b"]) {
      const memberEmail = `member-${label}-${testRunId}@${testEmailDomain}`;
      createdEmails.push(memberEmail);
      const { userId } = await createUserSession({ email: memberEmail });
      await prisma.user.update({ where: { id: userId }, data: { name: `學員${label.toUpperCase()} ${testRunId}` } });
      memberIds.push(userId);
      await prisma.enrollment.create({
        data: { userId, classSessionId, status: "pending", consentedAt: new Date(), notes: `備註${label}` },
      });
    }

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${classSessionId}`);

    // 頂端重點：人數與下一步，下一步旁邊就是前往確認報名。
    const overview = page.getByRole("region", { name: "課程重點" });
    await expect(overview).toContainText("0 / 10 人");
    await expect(overview).toContainText("2 人");
    await expect(overview.getByRole("link", { name: "前往確認報名" })).toBeVisible();

    // 直接確認：不跳視窗，人數更新、留在同一堂。
    await page.locator("li").filter({ hasText: "備註a" }).getByRole("button", { name: "確認報名" }).click();
    await expect(page.getByText("已確認這筆報名。")).toBeVisible();
    await expect(overview).toContainText("1 / 10 人");

    // 婉拒：先看到學員與課程；按「先不要」不寫入，焦點回到婉拒按鈕。
    const declineTrigger = page.getByRole("button", { name: `婉拒 學員B ${testRunId} 的報名` });
    await declineTrigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`學員B ${testRunId}`);
    await expect(dialog).toContainText(title);
    await expect(dialog.getByRole("button", { name: "先不要" })).toBeFocused();
    await dialog.getByRole("button", { name: "先不要" }).click();
    await expect(dialog).toBeHidden();
    await expect(declineTrigger).toBeFocused();
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: memberIds[1], classSessionId } })).status,
    ).toBe("pending");

    // 取消課程：視窗寫出日期與連帶影響；按 Escape 關閉也不寫入。
    await page.getByRole("button", { name: "取消課程" }).click();
    await expect(dialog).toContainText("目前已報名 1 人、待確認 1 人");
    await expect(dialog).toContainText("學員會收到通知");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "取消課程" })).toBeFocused();
    expect(
      (await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId } })).status,
    ).toBe("open_for_enrollment");

    // 確定婉拒才寫入。
    await declineTrigger.click();
    await dialog.getByRole("button", { name: "確定婉拒" }).click();
    await expect(page.getByText("已婉拒這筆報名。")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSessionId}\?`));
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: memberIds[1], classSessionId } })).status,
    ).toBe("cancelled");

    // 確定取消才寫入，已報名的那筆也一起取消。
    await page.getByRole("button", { name: "取消課程" }).click();
    await dialog.getByRole("button", { name: "確定取消課程" }).click();
    await expect(page.getByText("課程已取消。")).toBeVisible();
    expect(
      (await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId } })).status,
    ).toBe("cancelled");
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: memberIds[0], classSessionId } })).status,
    ).toBe("cancelled");
    // 已取消的課仍可查看，但不再有取消或開放的操作。
    await expect(page.getByRole("button", { name: "取消課程" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  });
});

// 複製報名連結：不公開的課（含系列場次）不在「找課程」，老師把連結傳給學員，學員登入後可打開。
test.describe("teacher copies the enrol link", () => {
  test("an open, non-public class offers a copy button whose link a signed-in member can open; a draft does not", async ({
    browser,
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-share-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const title = `分享連結課程 ${testRunId}`;
    const openId = await seedClass(teacher.teacherProfileId, { title, daysFromToday: 86 });
    const draftId = await seedClass(teacher.teacherProfileId, { title: `草稿 ${testRunId}`, daysFromToday: 87 });
    await prisma.classSession.update({ where: { id: openId }, data: { status: "open_for_enrollment" } });

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto(`/teacher/classes/${draftId}`);
    await expect(page.getByRole("button", { name: "複製報名連結" })).toHaveCount(0);

    await page.goto(`/teacher/classes/${openId}`);
    await expect(page.getByText("這堂課不在公開課程列表，請把報名連結傳給學員。")).toBeVisible();
    await page.getByRole("button", { name: "複製報名連結" }).click();
    await expect(page.getByRole("button", { name: "已複製連結" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`/classes/${openId}$`));

    // 另一位已登入的學員打開這個連結，看得到課程。
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { sessionToken } = await createUserSession({ email: memberEmail });
    const memberContext = await browser.newContext();
    await addAuthSessionCookie(memberContext, sessionToken);
    const memberPage = await memberContext.newPage();
    await memberPage.goto(copied);
    await expect(memberPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await memberContext.close();
  });
});
