import { expect, test } from "@playwright/test";

import { addFixedDate, pickServiceType } from "./_helpers/class-form";
import { futureWeekdayDateString } from "./_helpers/future-dates";
import { selectFormTime } from "./_helpers/time-select";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { cancelClassSessionForTeacher } from "../../src/domain/class-session/__internal__/cancel-class-session-core-for-teacher";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
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

const testEmailDomain = "teacher-recurring-class-series-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
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
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail);
  return createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
}

const baseSeriesInput = {
  title: "常規課程系列測試",
  description: "測試用系列說明。",
  serviceType: "伸展與身體保養",
  startTime: "10:00",
  endTime: "11:00",
  location: "台北市信義區測試教室",
  capacity: 15,
};

test.describe("teacher recurring class series smoke", () => {
  test("lets an approved teacher create a weekly series through the UI; each occurrence is an independent ClassSession on the right weekday, evenly spaced a week apart", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-weekly-ui-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "常規（每週固定星期）" }).click();

    // 起始日期必須是選定的星期幾（這裡是週一）。
    const weeklyStartDate = futureWeekdayDateString(60, 1);
    await page.locator("#weekly-title").fill(baseSeriesInput.title);
    await pickServiceType(page, baseSeriesInput.serviceType);
    await page.locator("#weekly-dayOfWeek").selectOption("1");
    await selectFormTime(page, "weekly-", "start", baseSeriesInput.startTime);
    await selectFormTime(page, "weekly-", "end", baseSeriesInput.endTime);
    await page.locator("#weekly-location").fill(baseSeriesInput.location);
    await page.locator("#weekly-capacity").fill(String(baseSeriesInput.capacity));
    await page.locator("#weekly-generateCount").fill("3");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    // 選填的起始日期：第一場是這一天（含）起的第一個週一。
    await page.locator("#weekly-startDate").fill(weeklyStartDate);
    await page.locator("#weekly-confirmCreate").check();
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/課程系列已建立，共生成 3 場/)).toBeVisible();
    await expect(page.getByRole("heading", { name: baseSeriesInput.title })).toBeVisible();
    await expect(page.getByText("已生成場次（3）")).toBeVisible();
    // dayOfWeek !== null，「生成更多」表單應該顯示。
    await expect(page.getByRole("button", { name: "生成", exact: true })).toBeVisible();

    const series = await prisma.recurringClassSeries.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title: baseSeriesInput.title },
      include: { classSessions: { orderBy: { startAt: "asc" } } },
    });
    expect(series.dayOfWeek).toBe(1);
    expect(series.classSessions).toHaveLength(3);
    const firstDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(series.classSessions[0].startAt);
    expect(firstDate).toBe(weeklyStartDate);
    // 瑜伽類型存在系列上，並且複製到每一場。
    expect(series.yogaStyles).toEqual(["哈達瑜伽"]);
    for (const classSession of series.classSessions) {
      expect(classSession.yogaStyles).toEqual(["哈達瑜伽"]);
    }

    for (const classSession of series.classSessions) {
      expect(classSession.origin).toBe("teacher_initiated");
      expect(classSession.recurringClassSeriesId).toBe(series.id);
      expect(classSession.organizerProfileId).toBeNull();
      // 週一：用 Intl 明確指定 Asia/Taipei 判斷，不依賴伺服器執行時區。
      const weekdayLabel = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Taipei",
        weekday: "short",
      }).format(classSession.startAt);
      expect(weekdayLabel).toBe("Mon");
      expect(classSession.startAt.getTime()).toBeGreaterThan(Date.now());
    }

    for (let i = 1; i < series.classSessions.length; i++) {
      const gapMs =
        series.classSessions[i].startAt.getTime() - series.classSessions[i - 1].startAt.getTime();
      expect(gapMs).toBe(7 * 24 * 3600_000);
    }

    // Slice E：/teacher/classes 統一列表要能看到「這一場屬於哪個系列」，且能點回系列管理頁。
    await page.goto("/teacher/classes");
    await expect(page.getByText(`系列：${baseSeriesInput.title}`).first()).toBeVisible();
    // 系列管理頁的連結在單堂課詳情頁（列表卡片整張已經是連結，不能再包一個連結）。
    await page.goto(`/teacher/classes/${series.classSessions[0].id}`);
    const seriesLink = page.getByRole("link", { name: `系列：${baseSeriesInput.title}` });
    await expect(seriesLink).toBeVisible();
    await expect(seriesLink).toHaveAttribute("href", `/teacher/classes/series/${series.id}`);
  });

  test("weekly start date must match the chosen weekday: picking a start date first fills in the weekday, and a mismatch shows an error and blocks submit", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-weekday-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "常規（每週固定星期）" }).click();

    // 還沒選星期幾：選起始日期（一個週四）會自動帶入週四。
    const thursday = futureWeekdayDateString(30, 4);
    await page.locator("#weekly-startDate").fill(thursday);
    await expect(page.locator("#weekly-dayOfWeek")).toHaveValue("4");
    await expect(page.getByRole("alert").filter({ hasText: "起始日期" })).toHaveCount(0);

    // 改成週一：起始日期（週四）不符，顯示錯誤，送出會被擋下。
    await page.locator("#weekly-dayOfWeek").selectOption("1");
    await expect(page.getByText(`起始日期 ${thursday} 是週四，跟上面選的週一不同`)).toBeVisible();

    await page.locator("#weekly-title").fill(`星期檢查 ${testRunId}`);
    await pickServiceType(page, baseSeriesInput.serviceType);
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await selectFormTime(page, "weekly-", "start", "10:00");
    await selectFormTime(page, "weekly-", "end", "11:00");
    await page.locator("#weekly-location").fill(baseSeriesInput.location);
    await page.locator("#weekly-capacity").fill("10");
    await page.locator("#weekly-confirmCreate").check();
    await page.getByRole("button", { name: "建立課程系列" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/new$/);
    expect(
      await prisma.recurringClassSeries.count({
        where: { teacherProfileId: teacher.teacherProfileId },
      }),
    ).toBe(0);
  });

  test("keeps filled-in fields when switching between single, weekly and fixed-dates modes, and uses a 24-hour time picker", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-keep-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");

    await page.locator("#title").fill("切換保留測試");
    await pickServiceType(page, baseSeriesInput.serviceType);
    await selectFormTime(page, "single-", "start", "12:00");
    await selectFormTime(page, "single-", "end", "13:30");
    await page.locator("#location").fill("台北市測試教室");
    await page.locator("#capacity").fill("15");
    await page.locator("#description").fill("說明內容");

    // 24 小時制：小時選項是 00–23，沒有上午／下午。
    await expect(page.locator("#single-startTime-hour option")).toHaveCount(25); // 24 個小時 + 占位「時」
    await expect(page.locator("#single-startTime-hour")).toHaveValue("12");
    await expect(page.getByText("12:00 是中午")).toBeVisible();

    await page.getByRole("button", { name: "常規（每週固定星期）" }).click();
    await expect(page.locator("#weekly-title")).toHaveValue("切換保留測試");
    await expect(page.getByRole("checkbox", { name: baseSeriesInput.serviceType })).toBeChecked();
    await expect(page.locator("#weekly-startTime-hour")).toHaveValue("12");
    await expect(page.locator("#weekly-endTime-minute")).toHaveValue("30");
    await expect(page.locator("#weekly-location")).toHaveValue("台北市測試教室");
    await expect(page.locator("#weekly-capacity")).toHaveValue("15");
    await expect(page.locator("#weekly-description")).toHaveValue("說明內容");
    await page.locator("#weekly-dayOfWeek").selectOption("3");

    await page.getByRole("button", { name: "固定期（明確日期清單）" }).click();
    await expect(page.locator("#fixed-title")).toHaveValue("切換保留測試");
    await expect(page.locator("#fixed-startTime-hour")).toHaveValue("12");

    // 回到常規模式：模式專屬欄位（星期幾）也還在。
    await page.getByRole("button", { name: "常規（每週固定星期）" }).click();
    await expect(page.locator("#weekly-dayOfWeek")).toHaveValue("3");

    // 回到單堂：內容還在。
    await page.getByRole("button", { name: "單堂" }).click();
    await expect(page.locator("#title")).toHaveValue("切換保留測試");
    await expect(page.locator("#single-endTime-hour")).toHaveValue("13");
  });

  test("creates a fixed-dates series through the UI, one ClassSession per date; a date colliding with an existing class is skipped and clearly listed, without failing the rest of the batch; the series page never offers 「生成更多」 for a fixed-dates series", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-fixed-conflict-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    const conflictingInput = validateClassSessionCreate({
      title: "既有課程",
      serviceType: "伸展與身體保養",
      startAt: "2026-10-12T10:00",
      endAt: "2026-10-12T11:00",
      location: "台北市信義區測試教室",
      capacity: 10,
      isPublic: false,
    });
    if (!conflictingInput.valid) throw new Error("unexpected invalid input in test fixture");
    const existing = await createClassSessionForTeacher(
      teacher.teacherProfileId,
      conflictingInput.normalized,
    );
    if (!existing.ok) throw new Error("unexpected create failure in test fixture");

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "固定期（明確日期清單）" }).click();

    await page.locator("#fixed-title").fill(baseSeriesInput.title);
    await pickServiceType(page, baseSeriesInput.serviceType);
    await selectFormTime(page, "fixed-", "start", baseSeriesInput.startTime);
    await selectFormTime(page, "fixed-", "end", baseSeriesInput.endTime);
    await page.locator("#fixed-location").fill(baseSeriesInput.location);
    await page.locator("#fixed-capacity").fill(String(baseSeriesInput.capacity));
    await addFixedDate(page, "2026-10-19");
    await addFixedDate(page, "2026-10-05");
    await addFixedDate(page, "2026-10-12");
    // 日期清單會自動由早到晚排序；再點一次月曆上的日子會取消。
    await expect(page.getByRole("list", { name: "已加入的上課日期" }).getByRole("listitem")).toHaveText([
      /2026-10-05/,
      /2026-10-12/,
      /2026-10-19/,
    ]);
    await addFixedDate(page, "2026-10-26");
    await expect(page.getByText("已選 4 / 26")).toBeVisible();
    await addFixedDate(page, "2026-10-26");
    await expect(page.getByText("已選 3 / 26")).toBeVisible();
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await page.locator("#fixed-confirmCreate").check();
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/共生成 2 場/)).toBeVisible();
    await expect(page.getByText(/2026-10-12/)).toBeVisible();
    await expect(page.getByText("已生成場次（2）")).toBeVisible();
    // dayOfWeek === null（固定期），「生成更多」表單不該出現。
    await expect(page.getByRole("button", { name: "生成", exact: true })).toBeHidden();

    const series = await prisma.recurringClassSeries.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title: baseSeriesInput.title },
      include: { classSessions: true },
    });
    expect(series.classSessions).toHaveLength(2);

    // 既有那堂課完全不受影響，也沒有被誤掛到新系列底下。
    const untouchedExisting = await prisma.classSession.findUniqueOrThrow({
      where: { id: existing.classSessionId },
      select: { status: true, recurringClassSeriesId: true },
    });
    expect(untouchedExisting.recurringClassSeriesId).toBeNull();
    expect(untouchedExisting.status).toBe("draft");
  });

  test("lets a teacher generate more occurrences for a weekly series through the UI, strictly after the last existing occurrence, with no duplicate dates", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-generate-more-ui-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: baseSeriesInput.title,
        description: baseSeriesInput.description,
        serviceType: baseSeriesInput.serviceType,
        dayOfWeek: 3,
        startTime: baseSeriesInput.startTime,
        endTime: baseSeriesInput.endTime,
        location: baseSeriesInput.location,
        capacity: baseSeriesInput.capacity,
      },
    });
    const firstBatch = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(3, 2),
    );
    if (!firstBatch.ok) throw new Error("unexpected error in test fixture");

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/series/${series.id}`);
    await expect(page.getByText("已生成場次（2）")).toBeVisible();

    await page.getByLabel("生成更多場次").fill("2");
    await page.getByRole("button", { name: "生成", exact: true }).click();

    await expect(page.getByText(/已生成 2 場/)).toBeVisible();
    await expect(page.getByText("已生成場次（4）")).toBeVisible();

    const allOccurrences = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
    });
    expect(allOccurrences).toHaveLength(4);

    const startTimes = allOccurrences.map((occurrence) => occurrence.startAt.getTime());
    expect(new Set(startTimes).size).toBe(4);
    for (let i = 1; i < startTimes.length; i++) {
      expect(startTimes[i]).toBeGreaterThan(startTimes[i - 1]);
    }
  });

  test("cancelling one occurrence does not affect the other occurrences in the same series", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cancel-one-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: baseSeriesInput.title,
        serviceType: baseSeriesInput.serviceType,
        dayOfWeek: 5,
        startTime: baseSeriesInput.startTime,
        endTime: baseSeriesInput.endTime,
        location: baseSeriesInput.location,
        capacity: baseSeriesInput.capacity,
      },
    });
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(5, 3),
    );
    if (!generated.ok) throw new Error("unexpected error in test fixture");

    const cancelResult = await cancelClassSessionForTeacher(
      teacher.teacherProfileId,
      generated.createdClassSessionIds[1],
    );
    expect(cancelResult).toEqual({ ok: true });

    const afterCancel = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
      select: { status: true },
    });
    expect(afterCancel.map((occurrence) => occurrence.status)).toEqual([
      "draft",
      "cancelled",
      "draft",
    ]);
  });

  test("lets a teacher cancel an entire series through the UI, only affecting future draft/open_for_enrollment occurrences and leaving an already-completed occurrence untouched", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cancel-series-ui-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: baseSeriesInput.title,
        serviceType: baseSeriesInput.serviceType,
        dayOfWeek: 4,
        startTime: baseSeriesInput.startTime,
        endTime: baseSeriesInput.endTime,
        location: baseSeriesInput.location,
        capacity: baseSeriesInput.capacity,
      },
    });
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(4, 3),
    );
    if (!generated.ok) throw new Error("unexpected error in test fixture");

    // 把第一場改成「已經上完」，模擬既有承諾不該被整批取消影響。
    await prisma.classSession.update({
      where: { id: generated.createdClassSessionIds[0] },
      data: {
        status: "completed",
        startAt: new Date(Date.now() - 2 * 3600_000),
        endAt: new Date(Date.now() - 3600_000),
      },
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/series/${series.id}`);
    await page.getByRole("button", { name: "取消整個系列（僅影響尚未開始的場次）" }).click();

    await expect(page.getByText("已取消 2 場尚未開始的課程。")).toBeVisible();

    const finalStates = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
      select: { status: true },
    });
    expect(finalStates.map((occurrence) => occurrence.status)).toEqual([
      "completed",
      "cancelled",
      "cancelled",
    ]);
  });

  test("IDOR: generateOccurrencesForSeries refuses to generate into another teacher's series, and visiting the series page directly returns 404 for a non-owning teacher", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const teacherA = await seedApprovedTeacher(`${testRunId}-a`);
    const teacherB = await seedApprovedTeacher(`${testRunId}-b`);

    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacherA.teacherProfileId,
        title: baseSeriesInput.title,
        serviceType: baseSeriesInput.serviceType,
        dayOfWeek: 2,
        startTime: baseSeriesInput.startTime,
        endTime: baseSeriesInput.endTime,
        location: baseSeriesInput.location,
        capacity: baseSeriesInput.capacity,
      },
    });

    const attempt = await generateOccurrencesForSeries(
      teacherB.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(2, 2),
    );
    expect(attempt).toEqual({ ok: false, code: "series_not_found" });

    const seriesSessionCount = await prisma.classSession.count({
      where: { recurringClassSeriesId: series.id },
    });
    expect(seriesSessionCount).toBe(0);

    await addAuthSessionCookie(context, teacherB.sessionToken);
    const response = await page.goto(`/teacher/classes/series/${series.id}`);
    expect(response?.status()).toBe(404);
  });
});
