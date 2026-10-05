import { expect, test } from "@playwright/test";
import type { Prisma } from "@prisma/client";

import { pickServiceType } from "./_helpers/class-form";
import { futureWeekdayDateString } from "./_helpers/future-dates";
import { selectFormTime } from "./_helpers/time-select";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { openAllDraftOccurrencesForTeacherProfile } from "../../src/domain/class-session/__internal__/open-all-draft-occurrences-core";
import { buildTeacherTodoItems } from "../../src/domain/class-session/teacher-next-step";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// teacher-class-scheduling 票 01：系列全部開放報名、生成更多改為系列鎖內單一 transaction、
// 總覽草稿合併卡片。
const testEmailDomain = "teacher-series-open-all-smoke.local";
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

async function seedTeacher(testRunId: string, label: string, status: "approved" | "suspended" = "approved") {
  const email = `teacher-${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label}`, status });
}

async function seedSeries(teacherProfileId: string, title: string, dayOfWeek: number | null = 2) {
  return prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title,
      description: "測試用系列說明。",
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北市測試教室",
      capacity: 10,
      requiresApproval: false,
    },
  });
}

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

// 生成更多的 resolver：比照 service 的作法，在系列鎖內讀最後一場再算日期。
function nextWeeklyResolver(dayOfWeek: number, count: number) {
  return async (tx: Prisma.TransactionClient, series: { id: string }) => {
    const latest = await tx.classSession.findFirst({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "desc" },
      select: { startAt: true },
    });

    return computeNextWeeklyOccurrenceDates(dayOfWeek, count, latest?.startAt);
  };
}

test.describe("series generation and open-all (domain)", () => {
  test("generating with openForEnrollment creates open sessions and notifies once per session after commit", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "gen-open"), "gen-open");
    const series = await seedSeries(teacher.teacherProfileId, "建立即開放系列");

    const result = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(2, 3),
      { openForEnrollment: true },
    );

    expect(result.ok).toBe(true);
    const sessions = await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id } });
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.status === "open_for_enrollment")).toBe(true);
    expect(
      await prisma.notification.count({
        where: { userId: teacher.userId, type: "class_session_created" },
      }),
    ).toBe(3);
  });

  test("a rollback after sessions are written leaves no sessions and sends no notifications", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "rollback"), "rollback");
    const series = await seedSeries(teacher.teacherProfileId, "回滾系列");

    await expect(
      generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 2), {
        onOccurrencesWritten: () => {
          throw new Error("forced rollback");
        },
      }),
    ).rejects.toThrow("forced rollback");

    expect(await prisma.classSession.count({ where: { recurringClassSeriesId: series.id } })).toBe(0);
    expect(
      await prisma.notification.count({
        where: { userId: teacher.userId, type: "class_session_created" },
      }),
    ).toBe(0);
  });

  test("two concurrent generate-more calls never produce duplicate dates", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "concurrent"), "concurrent");
    const series = await seedSeries(teacher.teacherProfileId, "同時生成系列");

    const [first, second] = await Promise.all([
      generateOccurrencesForSeries(teacher.teacherProfileId, series.id, nextWeeklyResolver(2, 2)),
      generateOccurrencesForSeries(teacher.teacherProfileId, series.id, nextWeeklyResolver(2, 2)),
    ]);

    expect(first.ok && second.ok).toBe(true);
    const sessions = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      select: { startAt: true },
    });
    expect(sessions).toHaveLength(4);
    expect(new Set(sessions.map((session) => session.startAt.getTime())).size).toBe(4);
  });

  test("open-all opens only future drafts of the teacher's own series, and runs alongside generate-more without deadlock", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "open-all"), "open-all");
    const series = await seedSeries(teacher.teacherProfileId, "全部開放系列");
    await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 3));
    const [firstSession, secondSession] = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
    });
    // 一場已取消、一場已經開始（草稿但時間已過），都不能被開放。
    await prisma.classSession.update({ where: { id: firstSession.id }, data: { status: "cancelled" } });
    await prisma.classSession.update({
      where: { id: secondSession.id },
      data: { startAt: new Date(Date.now() - 3600_000), endAt: new Date(Date.now() - 1800_000) },
    });

    const [openResult, generateResult] = await Promise.all([
      openAllDraftOccurrencesForTeacherProfile(teacher.teacherProfileId, series.id),
      generateOccurrencesForSeries(teacher.teacherProfileId, series.id, nextWeeklyResolver(2, 1)),
    ]);

    expect(openResult.ok).toBe(true);
    expect(generateResult.ok).toBe(true);
    const statuses = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
      select: { id: true, status: true },
    });
    expect(statuses.find((item) => item.id === firstSession.id)?.status).toBe("cancelled");
    expect(statuses.find((item) => item.id === secondSession.id)?.status).toBe("draft");
    // 第三場一定被開放；同時生成的那場視先後可能是草稿或已開放，只要不死鎖、狀態合法即可。
    expect(statuses.filter((item) => item.status === "open_for_enrollment").length).toBeGreaterThanOrEqual(1);
  });

  test("open-all refuses another teacher's series and a suspended teacher", async ({}, testInfo) => {
    const id = runId(testInfo, "guards");
    const owner = await seedTeacher(id, "owner");
    const other = await seedTeacher(id, "other");
    const suspended = await seedTeacher(id, "suspended", "suspended");
    const ownerSeries = await seedSeries(owner.teacherProfileId, "別人的系列");
    await generateOccurrencesForSeries(owner.teacherProfileId, ownerSeries.id, computeNextWeeklyOccurrenceDates(2, 2));
    const suspendedSeries = await seedSeries(suspended.teacherProfileId, "暫停老師的系列");
    await prisma.classSession.create({
      data: {
        origin: "teacher_initiated",
        teacherProfileId: suspended.teacherProfileId,
        recurringClassSeriesId: suspendedSeries.id,
        title: "暫停老師的草稿",
        serviceType: "伸展與身體保養",
        startAt: new Date(Date.now() + 7 * 86_400_000),
        endAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000),
        location: "台北市測試教室",
        capacity: 10,
        isPublic: false,
      },
    });

    const otherAttempt = await openAllDraftOccurrencesForTeacherProfile(other.teacherProfileId, ownerSeries.id);
    expect(otherAttempt).toMatchObject({ ok: false, code: "series_not_found" });
    const suspendedAttempt = await openAllDraftOccurrencesForTeacherProfile(
      suspended.teacherProfileId,
      suspendedSeries.id,
    );
    expect(suspendedAttempt).toMatchObject({ ok: false, code: "teacher_not_approved" });

    expect(
      await prisma.classSession.count({
        where: {
          recurringClassSeriesId: { in: [ownerSeries.id, suspendedSeries.id] },
          status: "open_for_enrollment",
        },
      }),
    ).toBe(0);
  });
});

test.describe("buildTeacherTodoItems draft grouping (pure function)", () => {
  test("merges drafts of one series into one card linking to the series page, and shows dates", () => {
    const now = new Date("2027-03-01T12:00:00+08:00");
    const base = {
      origin: "teacher_initiated" as const,
      status: "draft" as const,
      enrollments: [] as { status: string }[],
    };
    const at = (day: number) => new Date(`2027-03-${String(day).padStart(2, "0")}T19:00:00+08:00`);

    const items = buildTeacherTodoItems({
      now,
      classSessions: [
        ...[2, 9, 16, 23].map((day) => ({
          ...base,
          id: `s-${day}`,
          title: "皮拉提斯每周常態班",
          startAt: at(day),
          endAt: at(day),
          recurringClassSeriesId: "series-1",
          recurringClassSeries: { title: "皮拉提斯每周常態班" },
        })),
        { ...base, id: "single", title: "單堂草稿", startAt: at(5), endAt: at(5) },
      ],
      selectedResponsesAwaitingClass: [],
    });

    expect(items.map((item) => item.href)).toEqual([
      "/teacher/classes/series/series-1",
      "/teacher/classes/single",
    ]);
    expect(items[0].label).toBe("草稿：4 場還沒開放報名");
    expect(items[0].message).toContain("03/02（二）19:00");
    expect(items[0].message).toContain("等 4 場");
    expect(items[0].message).toContain("全部開放報名");
    expect(items[1].message).toContain("03/05（五）19:00");
  });
});

test.describe("series open-all through the UI", () => {
  test("creating a weekly series with 建立後全部開放報名 opens every session", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui-create"), "ui-create");
    const title = `建立即開放 ${testInfo.workerIndex}-${Date.now()}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定" }).click();
    await page.locator("#weekly-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await page.locator("#weekly-dayOfWeek").selectOption("2");
    await page.locator("#weekly-startDate").fill(futureWeekdayDateString(30, 2));
    await selectFormTime(page, "weekly-", "start", "19:00");
    await selectFormTime(page, "weekly-", "end", "20:00");
    await page.locator("#weekly-location").fill("台北市測試教室");
    await page.locator("#weekly-capacity").fill("10");
    await page.locator("#weekly-generateCount").fill("3");
    await page.getByText("建立後全部開放報名", { exact: true }).click();
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/共生成 3 場。每一場都已開放報名/)).toBeVisible();
    // 沒有草稿時不顯示「全部開放報名」區塊。
    await expect(page.getByRole("button", { name: /全部開放報名（/ })).toHaveCount(0);
    const sessions = await prisma.classSession.findMany({
      where: { teacherProfileId: teacher.teacherProfileId },
      select: { status: true },
    });
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.status === "open_for_enrollment")).toBe(true);
  });

  test("dashboard shows one merged card; the series page opens all drafts after confirming", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui-open-all"), "ui-open-all");
    const series = await seedSeries(teacher.teacherProfileId, `合併卡片系列 ${testInfo.workerIndex}-${Date.now()}`);
    await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 3));

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/dashboard");
    const cards = page.getByRole("link", { name: /草稿：3 場還沒開放報名/ });
    await expect(cards).toHaveCount(1);
    await cards.click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}`));

    await page.getByRole("button", { name: "全部開放報名（3 場）" }).click();
    const dialog = page.getByRole("dialog", { name: "全部開放報名？" });
    await expect(dialog.getByRole("list", { name: "會開放報名的場次" }).getByRole("listitem")).toHaveCount(3);
    // 按「先不要」不寫入。
    await dialog.getByRole("button", { name: "先不要" }).click();
    expect(
      await prisma.classSession.count({ where: { recurringClassSeriesId: series.id, status: "draft" } }),
    ).toBe(3);

    await page.getByRole("button", { name: "全部開放報名（3 場）" }).click();
    await dialog.getByRole("button", { name: "開放 3 場報名" }).click();
    await expect(page.getByText("已開放 3 場報名，可以複製每一場的報名連結傳給學員。")).toBeVisible();
    expect(
      await prisma.classSession.count({
        where: { recurringClassSeriesId: series.id, status: "open_for_enrollment" },
      }),
    ).toBe(3);
  });

  test("generate-more remembers the open-on-create choice per series and opens new sessions", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui-generate"), "ui-generate");
    const series = await seedSeries(teacher.teacherProfileId, `生成更多系列 ${testInfo.workerIndex}-${Date.now()}`);
    await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 1));

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/series/${series.id}`);
    const checkbox = page.getByRole("checkbox", { name: "建立後全部開放報名" });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await page.locator("#count").fill("2");
    await page.getByRole("button", { name: "生成", exact: true }).click();
    await expect(page.getByText("已生成 2 場，並已開放報名。")).toBeVisible();

    // 重新進入同一個系列時沿用上次的選擇。
    await page.goto(`/teacher/classes/series/${series.id}`);
    await expect(page.getByRole("checkbox", { name: "建立後全部開放報名" })).toBeChecked();
    expect(
      await prisma.classSession.count({
        where: { recurringClassSeriesId: series.id, status: "open_for_enrollment" },
      }),
    ).toBe(2);
  });
});
