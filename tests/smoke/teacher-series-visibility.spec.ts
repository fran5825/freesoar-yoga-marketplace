import { expect, test } from "@playwright/test";

import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { editSeriesFromOccurrenceForTeacher } from "../../src/domain/class-session/__internal__/edit-series-from-occurrence-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { getPublicClassSessionListItems } from "../../src/domain/class-session/public-read-service";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import { addFixedDate, pickServiceType } from "./_helpers/class-form";
import { futureDateString, futureWeekdayDateString } from "./_helpers/future-dates";
import { selectFormTime } from "./_helpers/time-select";
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

// teacher-class-scheduling 票 06：系列可公開、建好之後可以改公開設定。
const testEmailDomain = "teacher-series-visibility-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
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

async function seedSeries(
  teacherProfileId: string,
  title: string,
  isPublic?: boolean,
  info: { suitableFor?: string | null; preparationNotes?: string | null } = {},
) {
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
      ...info,
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

test.describe("visibility and member info integration (domain)", () => {
  test("both edit scopes preserve independent fields, enrollments and guards; generation inherits all defaults", async ({}, testInfo) => {
    const id = runId(testInfo, "combined");
    const teacher = await seedTeacher(id, "owner");
    const series = await seedSeries(teacher.teacherProfileId, `整合系列 ${id}`, true, {
      suitableFor: "適合初學者",
      preparationNotes: "請帶瑜伽墊",
    });
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 4),
    );
    expect(generated.ok).toBe(true);
    const sessions = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id }, orderBy: { startAt: "asc" },
    });
    expect(sessions).toHaveLength(4);
    for (const session of sessions) {
      expect(session).toMatchObject({ isPublic: true, suitableFor: "適合初學者", preparationNotes: "請帶瑜伽墊" });
    }
    // Public drafts must remain absent; public and open-for-enrollment are independent.
    expect((await getPublicClassSessionListItems()).filter((row) => sessions.some((session) => session.id === row.id))).toEqual([]);
    await prisma.classSession.updateMany({
      where: { recurringClassSeriesId: series.id }, data: { status: "open_for_enrollment", requiresApproval: true },
    });
    await prisma.classSession.update({
      where: { id: sessions[0].id },
      data: { startAt: new Date(Date.now() - 7_200_000), endAt: new Date(Date.now() - 3_600_000) },
    });
    await prisma.classSession.update({ where: { id: sessions[3].id }, data: { status: "cancelled" } });
    const untouched = await prisma.classSession.findMany({ where: { id: { in: [sessions[0].id, sessions[3].id] } }, orderBy: { id: "asc" } });
    const memberEmail = `member-${id}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const member = await createUserSession({ email: memberEmail });
    await prisma.enrollment.createMany({ data: [
      { classSessionId: sessions[1].id, userId: member.userId, status: "pending", consentedAt: new Date() },
      { classSessionId: sessions[2].id, userId: member.userId, status: "confirmed", consentedAt: new Date() },
    ] });
    const enrollmentsBefore = await prisma.enrollment.findMany({ where: { userId: member.userId }, orderBy: { id: "asc" } });
    const singleInput = {
      ...editBase, title: series.title,
      startAt: formatTaipeiDatetimeLocal(sessions[1].startAt),
      endAt: formatTaipeiDatetimeLocal(sessions[1].endAt),
    };
    // A visibility-only single edit must not clear the omitted member information.
    expect(await editClassSessionForTeacher(teacher.teacherProfileId, sessions[1].id, {
      ...singleInput, isPublic: false,
    })).toMatchObject({ ok: true, notifiedMemberCount: 0 });
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: sessions[1].id } })).toMatchObject({
      isPublic: false, suitableFor: "適合初學者", preparationNotes: "請帶瑜伽墊", requiresApproval: true,
    });
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toEqual(series);
    expect((await getPublicClassSessionListItems()).some((row) => row.id === sessions[1].id)).toBe(false);
    // A member-info-only single edit must leave visibility and the series unchanged.
    expect(await editClassSessionForTeacher(teacher.teacherProfileId, sessions[1].id, {
      ...singleInput, suitableFor: "這一場的適合對象", preparationNotes: "",
    })).toMatchObject({ ok: true, notifiedMemberCount: 0 });
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: sessions[1].id } })).toMatchObject({
      isPublic: false, suitableFor: "這一場的適合對象", preparationNotes: null,
    });
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toEqual(series);
    const followingInput = { ...editBase, title: series.title, startTime: "19:00", endTime: "20:00" };
    expect(await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[1].id, {
      ...followingInput, isPublic: false, suitableFor: "之後的適合對象", preparationNotes: "",
    })).toMatchObject({ ok: true, updatedCount: 2, notifiedMemberCount: 0 });
    for (const session of await prisma.classSession.findMany({ where: { id: { in: [sessions[1].id, sessions[2].id] } } })) {
      expect(session).toMatchObject({ isPublic: false, suitableFor: "之後的適合對象", preparationNotes: null, requiresApproval: true });
    }
    expect(await prisma.classSession.findMany({ where: { id: { in: [sessions[0].id, sessions[3].id] } }, orderBy: { id: "asc" } })).toEqual(untouched);
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toMatchObject({
      isPublic: false, suitableFor: "之後的適合對象", preparationNotes: null,
    });
    // Omitted fields retain each occurrence's exception, not just the series default.
    await prisma.classSession.update({ where: { id: sessions[2].id }, data: { isPublic: true, suitableFor: "第三場例外" } });
    expect(await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[1].id, {
      ...followingInput, preparationNotes: "更新準備事項",
    })).toMatchObject({ ok: true, notifiedMemberCount: 0 });
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: sessions[1].id } })).toMatchObject({
      isPublic: false, suitableFor: "之後的適合對象", preparationNotes: "更新準備事項",
    });
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: sessions[2].id } })).toMatchObject({
      isPublic: true, suitableFor: "第三場例外", preparationNotes: "更新準備事項",
    });
    const beforeRejected = await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id }, orderBy: { id: "asc" } });
    const seriesBeforeRejected = await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } });
    expect(await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[1].id, {
      ...followingInput, isPublic: true, suitableFor: "a".repeat(501),
    })).toMatchObject({ ok: false, code: "validation_failed" });
    const other = await seedTeacher(id, "other");
    expect(await editSeriesFromOccurrenceForTeacher(other.teacherProfileId, series.id, sessions[1].id, {
      ...followingInput, isPublic: true, suitableFor: "不應寫入",
    })).toMatchObject({ ok: false, code: "series_not_found" });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    expect(await editClassSessionForTeacher(teacher.teacherProfileId, sessions[1].id, {
      ...singleInput, isPublic: true, suitableFor: "不應寫入",
    })).toMatchObject({ ok: false, code: "teacher_not_approved" });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "approved" } });
    expect(await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id }, orderBy: { id: "asc" } })).toEqual(beforeRejected);
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toEqual(seriesBeforeRejected);
    const more = await generateOccurrencesForSeries(teacher.teacherProfileId, series.id,
      computeNextWeeklyOccurrenceDates(2, 1, sessions[3].startAt));
    expect(more.ok).toBe(true);
    if (!more.ok) throw new Error("Expected an additional occurrence");
    expect(more.createdClassSessionIds).toHaveLength(1);
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: more.createdClassSessionIds[0] } })).toMatchObject({
      isPublic: false, suitableFor: "之後的適合對象", preparationNotes: "更新準備事項",
    });
    expect(await prisma.enrollment.findMany({ where: { userId: member.userId }, orderBy: { id: "asc" } })).toEqual(enrollmentsBefore);
    expect(await prisma.notification.count({ where: { userId: member.userId } })).toBe(0);
  });
});

test.describe("series visibility (UI)", () => {
  for (const seriesDefault of [false, true]) {
    test(`a ${seriesDefault ? "public" : "unlisted"} series explains mixed visibility and preserves it when opening drafts`, async ({ context, page }, testInfo) => {
      const id = runId(testInfo, `ui-mixed-${seriesDefault}`);
      const teacher = await seedTeacher(id, "owner");
      const series = await seedSeries(teacher.teacherProfileId, `混合公開設定 ${id}`, seriesDefault);
      await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 2));
      const sessions = await prisma.classSession.findMany({
        where: { recurringClassSeriesId: series.id }, orderBy: { startAt: "asc" },
      });
      expect(sessions).toHaveLength(2);
      const edited = await editClassSessionForTeacher(teacher.teacherProfileId, sessions[0].id, {
        ...editBase, title: series.title,
        startAt: formatTaipeiDatetimeLocal(sessions[0].startAt),
        endAt: formatTaipeiDatetimeLocal(sessions[0].endAt),
        isPublic: !seriesDefault,
      });
      expect(edited.ok).toBe(true);
      await addAuthSessionCookie(context, teacher.sessionToken);
      await page.goto(`/teacher/classes/series/${series.id}`);
      const seriesHeader = page.locator("header").filter({
        has: page.getByRole("heading", { name: series.title, exact: true }),
      });
      await expect(seriesHeader).toContainText(
        seriesDefault ? "這個系列設定為公開，作為新場次的預設。" : "這個系列僅透過連結招募，作為新場次的預設。",
      );
      await expect(seriesHeader).toContainText("已生成場次依各場的公開設定");
      await page.getByRole("button", { name: "全部開放報名（2 場）", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "全部開放報名？" });
      await expect(dialog).toContainText("各場原有的公開設定會保留");
      await expect(dialog).toContainText("設為公開且符合公開條件的場次才會列在公開課程列表");
      await dialog.getByRole("button", { name: "開放 2 場報名", exact: true }).click();
      await expect.poll(() => prisma.classSession.count({
        where: { recurringClassSeriesId: series.id, status: "open_for_enrollment" },
      })).toBe(2);
      const opened = await prisma.classSession.findMany({
        where: { recurringClassSeriesId: series.id }, orderBy: { startAt: "asc" },
      });
      expect(opened.map(session => session.isPublic)).toEqual([!seriesDefault, seriesDefault]);
      expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).isPublic).toBe(seriesDefault);
      const listed = await getPublicClassSessionListItems();
      expect(listed.filter(item => item.title === series.title)).toHaveLength(1);
    });
  }

  for (const mode of ["weekly", "fixed_dates"] as const) {
  test(`creating a public ${mode} series preserves member info for visitors`, async ({ browser, context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui"), "owner");
    const title = `公開整合 ${mode} ${testInfo.workerIndex}-${Date.now()}`;
    const prefix = mode === "weekly" ? "weekly-" : "fixed-";

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: mode === "weekly" ? "每週固定" : "指定日期", exact: true }).click();
    await page.locator(`#${prefix}title`).fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    if (mode === "weekly") {
      await page.locator("#weekly-dayOfWeek").selectOption("2");
      await page.locator("#weekly-startDate").fill(futureWeekdayDateString(30, 2));
      await page.locator("#weekly-generateCount").fill("2");
    } else {
      await addFixedDate(page, futureDateString(30));
      await addFixedDate(page, futureDateString(37));
    }
    await selectFormTime(page, prefix, "start", "19:00");
    await selectFormTime(page, prefix, "end", "20:00");
    await page.locator(`#${prefix}location`).fill("台北市測試教室");
    await page.locator(`#${prefix}capacity`).fill("10");
    await page.locator(`#${prefix}suitableFor`).locator("xpath=ancestor::details[1]/summary").click();
    await page.locator(`#${prefix}suitableFor`).fill("初學者可以參加");
    await page.locator(`#${prefix}preparationNotes`).fill("請帶瑜伽墊和水");
    await page.locator(`#${prefix}isPublic-yes`).check();
    await page.getByText("建立後全部開放報名", { exact: true }).click();
    await expect(page.getByRole("region", { name: "建立前核對" })).toContainText("開放報名後列在公開課程列表");
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.getByText(/這個系列設定為公開/)).toBeVisible();
    const series = await prisma.recurringClassSeries.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId, title },
    });
    expect(series.isPublic).toBe(true);
    expect(series).toMatchObject({ suitableFor: "初學者可以參加", preparationNotes: "請帶瑜伽墊和水" });
    const sessions = await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id }, orderBy: { startAt: "asc" } });
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      expect(session).toMatchObject({ isPublic: true, suitableFor: "初學者可以參加", preparationNotes: "請帶瑜伽墊和水" });
    }

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto("/classes");
    await expect(visitorPage.getByText(title).first()).toBeVisible();
    await visitorPage.goto(`/classes/${sessions[0].id}`);
    await expect(visitorPage.getByRole("region", { name: "適合對象" })).toContainText("初學者可以參加");
    await expect(visitorPage.getByRole("region", { name: "準備事項" })).toContainText("請帶瑜伽墊和水");
    await visitor.close();
  });
  }

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
