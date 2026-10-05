import { expect, test } from "@playwright/test";

import { cancelSeriesFromOccurrenceForTeacherProfile } from "../../src/domain/class-session/__internal__/cancel-series-from-occurrence-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// teacher-class-scheduling 票 03：從這場以後全部取消。
const testEmailDomain = "teacher-series-cancel-from-here-smoke.local";
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
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function seedTeacher(testRunId: string, label: string) {
  const email = `teacher-${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label}`, status: "approved" });
}

async function seedMember(testRunId: string, label: string) {
  const email = `member-${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);

  return prisma.user.create({ data: { email, name: `Member ${label}` } });
}

// 每週二 4 場未來場次（開放報名），再加 1 場已完成的過去場次。
// 同一位老師的兩個系列要錯開時段，否則第二個系列的場次會因撞課全部跳過。
async function seedSeries(teacherProfileId: string, title: string, startTime = "19:00") {
  const endTime = `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`;
  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title,
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek: 2,
      startTime,
      endTime,
      location: "台北市測試教室",
      capacity: 10,
    },
  });
  await generateOccurrencesForSeries(teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 4), {
    openForEnrollment: true,
  });
  const pastStart = new Date(Date.now() - 7 * 86_400_000);
  const past = await prisma.classSession.create({
    data: {
      origin: "teacher_initiated",
      teacherProfileId,
      recurringClassSeriesId: series.id,
      title,
      serviceType: "伸展與身體保養",
      startAt: pastStart,
      endAt: new Date(pastStart.getTime() + 3_600_000),
      location: "台北市測試教室",
      capacity: 10,
      isPublic: false,
      status: "completed",
    },
  });
  const upcoming = await prisma.classSession.findMany({
    where: { recurringClassSeriesId: series.id, startAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
  });

  return { series, past, upcoming };
}

test.describe("cancel from this session onward (domain)", () => {
  test("cancels this and later upcoming sessions with their enrollments, keeps earlier ones and the series", async ({}, testInfo) => {
    const id = runId(testInfo, "domain");
    const teacher = await seedTeacher(id, "owner");
    const member = await seedMember(id, "a");
    const { series, past, upcoming } = await seedSeries(teacher.teacherProfileId, "中途結束的常態班");
    await prisma.enrollment.createMany({
      data: [upcoming[0], upcoming[1], upcoming[3]].map((session, index) => ({
        classSessionId: session.id,
        userId: member.id,
        status: index === 2 ? ("pending" as const) : ("confirmed" as const),
        consentedAt: new Date(),
      })),
    });

    const result = await cancelSeriesFromOccurrenceForTeacherProfile(
      teacher.teacherProfileId,
      series.id,
      upcoming[1].id,
    );

    expect(result).toEqual({ ok: true, cancelledCount: 3 });
    const sessions = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      select: { id: true, status: true },
    });
    const statusOf = (sessionId: string) => sessions.find((session) => session.id === sessionId)?.status;
    expect(statusOf(past.id)).toBe("completed");
    expect(statusOf(upcoming[0].id)).toBe("open_for_enrollment");
    expect([1, 2, 3].map((index) => statusOf(upcoming[index].id))).toEqual([
      "cancelled",
      "cancelled",
      "cancelled",
    ]);

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: member.id },
      select: { classSessionId: true, status: true },
    });
    expect(enrollments.find((item) => item.classSessionId === upcoming[0].id)?.status).toBe("confirmed");
    expect(enrollments.find((item) => item.classSessionId === upcoming[1].id)?.status).toBe("cancelled");
    expect(enrollments.find((item) => item.classSessionId === upcoming[3].id)?.status).toBe("cancelled");
    // 學員報名的兩場被取消，各收到一則取消通知（通知在 commit 之後發）。
    expect(
      await prisma.notification.count({ where: { userId: member.id, type: "class_session_cancelled" } }),
    ).toBe(2);
    expect(await prisma.recurringClassSeries.count({ where: { id: series.id } })).toBe(1);

    // Q13：持續開課的系列取消後仍可生成更多。
    const regenerated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(2, 1, upcoming[3].startAt),
    );
    expect(regenerated.ok && regenerated.createdClassSessionIds.length).toBe(1);
  });

  test("refuses another teacher's series and a session from a different series, changing nothing", async ({}, testInfo) => {
    const id = runId(testInfo, "guards");
    const owner = await seedTeacher(id, "owner");
    const other = await seedTeacher(id, "other");
    const first = await seedSeries(owner.teacherProfileId, "第一個系列");
    const second = await seedSeries(owner.teacherProfileId, "第二個系列", "09:00");

    expect(
      await cancelSeriesFromOccurrenceForTeacherProfile(other.teacherProfileId, first.series.id, first.upcoming[0].id),
    ).toEqual({ ok: false, code: "series_not_found" });
    expect(
      await cancelSeriesFromOccurrenceForTeacherProfile(owner.teacherProfileId, first.series.id, second.upcoming[0].id),
    ).toEqual({ ok: false, code: "class_session_not_found" });
    expect(
      await prisma.classSession.count({
        where: { recurringClassSeriesId: { in: [first.series.id, second.series.id] }, status: "cancelled" },
      }),
    ).toBe(0);
  });
});

test.describe("cancel from this session onward (UI)", () => {
  test("the series page lists the affected sessions; backing out writes nothing; confirming cancels them", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui-series"), "ui-series");
    const { series, upcoming } = await seedSeries(teacher.teacherProfileId, `系列頁取消 ${testInfo.workerIndex}`);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/series/${series.id}`);
    const triggers = page.getByRole("button", { name: /這一場以後全部取消/ });
    await expect(triggers).toHaveCount(4);
    await triggers.nth(1).click();
    const dialog = page.getByRole("dialog", { name: "從這場以後全部取消？" });
    await expect(dialog.getByRole("list", { name: "會被取消的場次" }).getByRole("listitem")).toHaveCount(3);
    await page.keyboard.press("Escape");
    expect(
      await prisma.classSession.count({ where: { recurringClassSeriesId: series.id, status: "cancelled" } }),
    ).toBe(0);

    await triggers.nth(1).click();
    await dialog.getByRole("button", { name: "確定取消 3 場" }).click();
    await expect(page.getByText("已取消這一場之後共 3 場尚未開始的課程，之前的場次照常。")).toBeVisible();
    expect(
      (await prisma.classSession.findUniqueOrThrow({ where: { id: upcoming[0].id } })).status,
    ).toBe("open_for_enrollment");
    expect(
      await prisma.classSession.count({ where: { recurringClassSeriesId: series.id, status: "cancelled" } }),
    ).toBe(3);
  });

  test("the class detail page of a series session offers the same option and returns to the series page", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui-detail"), "ui-detail");
    const { series, upcoming } = await seedSeries(teacher.teacherProfileId, `詳情頁取消 ${testInfo.workerIndex}`);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${upcoming[2].id}`);
    await expect(page.getByText(/可以把這一場和之後的 1 場一起取消/)).toBeVisible();
    await page.getByRole("button", { name: "從這場以後全部取消" }).click();
    await page
      .getByRole("dialog", { name: "從這場以後全部取消？" })
      .getByRole("button", { name: "確定取消 2 場" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}`));
    await expect(page.getByText("已取消這一場之後共 2 場尚未開始的課程，之前的場次照常。")).toBeVisible();
  });
});
