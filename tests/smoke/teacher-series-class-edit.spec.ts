import { expect, test } from "@playwright/test";

import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { editSeriesFromOccurrenceForTeacher } from "../../src/domain/class-session/__internal__/edit-series-from-occurrence-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// teacher-class-scheduling 票 05：系列改課（只改這場／改這場和之後所有場次）。
const testEmailDomain = "teacher-series-class-edit-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
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

async function seedTeacher(id: string, label: string, status: "approved" | "suspended" = "approved") {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label}`, status });
}

async function seedMember(id: string, label: string) {
  const email = `member-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return prisma.user.create({ data: { email, name: `Member ${label}` } });
}

// 每週二 19:00–20:00、4 場、已開放報名。
async function seedSeries(teacherProfileId: string, title = "週二晚上皮拉提斯") {
  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title,
      description: "原本的說明",
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek: 2,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北市原本教室",
      capacity: 10,
    },
  });
  await generateOccurrencesForSeries(teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 4), {
    openForEnrollment: true,
  });
  const sessions = await prisma.classSession.findMany({
    where: { recurringClassSeriesId: series.id },
    orderBy: { startAt: "asc" },
  });

  return { series, sessions };
}

const batchInput = {
  title: "週二晚上皮拉提斯（新）",
  description: "新的說明",
  serviceTypes: ["放鬆紓壓"],
  yogaStyles: ["哈達瑜伽"],
  startTime: "19:30",
  endTime: "20:30",
  location: "新北市新教室",
  capacity: 8,
};

function taipeiDate(date: Date) {
  return formatTaipeiDatetimeLocal(date).split("T")[0];
}

function taipeiTime(date: Date) {
  return formatTaipeiDatetimeLocal(date).split("T")[1];
}

async function enroll(classSessionId: string, userId: string) {
  return prisma.enrollment.create({
    data: { classSessionId, userId, status: "confirmed", consentedAt: new Date() },
  });
}

test.describe("series class edit (domain)", () => {
  test("只改這場 can move one session to another day; other sessions and the series stay as they were", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "single"), "owner");
    const { series, sessions } = await seedSeries(teacher.teacherProfileId);
    const target = sessions[1];
    const movedStart = new Date(target.startAt.getTime() + 2 * 86_400_000);

    const result = await editClassSessionForTeacher(teacher.teacherProfileId, target.id, {
      title: "只改這一場",
      description: "原本的說明",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: formatTaipeiDatetimeLocal(movedStart),
      endAt: formatTaipeiDatetimeLocal(new Date(movedStart.getTime() + 3_600_000)),
      location: "台北市原本教室",
      capacity: 6,
    });
    expect(result.ok).toBe(true);

    const after = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { id: "asc" },
    });
    const edited = after.find((session) => session.id === target.id);
    expect(edited).toMatchObject({ title: "只改這一場", capacity: 6 });
    expect(edited?.startAt.getTime()).toBe(movedStart.getTime());
    expect(after.filter((session) => session.title === "週二晚上皮拉提斯")).toHaveLength(3);
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toMatchObject({
      title: "週二晚上皮拉提斯",
      capacity: 10,
      startTime: "19:00",
    });
  });

  test("改這場和之後所有場次 updates later sessions (keeping their dates) and the series; earlier ones untouched; one notice per member", async ({}, testInfo) => {
    const id = runId(testInfo, "batch");
    const teacher = await seedTeacher(id, "owner");
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedSeries(teacher.teacherProfileId);
    await enroll(sessions[0].id, member.id);
    await enroll(sessions[1].id, member.id);
    await enroll(sessions[2].id, member.id);

    const result = await editSeriesFromOccurrenceForTeacher(
      teacher.teacherProfileId,
      series.id,
      sessions[1].id,
      batchInput,
    );
    expect(result).toEqual({ ok: true, updatedCount: 3, notifiedMemberCount: 1 });

    const after = new Map(
      (await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id } })).map((session) => [
        session.id,
        session,
      ]),
    );
    expect(after.get(sessions[0].id)).toMatchObject({ title: "週二晚上皮拉提斯", location: "台北市原本教室" });
    for (const original of sessions.slice(1)) {
      const updated = after.get(original.id)!;
      expect(updated).toMatchObject({ title: batchInput.title, location: batchInput.location, capacity: 8 });
      expect(taipeiDate(updated.startAt)).toBe(taipeiDate(original.startAt));
      expect(taipeiTime(updated.startAt)).toBe("19:30");
      expect(taipeiTime(updated.endAt)).toBe("20:30");
    }
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toMatchObject({
      title: batchInput.title,
      startTime: "19:30",
      endTime: "20:30",
      location: batchInput.location,
      capacity: 8,
    });

    const notices = await prisma.notification.findMany({
      where: { userId: member.id, type: "class_session_changed" },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].body).toContain("上課時間改為 19:30–20:30");
    expect(notices[0].body).toContain("地點改為 新北市新教室");
    expect(notices[0].body).toContain("影響你報名的 2 堂");

    // 之後生成的場次沿用新的系列設定。
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(2, 1, sessions[3].startAt),
    );
    const newSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: generated.ok ? generated.createdClassSessionIds[0] : "" },
    });
    expect(newSession).toMatchObject({ location: batchInput.location, capacity: 8, title: batchInput.title });
    expect(taipeiTime(newSession.startAt)).toBe("19:30");
  });

  test("one conflicting or over-full session stops the whole batch and names the day", async ({}, testInfo) => {
    const id = runId(testInfo, "all-or-nothing");
    const teacher = await seedTeacher(id, "owner");
    const { series, sessions } = await seedSeries(teacher.teacherProfileId);
    // 第 3 場那天 19:45 另有一堂自己的課：新時段 19:30–20:30 會撞到。
    const clashStart = new Date(sessions[2].startAt.getTime() + 45 * 60_000);
    await prisma.classSession.create({
      data: {
        origin: "teacher_initiated",
        teacherProfileId: teacher.teacherProfileId,
        title: "另一堂課",
        serviceType: "放鬆紓壓",
        startAt: new Date(sessions[2].startAt.getTime() + 60 * 60_000),
        endAt: new Date(clashStart.getTime() + 60 * 60_000),
        location: "台北",
        capacity: 5,
        isPublic: false,
      },
    });

    const conflict = await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[0].id, batchInput);
    expect(conflict).toMatchObject({ ok: false, code: "teacher_schedule_conflict" });
    if (!conflict.ok) {
      expect(conflict.failedStartAt?.getTime()).toBe(sessions[2].startAt.getTime());
    }

    // 第 4 場已有 3 人報名：名額改成 2 會失敗。
    for (const label of ["a", "b", "c"]) {
      await enroll(sessions[3].id, (await seedMember(id, label)).id);
    }
    const full = await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[3].id, {
      ...batchInput,
      startTime: "19:00",
      endTime: "20:00",
      capacity: 2,
    });
    expect(full).toMatchObject({ ok: false, code: "capacity_below_enrolled", enrolledCount: 3 });

    const unchanged = await prisma.classSession.findMany({ where: { recurringClassSeriesId: series.id } });
    expect(unchanged.every((session) => session.title === "週二晚上皮拉提斯" && session.capacity === 10)).toBe(true);
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).startTime).toBe("19:00");
  });

  test("refuses another teacher, a suspended teacher, and a session from another series", async ({}, testInfo) => {
    const id = runId(testInfo, "guards");
    const owner = await seedTeacher(id, "owner");
    const other = await seedTeacher(id, "other");
    const suspended = await seedTeacher(id, "suspended", "suspended");
    const first = await seedSeries(owner.teacherProfileId, "第一個系列");
    const second = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: owner.teacherProfileId,
        title: "第二個系列",
        serviceType: "放鬆紓壓",
        dayOfWeek: 4,
        startTime: "09:00",
        endTime: "10:00",
        location: "台北",
        capacity: 10,
      },
    });
    const suspendedSeries = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: suspended.teacherProfileId,
        title: "暫停老師的系列",
        serviceType: "放鬆紓壓",
        dayOfWeek: 2,
        startTime: "19:00",
        endTime: "20:00",
        location: "台北",
        capacity: 10,
      },
    });
    const suspendedSession = await prisma.classSession.create({
      data: {
        origin: "teacher_initiated",
        teacherProfileId: suspended.teacherProfileId,
        recurringClassSeriesId: suspendedSeries.id,
        title: "暫停老師的場次",
        serviceType: "放鬆紓壓",
        startAt: new Date(Date.now() + 7 * 86_400_000),
        endAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000),
        location: "台北",
        capacity: 10,
        isPublic: false,
        status: "open_for_enrollment",
      },
    });

    expect(
      await editSeriesFromOccurrenceForTeacher(other.teacherProfileId, first.series.id, first.sessions[0].id, batchInput),
    ).toMatchObject({ ok: false, code: "series_not_found" });
    expect(
      await editSeriesFromOccurrenceForTeacher(owner.teacherProfileId, second.id, first.sessions[0].id, batchInput),
    ).toMatchObject({ ok: false, code: "class_session_not_found" });
    expect(
      await editSeriesFromOccurrenceForTeacher(suspended.teacherProfileId, suspendedSeries.id, suspendedSession.id, batchInput),
    ).toMatchObject({ ok: false, code: "teacher_not_approved" });
    expect(
      await prisma.classSession.count({ where: { title: batchInput.title, teacherProfileId: { in: [owner.teacherProfileId, suspended.teacherProfileId] } } }),
    ).toBe(0);
  });

  test("an enrollment that lands while the batch holds the series lock is counted: no deadlock, no overbooking", async ({}, testInfo) => {
    const id = runId(testInfo, "concurrent");
    const teacher = await seedTeacher(id, "owner");
    const first = await seedMember(id, "first");
    const late = await seedMember(id, "late");
    const { series, sessions } = await seedSeries(teacher.teacherProfileId);
    await enroll(sessions[2].id, first.id);

    let release: () => void = () => {};
    let lockHeld: () => void = () => {};
    const seriesLocked = new Promise<void>((resolve) => {
      lockHeld = resolve;
    });
    const batch = editSeriesFromOccurrenceForTeacher(
      teacher.teacherProfileId,
      series.id,
      sessions[0].id,
      { ...batchInput, startTime: "19:00", endTime: "20:00", capacity: 1 },
      {
        onSeriesLockAcquired: () =>
          new Promise<void>((resolve) => {
            release = resolve;
            lockHeld();
          }),
      },
    );

    await seriesLocked;
    // 批次只握著系列的鎖：單場報名（場次 → 老師）可以完成，不會互相卡住。
    expect(await createEnrollmentForUser(late.id, sessions[2].id, { notes: null })).toMatchObject({ ok: true });
    release();

    // 批次接著鎖場次時看到 2 人報名，名額 1 不夠：整批不改，也沒有超收。
    expect(await batch).toMatchObject({ ok: false, code: "capacity_below_enrolled", enrolledCount: 2 });
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: sessions[2].id } })).capacity).toBe(10);
  });
});

test.describe("series class edit (UI)", () => {
  test("choosing 改這一場和之後所有場次 locks the date, lists the dates, and lands on the series page with per-session capacity", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui"), "owner");
    const { series, sessions } = await seedSeries(teacher.teacherProfileId, `UI 系列 ${testInfo.workerIndex}`);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${sessions[1].id}`);
    await page.getByRole("link", { name: "修改課程" }).click();
    await expect(page.locator("#edit-scope-single")).toBeChecked();
    await page.getByText("改這一場和之後所有場次（共 3 場）").click();
    await expect(page.locator("#single-date")).toBeDisabled();
    await page.locator("#location").fill("台中市新教室");
    await expect(page.getByRole("list", { name: "會修改的上課日期" }).getByRole("listitem")).toHaveCount(3);
    await page.getByRole("button", { name: "儲存修改" }).click();

    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}`));
    await expect(page.getByText("已更新 3 場與系列設定。")).toBeVisible();
    expect(
      await prisma.classSession.count({ where: { recurringClassSeriesId: series.id, location: "台中市新教室" } }),
    ).toBe(3);

    // 只改第一場的名額：系列頁每一場的分母讀自己的上限。
    await page.goto(`/teacher/classes/${sessions[0].id}/edit`);
    await page.locator("#capacity").fill("4");
    await page.getByRole("button", { name: "儲存修改" }).click();
    // 等存檔完成、跳回課程詳情頁再換頁，否則換頁可能打斷還沒寫完的存檔。
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${sessions[0].id}\\?`));
    await page.goto(`/teacher/classes/series/${series.id}`);
    await expect(page.locator(`#class-${sessions[0].id}`)).toContainText("已報名 0 / 4 人");
    await expect(page.locator(`#class-${sessions[1].id}`)).toContainText("已報名 0 / 10 人");
  });
});
