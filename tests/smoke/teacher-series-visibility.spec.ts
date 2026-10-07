import { expect, test } from "@playwright/test";

import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { editSeriesFromOccurrenceForTeacher } from "../../src/domain/class-session/__internal__/edit-series-from-occurrence-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { getPublicClassSessionListItems } from "../../src/domain/class-session/public-read-service";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import { pickServiceType } from "./_helpers/class-form";
import { futureWeekdayDateString } from "./_helpers/future-dates";
import { selectFormTime } from "./_helpers/time-select";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// teacher-class-scheduling 票 06：系列可公開、建好之後可以改公開設定。
const testEmailDomain = "teacher-series-visibility-smoke.local";
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

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function seedTeacher(id: string, label: string) {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label}`, status: "approved" });
}

async function seedSeries(teacherProfileId: string, title: string, isPublic?: boolean) {
  return prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title,
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek: 2,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北市測試教室",
      capacity: 10,
      ...(isPublic === undefined ? {} : { isPublic }),
    },
  });
}

const editBase = {
  description: "",
  serviceTypes: ["放鬆紓壓"],
  yogaStyles: ["哈達瑜伽"],
  location: "台北市測試教室",
  capacity: 10,
};

test.describe("series visibility (domain)", () => {
  test("a series is not public by default; a public series generates public sessions that show up once open", async ({}, testInfo) => {
    const id = runId(testInfo, "generate");
    const teacher = await seedTeacher(id, "owner");
    const privateSeries = await seedSeries(teacher.teacherProfileId, `連結招募系列 ${id}`);
    expect(privateSeries.isPublic).toBe(false);
    const publicSeries = await seedSeries(teacher.teacherProfileId, `公開系列 ${id}`, true);
    // 錯開時段，避免兩個系列互相撞課。
    await prisma.recurringClassSeries.update({
      where: { id: publicSeries.id },
      data: { startTime: "09:00", endTime: "10:00" },
    });

    for (const series of [privateSeries, publicSeries]) {
      await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 2), {
        openForEnrollment: true,
      });
    }

    expect(
      (await prisma.classSession.findMany({ where: { recurringClassSeriesId: privateSeries.id } })).every(
        (session) => !session.isPublic,
      ),
    ).toBe(true);
    expect(
      (await prisma.classSession.findMany({ where: { recurringClassSeriesId: publicSeries.id } })).every(
        (session) => session.isPublic,
      ),
    ).toBe(true);

    const listed = await getPublicClassSessionListItems();
    const listedTitles = listed.map((item) => item.title);
    expect(listedTitles.filter((title) => title === `公開系列 ${id}`)).toHaveLength(2);
    expect(listedTitles).not.toContain(`連結招募系列 ${id}`);
  });

  test("a single class and a series session can change visibility; the series scope decides which sessions change", async ({}, testInfo) => {
    const id = runId(testInfo, "edit");
    const teacher = await seedTeacher(id, "owner");
    const series = await seedSeries(teacher.teacherProfileId, `改公開系列 ${id}`);
    await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 4), {
      openForEnrollment: true,
    });
    const sessions = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
    });

    // 只改這一場：只有第一場公開，系列設定不變。
    const onlyThis = await editClassSessionForTeacher(teacher.teacherProfileId, sessions[0].id, {
      ...editBase,
      title: series.title,
      startAt: formatTaipeiDatetimeLocal(sessions[0].startAt),
      endAt: formatTaipeiDatetimeLocal(sessions[0].endAt),
      isPublic: true,
    });
    expect(onlyThis.ok).toBe(true);

    // 從第三場起改成公開：第三、四場與系列設定公開，第二場不變。
    const following = await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[2].id, {
      ...editBase,
      title: series.title,
      startTime: "19:00",
      endTime: "20:00",
      isPublic: true,
    });
    expect(following.ok).toBe(true);

    const after = new Map(
      (await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id } })).map((session) => [
        session.id,
        session.isPublic,
      ]),
    );
    expect(sessions.map((session) => after.get(session.id))).toEqual([true, false, true, true]);
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).isPublic).toBe(true);

    // 之後生成的場次沿用系列的公開設定。
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(2, 1, sessions[3].startAt),
    );
    const newSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: generated.ok ? generated.createdClassSessionIds[0] : "" },
    });
    expect(newSession.isPublic).toBe(true);

    // 改回不公開。
    const back = await editClassSessionForTeacher(teacher.teacherProfileId, sessions[0].id, {
      ...editBase,
      title: series.title,
      startAt: formatTaipeiDatetimeLocal(sessions[0].startAt),
      endAt: formatTaipeiDatetimeLocal(sessions[0].endAt),
      isPublic: false,
    });
    expect(back.ok).toBe(true);
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: sessions[0].id } })).isPublic).toBe(false);
  });
});

test.describe("series visibility (UI)", () => {
  test("creating a public weekly series opens public sessions that visitors can find", async ({ browser, context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui"), "owner");
    const title = `公開常態班 ${testInfo.workerIndex}-${Date.now()}`;

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
    await page.locator("#weekly-generateCount").fill("2");
    await page.locator("#weekly-isPublic-yes").check();
    await page.getByText("建立後全部開放報名", { exact: true }).click();
    await expect(page.getByRole("region", { name: "建立前核對" })).toContainText("開放報名後列在公開課程列表");
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/這個系列設定為公開/)).toBeVisible();
    const series = await prisma.recurringClassSeries.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title },
    });
    expect(series.isPublic).toBe(true);

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto("/classes");
    await expect(visitorPage.getByText(title).first()).toBeVisible();
    await visitor.close();
  });

  test("the edit page lets a teacher switch a single class to public", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui-edit"), "owner");
    const start = new Date(Date.now() + 9 * 86_400_000);
    start.setUTCHours(11, 0, 0, 0);
    const classSession = await prisma.classSession.create({
      data: {
        origin: "teacher_initiated",
        teacherProfileId: teacher.teacherProfileId,
        title: "單堂改公開",
        serviceType: "放鬆紓壓",
        serviceTypes: ["放鬆紓壓"],
        yogaStyles: ["哈達瑜伽"],
        startAt: start,
        endAt: new Date(start.getTime() + 3_600_000),
        location: "台北市測試教室",
        capacity: 10,
        isPublic: false,
        status: "open_for_enrollment",
      },
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${classSession.id}/edit`);
    await page.locator("#isPublic-yes").check();
    await expect(page.getByRole("region", { name: "儲存前核對" })).toContainText("這次會修改：公開設定。");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page.getByText("課程已更新。")).toBeVisible();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } })).isPublic).toBe(true);
  });
});
