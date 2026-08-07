import { expect, test } from "@playwright/test";

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
  serviceType: "Hatha Yoga",
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

    await page.locator("#weekly-title").fill(baseSeriesInput.title);
    await page.locator("#weekly-serviceType").selectOption(baseSeriesInput.serviceType);
    await page.locator("#weekly-dayOfWeek").selectOption("1");
    await page.locator("#weekly-startTime").fill(baseSeriesInput.startTime);
    await page.locator("#weekly-endTime").fill(baseSeriesInput.endTime);
    await page.locator("#weekly-location").fill(baseSeriesInput.location);
    await page.locator("#weekly-capacity").fill(String(baseSeriesInput.capacity));
    await page.locator("#weekly-generateCount").fill("3");
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
    const seriesLink = page.getByRole("link", { name: `系列：${baseSeriesInput.title}` }).first();
    await expect(seriesLink).toBeVisible();
    await expect(seriesLink).toHaveAttribute("href", `/teacher/classes/series/${series.id}`);
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
      serviceType: "Hatha Yoga",
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
    await page.locator("#fixed-serviceType").selectOption(baseSeriesInput.serviceType);
    await page.locator("#fixed-startTime").fill(baseSeriesInput.startTime);
    await page.locator("#fixed-endTime").fill(baseSeriesInput.endTime);
    await page.locator("#fixed-location").fill(baseSeriesInput.location);
    await page.locator("#fixed-capacity").fill(String(baseSeriesInput.capacity));
    await page.locator("#fixed-dates").fill("2026-10-05\n2026-10-12\n2026-10-19");
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
