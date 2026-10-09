import { expect, test } from "@playwright/test";

import { futureWeekdayDateString } from "./_helpers/future-dates";
import { addMakeupSessionForTeacher } from "../../src/domain/class-session/__internal__/add-makeup-session-core";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { getPublicClassSessionListItems } from "../../src/domain/class-session/public-read-service";
import { parseTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { withdrawSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/withdraw-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-class-scheduling 票 11：期班追加補課日期。
const fixtures = createTermFixtures("term-makeup-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function enrollWholeTerm(memberId: string, seriesId: string) {
  const result = await createSeriesEnrollmentForUser(memberId, seriesId, { notes: null }, undefined, noNotify);
  expect(result.ok).toBe(true);

  return result.ok ? result.seriesEnrollmentId : "";
}

// 期班都在週三；補課選很後面的週四，不會撞到期班自己的場次。
const makeupThursday = (offset = 0) => futureWeekdayDateString(200 + offset * 7, 4);

test.describe("makeup dates (domain)", () => {
  test("adds a makeup class that copies the term settings, opens it, and auto-enrolls term members with their own status", async ({}, testInfo) => {
    const id = runId(testInfo, "basic");
    const teacher = await seedTeacher(id);
    const confirmedMember = await seedMember(id, "confirmed");
    const pendingMember = await seedMember(id, "pending");
    const { series } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true, title: "補課期班" });
    await prisma.recurringClassSeries.update({ where: { id: series.id }, data: { suitableFor: "初學者" } });
    const confirmedId = await enrollWholeTerm(confirmedMember.id, series.id);
    await enrollWholeTerm(pendingMember.id, series.id);
    await prisma.seriesEnrollment.update({ where: { id: confirmedId }, data: { status: "confirmed" } });

    const result = await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday());
    expect(result).toMatchObject({ ok: true, autoEnrolledCount: 2, openedForEnrollment: true });

    const makeup = await prisma.classSession.findUniqueOrThrow({
      where: { id: result.ok ? result.classSessionId : "" },
      include: { enrollments: true },
    });
    expect(makeup).toMatchObject({ status: "open_for_enrollment", suitableFor: "初學者", recurringClassSeriesId: series.id });
    const byUser = new Map(makeup.enrollments.map((enrollment) => [enrollment.userId, enrollment]));
    expect(byUser.get(confirmedMember.id)).toMatchObject({ status: "confirmed", seriesEnrollmentSource: "term_created" });
    expect(byUser.get(pendingMember.id)).toMatchObject({ status: "pending", seriesEnrollmentSource: "term_created" });
    expect(await prisma.notification.count({ where: { userId: confirmedMember.id, body: { contains: "補課" } } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: pendingMember.id, body: { contains: "補課" } } })).toBe(1);
  });

  test("a term with a draft gets a draft makeup class; a continuous series and another teacher are refused", async ({}, testInfo) => {
    const id = runId(testInfo, "draft");
    const teacher = await seedTeacher(id);
    const other = await seedTeacher(`${id}-other`);
    const draftTerm = await seedTerm(teacher.teacherProfileId, { open: false, title: "草稿期班" });

    expect(await addMakeupSessionForTeacher(teacher.teacherProfileId, draftTerm.series.id, makeupThursday())).toMatchObject({
      ok: true,
      openedForEnrollment: false,
    });
    expect(await addMakeupSessionForTeacher(other.teacherProfileId, draftTerm.series.id, makeupThursday(1))).toEqual({
      ok: false,
      code: "series_not_found",
    });

    await prisma.recurringClassSeries.update({
      where: { id: draftTerm.series.id },
      data: { kind: "continuous", termEnrollmentMode: null },
    });
    expect(await addMakeupSessionForTeacher(teacher.teacherProfileId, draftTerm.series.id, makeupThursday(2))).toEqual({
      ok: false,
      code: "series_not_term",
    });
  });

  test("refuses when the capacity cannot hold every term member, or when the date clashes with another class", async ({}, testInfo) => {
    const id = runId(testInfo, "refuse");
    const teacher = await seedTeacher(id);
    const a = await seedMember(id, "a");
    const b = await seedMember(id, "b");
    const { series } = await seedTerm(teacher.teacherProfileId, { capacity: 2, title: "名額不足" });
    await enrollWholeTerm(a.id, series.id);
    await enrollWholeTerm(b.id, series.id);
    await prisma.recurringClassSeries.update({ where: { id: series.id }, data: { capacity: 1 } });

    expect(await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday())).toEqual({
      ok: false,
      code: "capacity_below_term_members",
      termMemberCount: 2,
    });

    await prisma.recurringClassSeries.update({ where: { id: series.id }, data: { capacity: 5 } });
    const date = makeupThursday(1);
    const clash = await createClassSessionForTeacher(teacher.teacherProfileId, {
      title: "另一堂課",
      description: null,
      serviceType: "放鬆紓壓",
      startAt: parseTaipeiDatetimeLocal(`${date}T${series.startTime}`) as Date,
      endAt: parseTaipeiDatetimeLocal(`${date}T${series.endTime}`) as Date,
      location: "台北",
      capacity: 5,
      isPublic: false,
    });
    expect(clash.ok).toBe(true);
    expect(await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, date)).toEqual({
      ok: false,
      code: "teacher_schedule_conflict",
      conflictTitle: "另一堂課",
    });
    expect(await prisma.classSession.count({ where: { recurringClassSeriesId: series.id } })).toBe(3);
  });

  test("never exceeds 26 upcoming classes, even when two makeup dates are added at the same time", async ({}, testInfo) => {
    const id = runId(testInfo, "limit");
    const teacher = await seedTeacher(id);
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 25, title: "接近上限" });

    const results = await Promise.all([
      addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday(10)),
      addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday(11)),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({ ok: false, code: "too_many_sessions" });
    expect(await prisma.classSession.count({ where: { recurringClassSeriesId: series.id, status: { not: "cancelled" } } })).toBe(26);
  });

  test("a term enrollment waiting on the series lock during a makeup add also gets the makeup class", async ({}, testInfo) => {
    const id = runId(testInfo, "race-enroll");
    const teacher = await seedTeacher(id);
    const late = await seedMember(id, "late");
    const { series } = await seedTerm(teacher.teacherProfileId, { title: "交錯報名" });
    let enrollment: ReturnType<typeof createSeriesEnrollmentForUser> | null = null;

    const result = await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday(), {
      onSeriesLockAcquired: async () => {
        enrollment = createSeriesEnrollmentForUser(late.id, series.id, { notes: null }, undefined, noNotify);
        await sleep(300);
      },
    });
    expect(result.ok).toBe(true);
    expect(await enrollment).toMatchObject({ ok: true, sessionCount: 4 });
    expect(
      await prisma.enrollment.count({
        where: { userId: late.id, classSessionId: result.ok ? result.classSessionId : "", status: "confirmed" },
      }),
    ).toBe(1);
  });

  test("a withdrawal waiting on the series lock during a makeup add leaves no active enrollment behind", async ({}, testInfo) => {
    const id = runId(testInfo, "race-withdraw");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { title: "交錯退出" });
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);
    let withdrawal: ReturnType<typeof withdrawSeriesEnrollmentForUser> | null = null;

    const result = await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday(), {
      onSeriesLockAcquired: async () => {
        withdrawal = withdrawSeriesEnrollmentForUser(member.id, seriesEnrollmentId, undefined, noNotify);
        await sleep(300);
      },
    });
    expect(result).toMatchObject({ ok: true, autoEnrolledCount: 1 });
    expect(await withdrawal).toEqual({ ok: true, cancelledCount: 4 });
    expect(
      await prisma.enrollment.count({ where: { userId: member.id, status: { in: ["pending", "confirmed"] } } }),
    ).toBe(0);
  });

  test("the public weekday filter follows each class's actual date, so a Thursday makeup shows under Thursday", async ({}, testInfo) => {
    const id = runId(testInfo, "weekday");
    const teacher = await seedTeacher(id);
    const { series } = await seedTerm(teacher.teacherProfileId, { isPublic: true, title: `週三期班 ${id}` });
    const result = await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, makeupThursday());
    const makeupId = result.ok ? result.classSessionId : "";

    const thursday = await getPublicClassSessionListItems({ dayOfWeek: 4 });
    const wednesday = await getPublicClassSessionListItems({ dayOfWeek: 3 });
    expect(thursday.map((item) => item.id)).toContain(makeupId);
    expect(wednesday.map((item) => item.id)).not.toContain(makeupId);
  });
});

test.describe("makeup dates (UI)", () => {
  test("a teacher adds a makeup date from the term's series page", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui");
    const { series } = await seedTerm(teacher.teacherProfileId, { title: `補課 UI ${id}` });
    await enrollWholeTerm(member.id, series.id);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/series/${series.id}`);
    await page.locator("#makeup-date").fill(makeupThursday());
    await page.getByRole("button", { name: "追加補課" }).click();
    await expect(page.getByText("已追加補課（已開放報名），1 位整期學員自動報上並收到通知。")).toBeVisible();
    await expect(page.getByText("已生成場次（4）")).toBeVisible();
  });
});
