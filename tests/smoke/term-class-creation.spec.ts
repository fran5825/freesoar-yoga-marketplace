import { expect, test } from "@playwright/test";

import { addFixedDate, pickServiceType } from "./_helpers/class-form";
import { futureDateString, futureWeekdayDateString } from "./_helpers/future-dates";
import { selectFormTime } from "./_helpers/time-select";
import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { editSeriesFromOccurrenceForTeacher } from "../../src/domain/class-session/__internal__/edit-series-from-occurrence-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { listWeeklySeriesNeedingMoreForTeacherProfile } from "../../src/domain/class-session/__internal__/series-needing-more-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { validateRecurringSeriesInput } from "../../src/domain/class-session/recurring-series-validation";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// teacher-class-scheduling 票 07：建立期班（持續開課／期班、報名方式、期班不能生成更多、公開設定整期一致）。
const testEmailDomain = "term-class-creation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function seedTeacher(id: string) {
  const email = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${id}`, status: "approved" });
}

// 每週二 19:00–20:00 的系列，直接寫入（不經表單），用來測 domain 規則。
async function seedSeries(
  teacherProfileId: string,
  kind: "continuous" | "term",
  count: number,
  title: string,
) {
  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title,
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek: 2,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北市期班教室",
      capacity: 10,
      kind,
      termEnrollmentMode: kind === "term" ? "term_and_single" : null,
    },
  });
  await generateOccurrencesForSeries(teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, count), {
    openForEnrollment: true,
  });
  const sessions = await prisma.classSession.findMany({
    where: { recurringClassSeriesId: series.id },
    orderBy: { startAt: "asc" },
  });

  return { series, sessions };
}

const baseValidInput = {
  title: "期班驗證",
  serviceTypes: ["放鬆紓壓"],
  yogaStyles: ["哈達瑜伽"],
  startTime: "19:00",
  endTime: "20:00",
  location: "台北",
  capacity: 10,
};

test.describe("term class validation (pure function)", () => {
  test("weekly defaults to continuous; weekly term defaults to term_and_single; fixed dates are always a term", () => {
    const continuous = validateRecurringSeriesInput({ ...baseValidInput, mode: "weekly", dayOfWeek: 2, generateCount: 4 });
    expect(continuous.valid && continuous.normalized).toMatchObject({ kind: "continuous", termEnrollmentMode: null });

    const weeklyTerm = validateRecurringSeriesInput({
      ...baseValidInput,
      mode: "weekly",
      dayOfWeek: 2,
      generateCount: 10,
      seriesKind: "term",
    });
    expect(weeklyTerm.valid && weeklyTerm.normalized).toMatchObject({
      kind: "term",
      termEnrollmentMode: "term_and_single",
    });

    const termOnly = validateRecurringSeriesInput({
      ...baseValidInput,
      mode: "weekly",
      dayOfWeek: 2,
      generateCount: 10,
      seriesKind: "term",
      termEnrollmentMode: "term_only",
    });
    expect(termOnly.valid && termOnly.normalized).toMatchObject({ kind: "term", termEnrollmentMode: "term_only" });

    // 指定日期送 continuous 也一律是期班；持續開課送了報名方式也會被忽略。
    const fixed = validateRecurringSeriesInput({
      ...baseValidInput,
      mode: "fixed_dates",
      dates: [futureDateString(10)],
      seriesKind: "continuous",
    });
    expect(fixed.valid && fixed.normalized).toMatchObject({ kind: "term", termEnrollmentMode: "term_and_single" });

    const ignoredMode = validateRecurringSeriesInput({
      ...baseValidInput,
      mode: "weekly",
      dayOfWeek: 2,
      generateCount: 4,
      termEnrollmentMode: "term_only",
    });
    expect(ignoredMode.valid && ignoredMode.normalized).toMatchObject({ kind: "continuous", termEnrollmentMode: null });
  });

  test("rejects an unknown kind or enrollment mode", () => {
    const badKind = validateRecurringSeriesInput({
      ...baseValidInput,
      mode: "weekly",
      dayOfWeek: 2,
      generateCount: 4,
      seriesKind: "forever",
    });
    expect(badKind.valid).toBe(false);
    expect(!badKind.valid && badKind.errors.map((error) => error.code)).toContain("series_kind_invalid");

    const badMode = validateRecurringSeriesInput({
      ...baseValidInput,
      mode: "fixed_dates",
      dates: [futureDateString(10)],
      termEnrollmentMode: "half",
    });
    expect(!badMode.valid && badMode.errors.map((error) => error.code)).toContain("term_enrollment_mode_invalid");
  });
});

test.describe("term class rules (domain)", () => {
  test("the database rejects a term without an enrollment mode and a continuous series with one", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "db-check"));
    const base = {
      teacherProfileId: teacher.teacherProfileId,
      title: "檢查規則",
      dayOfWeek: 2,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北",
      capacity: 10,
    };

    await expect(prisma.recurringClassSeries.create({ data: { ...base, kind: "term" } })).rejects.toThrow();
    await expect(
      prisma.recurringClassSeries.create({ data: { ...base, kind: "continuous", termEnrollmentMode: "term_only" } }),
    ).rejects.toThrow();
  });

  test("generate more refuses a term inside the series lock, and still works for a continuous series", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "generate"));
    const term = await seedSeries(teacher.teacherProfileId, "term", 3, "期班不能生成更多");
    const continuous = await seedSeries(teacher.teacherProfileId, "continuous", 2, "持續開課可以生成更多");

    const refused = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      term.series.id,
      [futureDateString(200)],
      { requireContinuous: true },
    );
    expect(refused).toEqual({ ok: false, code: "series_not_continuous" });
    expect(await prisma.classSession.count({ where: { recurringClassSeriesId: term.series.id } })).toBe(3);

    const allowed = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      continuous.series.id,
      [futureDateString(200)],
      { requireContinuous: true },
    );
    expect(allowed.ok).toBe(true);
  });

  test("the generate-more reminder only covers continuous series", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "reminder"));
    const continuous = await seedSeries(teacher.teacherProfileId, "continuous", 1, "常態班剩一場");
    await seedSeries(teacher.teacherProfileId, "term", 1, "期班剩一場");

    const result = await listWeeklySeriesNeedingMoreForTeacherProfile(teacher.teacherProfileId);
    expect(result.map((series) => series.id)).toEqual([continuous.series.id]);
  });

  test("a term's visibility stays uniform: editing any one session applies it to the whole term and the series", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "visibility"));
    const { series, sessions } = await seedSeries(teacher.teacherProfileId, "term", 3, "期班公開設定");
    const middle = sessions[1];
    const [date, startTime] = formatTaipeiDatetimeLocal(middle.startAt).split("T");
    const [, endTime] = formatTaipeiDatetimeLocal(middle.endAt).split("T");

    // 「只改這場」改成公開：整期與系列都公開。
    const single = await editClassSessionForTeacher(teacher.teacherProfileId, middle.id, {
      title: middle.title,
      serviceTypes: middle.serviceTypes,
      yogaStyles: middle.yogaStyles,
      startAt: `${date}T${startTime}`,
      endAt: `${date}T${endTime}`,
      location: middle.location,
      capacity: middle.capacity,
      isPublic: true,
    });
    expect(single.ok).toBe(true);
    expect(
      (await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id } })).every(
        (session) => session.isPublic,
      ),
    ).toBe(true);
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).isPublic).toBe(true);

    // 「改這場和之後」從最後一場改回不公開：更早的場次也一起改。
    const last = sessions[2];
    const following = await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, last.id, {
      title: last.title,
      serviceTypes: last.serviceTypes,
      yogaStyles: last.yogaStyles,
      startTime: "19:00",
      endTime: "20:00",
      location: last.location,
      capacity: last.capacity,
      isPublic: false,
    });
    expect(following.ok).toBe(true);
    expect(
      (await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id } })).every(
        (session) => !session.isPublic,
      ),
    ).toBe(true);
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).isPublic).toBe(false);
  });

  test("a continuous series keeps per-session visibility for 只改這場", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "continuous-visibility"));
    const { series, sessions } = await seedSeries(teacher.teacherProfileId, "continuous", 3, "常態班公開設定");
    const middle = sessions[1];
    const [date, startTime] = formatTaipeiDatetimeLocal(middle.startAt).split("T");
    const [, endTime] = formatTaipeiDatetimeLocal(middle.endAt).split("T");

    const result = await editClassSessionForTeacher(teacher.teacherProfileId, middle.id, {
      title: middle.title,
      serviceTypes: middle.serviceTypes,
      yogaStyles: middle.yogaStyles,
      startAt: `${date}T${startTime}`,
      endAt: `${date}T${endTime}`,
      location: middle.location,
      capacity: middle.capacity,
      isPublic: true,
    });
    expect(result.ok).toBe(true);
    const after = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
    });
    expect(after.map((session) => session.isPublic)).toEqual([false, true, false]);
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).isPublic).toBe(false);
  });
});

test.describe("term class creation (UI)", () => {
  test("a weekly term: choose 期班 with 3 classes and 只收整期; the series page shows the term label and no generate-more", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "weekly-term");
    const teacher = await seedTeacher(id);
    const title = `每週期班 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定" }).click();
    await page.locator("#weekly-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await page.locator("#weekly-dayOfWeek").selectOption("3");
    await page.locator("#weekly-startDate").fill(futureWeekdayDateString(40, 3));
    await page.getByText("期班", { exact: true }).click();
    await expect(page.getByText("這一期共幾堂")).toBeVisible();
    await page.locator("#weekly-generateCount").fill("3");
    await selectFormTime(page, "weekly-", "start", "07:00");
    await selectFormTime(page, "weekly-", "end", "08:00");
    await page.locator("#weekly-location").fill("台北市期班教室");
    await page.locator("#weekly-capacity").fill("8");
    await page.getByText("只收整期", { exact: true }).click();
    await expect(page.getByText("每週固定・期班，共 3 堂")).toBeVisible();
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/期班已建立，共 3 堂/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("期班・共 3 堂・只收整期")).toBeVisible();
    await expect(page.getByRole("button", { name: "生成", exact: true })).toBeHidden();

    const series = await prisma.recurringClassSeries.findFirstOrThrow({
      where: { title },
      include: { classSessions: true },
    });
    expect(series).toMatchObject({ kind: "term", termEnrollmentMode: "term_only", dayOfWeek: 3 });
    expect(series.classSessions).toHaveLength(3);
  });

  test("a weekly series left on 持續開課 stays continuous and still offers generate-more", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "weekly-continuous");
    const teacher = await seedTeacher(id);
    const title = `每週常態班 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定" }).click();
    await page.locator("#weekly-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await page.locator("#weekly-dayOfWeek").selectOption("4");
    await page.locator("#weekly-startDate").fill(futureWeekdayDateString(40, 4));
    await expect(page.getByText("首次要生成幾場")).toBeVisible();
    await expect(page.getByText("期班報名方式")).toHaveCount(0);
    await page.locator("#weekly-generateCount").fill("2");
    await selectFormTime(page, "weekly-", "start", "07:00");
    await selectFormTime(page, "weekly-", "end", "08:00");
    await page.locator("#weekly-location").fill("台北市常態班教室");
    await page.locator("#weekly-capacity").fill("8");
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/課程系列已建立，共生成 2 場/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("持續開課", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "生成", exact: true })).toBeVisible();
    expect(await prisma.recurringClassSeries.findFirstOrThrow({ where: { title } })).toMatchObject({
      kind: "continuous",
      termEnrollmentMode: null,
    });
  });

  test("fixed dates always create a term with the default 整期和單堂都收", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "fixed-term");
    const teacher = await seedTeacher(id);
    const title = `指定日期期班 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "指定日期" }).click();
    await page.locator("#fixed-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await addFixedDate(page, futureDateString(45));
    await addFixedDate(page, futureDateString(52));
    await selectFormTime(page, "fixed-", "start", "07:00");
    await selectFormTime(page, "fixed-", "end", "08:00");
    await page.locator("#fixed-location").fill("台北市指定日期教室");
    await page.locator("#fixed-capacity").fill("8");
    await expect(page.locator("#fixed-termEnrollmentMode-term_and_single")).toBeChecked();
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/期班已建立，共 2 堂/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("期班・共 2 堂・整期和單堂都收")).toBeVisible();
    expect(await prisma.recurringClassSeries.findFirstOrThrow({ where: { title } })).toMatchObject({
      kind: "term",
      termEnrollmentMode: "term_and_single",
      dayOfWeek: null,
    });
  });

  test("the edit page of a term session explains that visibility applies to the whole term", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "edit-note"));
    const { sessions } = await seedSeries(teacher.teacherProfileId, "term", 2, "期班改課提示");

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${sessions[0].id}/edit`);
    await expect(page.locator("#term-visibility-note")).toContainText("公開設定整期一致");
  });
});
