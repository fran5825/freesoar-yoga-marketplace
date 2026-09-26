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
      yogaStyles: ["陰瑜珈"],
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
    await page.goto("/teacher/classes");

    const card = page.locator(`a[href="/teacher/classes/${classSessionId}"]`);
    await expect(card).toContainText("草稿：請開放報名");
    await expect(card).toContainText("已報名 0 / 8 人");
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSessionId}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("region", { name: "下一步" })).toContainText("開放報名");

    // 區塊順序：下一步 → 報名狀況 → 課程內容 → 課程操作。
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toEqual(["下一步", "報名狀況", "課程內容", "課程操作"]);
    await expect(page.getByText("放鬆紓壓", { exact: true })).toBeVisible();
    await expect(page.getByText("陰瑜珈", { exact: true })).toBeVisible();

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
    await page.getByText("修復瑜珈", { exact: true }).click();
    await page.locator("#single-date").fill(futureDateString(84));
    await selectFormTime(page, "single-", "start", "19:00");
    await selectFormTime(page, "single-", "end", "20:00");
    await page.getByRole("checkbox", { name: /我確認以上資訊無誤/ }).check();
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
