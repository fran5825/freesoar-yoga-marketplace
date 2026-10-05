import { expect, test, type Page } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateString, futureDateTime, futureWeekdayDateString } from "./_helpers/future-dates";
import { addFixedDate, pickServiceType } from "./_helpers/class-form";
import { selectFormTime } from "./_helpers/time-select";
import { isResubmitBlocked } from "../../src/app/teacher/classes/new/_lib/form-state";

// teacher-usability-redesign 票 01、02：開課的結果驗證——
// 失敗留在原頁且保留輸入與摘要、摘要＝實際建立的值、成功只建立草稿、未建立就離頁會提醒。

const testEmailDomain = "teacher-class-usability-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedApprovedTeacher(testRunId: string) {
  const email = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({
    email,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
}

async function fillSingleClass(
  page: Page,
  input: { title: string; date: string; start: string; end: string; location: string; capacity: string },
) {
  await page.locator("#title").fill(input.title);
  await pickServiceType(page, "放鬆紓壓");
  await page.getByText("哈達瑜伽", { exact: true }).click();
  await page.locator("#single-date").fill(input.date);
  await selectFormTime(page, "single-", "start", input.start);
  await selectFormTime(page, "single-", "end", input.end);
  await page.locator("#location").fill(input.location);
  await page.locator("#capacity").fill(input.capacity);
}

function summary(page: Page) {
  return page.getByRole("region", { name: "建立前核對" });
}

test.describe("resubmit guard for uncertain create results (pure helper)", () => {
  const error = (mode: "single" | "weekly" | "fixed_dates", code: string) =>
    ({ status: "error", mode, code, message: "", fieldErrors: {} }) as const;

  test("blocks resubmit when the write may already have happened, allows it when the failure is before any write", () => {
    expect(isResubmitBlocked({ status: "idle" })).toBe(false);
    expect(isResubmitBlocked(error("weekly", "series_create_failed"))).toBe(true);
    expect(isResubmitBlocked(error("single", "result_unknown"))).toBe(true);
    // 系列寫入後才失去資格，之後恢復資格再重送會多一個系列：保守擋住。
    expect(isResubmitBlocked(error("weekly", "teacher_not_approved"))).toBe(true);
    expect(isResubmitBlocked(error("fixed_dates", "teacher_not_approved"))).toBe(true);
    // 單堂的資格檢查在寫入前。
    expect(isResubmitBlocked(error("single", "teacher_not_approved"))).toBe(false);
    expect(isResubmitBlocked(error("weekly", "validation_failed"))).toBe(false);
    expect(isResubmitBlocked(error("single", "teacher_schedule_conflict"))).toBe(false);
  });
});

test.describe("teacher single-class creation usability (ticket 01)", () => {
  test("a schedule conflict keeps every input and the summary on the page; fixing the date creates exactly one private draft and opens its detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-conflict-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const existing = validateClassSessionCreate({
      title: `既有課程 ${testRunId}`,
      serviceType: "放鬆紓壓",
      startAt: futureDateTime(40, "10:00"),
      endAt: futureDateTime(40, "11:00"),
      location: "台北市既有教室",
      capacity: 10,
    });
    if (!existing.valid) throw new Error("unexpected invalid fixture");
    const seeded = await createClassSessionForTeacher(teacher.teacherProfileId, existing.normalized);
    expect(seeded.ok).toBe(true);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");

    // 三區與三種排程入口都看得到；單堂沒有泛用確認勾選，改成建立前核對摘要。
    for (const heading of ["課程內容", "時間地點", "報名設定"]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    for (const modeLabel of ["單堂", "每週固定", "指定日期"]) {
      await expect(page.getByRole("button", { name: modeLabel, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "單堂", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("checkbox", { name: /我確認以上資訊無誤/ })).toHaveCount(0);
    await expect(page.locator("#isPublic-no")).toBeChecked();

    const title = `衝突修正課 ${testRunId}`;
    const longLocation = `台北市大安區很長很長的地址測試路一段一百二十三巷四十五弄六十七號八樓之九 ${testRunId}`;
    await fillSingleClass(page, {
      title,
      date: futureDateString(40),
      start: "10:30",
      end: "11:30",
      location: longLocation,
      capacity: "12",
    });
    await page.getByRole("button", { name: "建立課程" }).click();

    // 服務拒絕：留在原頁、錯誤說得清楚、輸入與摘要都還在、沒有多建任何一堂。
    await expect(page.getByRole("alert").filter({ hasText: "課程還沒建立" })).toBeVisible();
    await expect(page.locator("#single-time-error")).toContainText("這個時段已經有其他課程");
    await expect(page).toHaveURL(/\/teacher\/classes\/new$/);
    await expect(page.locator("#title")).toHaveValue(title);
    await expect(page.locator("#location")).toHaveValue(longLocation);
    await expect(page.locator("#capacity")).toHaveValue("12");
    await expect(page.getByRole("checkbox", { name: "哈達瑜伽" })).toBeChecked();
    await expect(summary(page)).toContainText(title);
    await expect(summary(page)).toContainText("10:30–11:30");
    expect(
      await prisma.classSession.count({ where: { teacherProfileId: teacher.teacherProfileId } }),
    ).toBe(1);

    // 改日期後錯誤收起，再送一次就建立成功。
    await page.locator("#single-date").fill(futureDateString(41));
    await expect(page.locator("#single-time-error")).toHaveCount(0);
    await page.getByRole("button", { name: "建立課程" }).click();

    await expect(page.getByText("課程已建立。下一步：確認內容後按「開放報名」。")).toBeVisible();
    const created = await prisma.classSession.findMany({
      where: { teacherProfileId: teacher.teacherProfileId, title },
      select: { id: true, status: true, isPublic: true },
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ status: "draft", isPublic: false });
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${created[0].id}\\?`));
  });

  test("the summary shows exactly what gets created, including the public-listing and approval choices", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-summary-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");

    await expect(summary(page)).toContainText("尚未填寫");
    const date = futureDateString(45);
    const title = `摘要核對課 ${testRunId}`;
    await fillSingleClass(page, {
      title,
      date,
      start: "19:05",
      end: "20:35",
      location: "新北市板橋區摘要教室",
      capacity: "8",
    });
    await page.locator("#isPublic-yes").check();
    await page.locator("#requiresApproval").check();

    await expect(summary(page)).toContainText(title);
    await expect(summary(page)).toContainText(date);
    await expect(summary(page)).toContainText("19:05–20:35（24 小時制）");
    await expect(summary(page)).toContainText("新北市板橋區摘要教室");
    await expect(summary(page)).toContainText("8 人");
    await expect(summary(page)).toContainText("列在公開課程列表");
    await expect(summary(page)).toContainText("需要你確認才算報名成功");
    await expect(summary(page)).toContainText("建立後，開課前都還可以在課程頁修改內容、時間、地點與名額。");
    await expect(summary(page)).toContainText("不會立即開放報名");

    // 成功建立的導向不該跳出離頁提醒。
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page.getByText("課程已建立。")).toBeVisible();
    expect(dialogs).toEqual([]);

    const created = await prisma.classSession.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title },
      select: {
        status: true,
        isPublic: true,
        requiresApproval: true,
        location: true,
        capacity: true,
        startAt: true,
        endAt: true,
      },
    });
    expect(created).toMatchObject({
      status: "draft",
      isPublic: true,
      requiresApproval: true,
      location: "新北市板橋區摘要教室",
      capacity: 8,
    });
    // 台北時間 19:05–20:35＝UTC 11:05–12:35。
    expect(created.startAt.toISOString()).toBe(`${date}T11:05:00.000Z`);
    expect(created.endAt.toISOString()).toBe(`${date}T12:35:00.000Z`);
  });

  test("leaving with unsaved input asks first and cancelling keeps the form; an untouched form with prefilled defaults leaves without asking", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-leave-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    // 先建一堂，讓表單帶入上次的地點／名額（預填不算使用者改動）。
    const previous = validateClassSessionCreate({
      title: `上次的課 ${testRunId}`,
      serviceType: "放鬆紓壓",
      startAt: futureDateTime(50, "09:00"),
      endAt: futureDateTime(50, "10:00"),
      location: "台中市預設教室",
      capacity: 9,
    });
    if (!previous.valid) throw new Error("unexpected invalid fixture");
    expect((await createClassSessionForTeacher(teacher.teacherProfileId, previous.normalized)).ok).toBe(true);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await expect(page.locator("#location")).toHaveValue("台中市預設教室");

    const navLink = page.locator('a[href="/teacher/dashboard"]:visible').first();
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    // 改了內容：點站內連結會先問，按取消就留在原表單、內容還在。
    await page.locator("#title").fill(`還沒建立 ${testRunId}`);
    await navLink.click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain("這堂課還沒建立");
    await expect(page).toHaveURL(/\/teacher\/classes\/new$/);
    await expect(page.locator("#title")).toHaveValue(`還沒建立 ${testRunId}`);

    // 改回原狀（等於沒動過）：直接離開，不再詢問。
    await page.locator("#title").fill("");
    await navLink.click();
    await expect(page).toHaveURL(/\/teacher\/dashboard/);
    expect(dialogs).toHaveLength(1);
  });

  test("weekly series: a rejected start date keeps every input; the summary lists the exact dates that then get created as non-public drafts", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-weekly-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定" }).click();
    await expect(page.locator("#weekly-confirmCreate")).toHaveCount(0);
    await expect(summary(page)).toContainText("不列在公開課程列表");

    const title = `每週系列 ${testRunId}`;
    await page.locator("#weekly-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    // 起始日期填今天：瀏覽器端不擋，由既有驗證拒絕（需晚於今天）。
    await page.locator("#weekly-startDate").fill(futureDateString(0));
    await selectFormTime(page, "weekly-", "start", "18:00");
    await selectFormTime(page, "weekly-", "end", "19:00");
    await page.locator("#weekly-location").fill("台北市每週教室");
    await page.locator("#weekly-capacity").fill("6");
    await page.locator("#weekly-generateCount").fill("3");
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "課程系列還沒建立" })).toBeVisible();
    await expect(page.locator("#weekly-startDate-error")).toContainText("起始日期需晚於今天");
    await expect(page.locator("#weekly-startDate")).toBeFocused();
    await expect(page.locator("#weekly-title")).toHaveValue(title);
    await expect(page.locator("#weekly-generateCount")).toHaveValue("3");
    await expect(page.locator("#weekly-location")).toHaveValue("台北市每週教室");
    expect(
      await prisma.recurringClassSeries.count({ where: { teacherProfileId: teacher.teacherProfileId } }),
    ).toBe(0);

    // 改成兩週後的同一個星期幾：摘要列出 3 個實際日期，建立結果要完全一樣。
    const weekday = Number(await page.locator("#weekly-dayOfWeek").inputValue());
    const startDate = futureWeekdayDateString(14, weekday);
    await page.locator("#weekly-startDate").fill(startDate);
    await expect(page.locator("#weekly-startDate-error")).toHaveCount(0);
    const summaryDates = summary(page).getByRole("list", { name: "會建立的上課日期" }).getByRole("listitem");
    await expect(summaryDates).toHaveCount(3);
    await expect(summaryDates.first()).toContainText(startDate);
    const listedDates = (await summaryDates.allTextContents()).map((text) => text.slice(0, 10));

    await page.getByRole("button", { name: "建立課程系列" }).click();
    await expect(page.getByText(/課程系列已建立，共生成 3 場。每一場目前都是草稿，確認沒問題後按「全部開放報名」/)).toBeVisible();

    const sessions = await prisma.classSession.findMany({
      where: { teacherProfileId: teacher.teacherProfileId, recurringClassSeriesId: { not: null } },
      orderBy: { startAt: "asc" },
      select: { startAt: true, status: true, isPublic: true },
    });
    expect(sessions.map((session) => taipeiDate(session.startAt))).toEqual(listedDates);
    expect(sessions.every((session) => session.status === "draft" && !session.isPublic)).toBe(true);
  });

  test("fixed-dates series: a rejected time keeps the picked dates; the summary lists exactly the dates that get created", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-fixed-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "指定日期" }).click();

    const title = `指定日期系列 ${testRunId}`;
    const dates = [futureDateString(20), futureDateString(27)];
    await page.locator("#fixed-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    for (const date of dates) {
      await addFixedDate(page, date);
    }
    // 結束早於開始：畫面會提醒但不擋送出，由既有驗證拒絕。
    await selectFormTime(page, "fixed-", "start", "20:00");
    await selectFormTime(page, "fixed-", "end", "19:00");
    await page.locator("#fixed-location").fill("台北市指定日期教室");
    await page.locator("#fixed-capacity").fill("5");
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "課程系列還沒建立" })).toBeVisible();
    await expect(page.locator("#fixed-time-error")).toBeVisible();
    const pickedDates = page.getByRole("list", { name: "已加入的上課日期" }).getByRole("listitem");
    await expect(pickedDates).toHaveCount(2);
    const summaryDates = summary(page).getByRole("list", { name: "會建立的上課日期" }).getByRole("listitem");
    await expect(summaryDates).toHaveCount(2);
    expect(
      await prisma.recurringClassSeries.count({ where: { teacherProfileId: teacher.teacherProfileId } }),
    ).toBe(0);

    await selectFormTime(page, "fixed-", "end", "21:00");
    await expect(page.locator("#fixed-time-error")).toHaveCount(0);
    await expect(summary(page)).toContainText("20:00–21:00");
    await page.getByRole("button", { name: "建立課程系列" }).click();
    await expect(page.getByText(/課程系列已建立，共生成 2 場/)).toBeVisible();

    const sessions = await prisma.classSession.findMany({
      where: { teacherProfileId: teacher.teacherProfileId },
      orderBy: { startAt: "asc" },
      select: { startAt: true, status: true, isPublic: true },
    });
    expect(sessions.map((session) => taipeiDate(session.startAt))).toEqual(dates);
    expect(sessions.every((session) => session.status === "draft" && !session.isPublic)).toBe(true);
  });
});

function taipeiDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}
