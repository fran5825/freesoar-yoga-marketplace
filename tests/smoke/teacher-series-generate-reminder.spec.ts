import { expect, test } from "@playwright/test";

import { listWeeklySeriesNeedingMoreForTeacherProfile } from "../../src/domain/class-session/__internal__/series-needing-more-core";
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

// teacher-class-scheduling 票 02：每週固定系列剩不到 2 場未來場次時，老師總覽提醒生成更多。
const testEmailDomain = "teacher-series-generate-reminder-smoke.local";
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

async function seedTeacher(testRunId: string, label: string, status: "approved" | "suspended" = "approved") {
  const email = `teacher-${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label}`, status });
}

const DAY = 86_400_000;

// 建立系列與指定的場次：offsetsInDays 為相對現在的天數，負數是已過的場次。
async function seedSeriesWithSessions(
  teacherProfileId: string,
  title: string,
  offsetsInDays: { days: number; status?: "draft" | "open_for_enrollment" | "cancelled" }[],
  dayOfWeek: number | null = 2,
) {
  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title,
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北市測試教室",
      capacity: 10,
    },
  });

  for (const { days, status = "draft" } of offsetsInDays) {
    const startAt = new Date(Date.now() + days * DAY);
    await prisma.classSession.create({
      data: {
        origin: "teacher_initiated",
        teacherProfileId,
        recurringClassSeriesId: series.id,
        title,
        serviceType: "伸展與身體保養",
        startAt,
        endAt: new Date(startAt.getTime() + 3_600_000),
        location: "台北市測試教室",
        capacity: 10,
        isPublic: false,
        status,
      },
    });
  }

  return series;
}

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

test.describe("weekly series needing more (domain)", () => {
  test("lists only own weekly series with fewer than 2 upcoming, non-cancelled sessions", async ({}, testInfo) => {
    const id = runId(testInfo, "domain");
    const teacher = await seedTeacher(id, "owner");
    const other = await seedTeacher(id, "other");

    await seedSeriesWithSessions(teacher.teacherProfileId, "還有兩場", [{ days: 3 }, { days: 10 }]);
    const oneLeft = await seedSeriesWithSessions(teacher.teacherProfileId, "剩一場", [
      { days: -7, status: "open_for_enrollment" },
      { days: 4 },
      { days: 11, status: "cancelled" },
    ]);
    const noneLeft = await seedSeriesWithSessions(teacher.teacherProfileId, "沒有之後的場次", [
      { days: -14 },
      { days: 5, status: "cancelled" },
    ]);
    await seedSeriesWithSessions(teacher.teacherProfileId, "指定日期系列", [{ days: 6 }], null);

    const result = await listWeeklySeriesNeedingMoreForTeacherProfile(teacher.teacherProfileId);
    const byId = new Map(result.map((series) => [series.id, series]));

    expect(result).toHaveLength(2);
    expect(byId.get(oneLeft.id)).toMatchObject({ remainingCount: 1, title: "剩一場" });
    expect(byId.get(oneLeft.id)?.lastUpcomingStartAt).not.toBeNull();
    expect(byId.get(noneLeft.id)).toMatchObject({ remainingCount: 0, lastUpcomingStartAt: null });
    expect(await listWeeklySeriesNeedingMoreForTeacherProfile(other.teacherProfileId)).toEqual([]);
  });
});

test.describe("generate-more reminder card (pure function)", () => {
  test("adds one reminder per series after drafts, linking to the generate-more section", () => {
    const now = new Date("2027-03-01T12:00:00+08:00");
    const items = buildTeacherTodoItems({
      now,
      classSessions: [
        {
          id: "draft",
          title: "單堂草稿",
          status: "draft",
          origin: "teacher_initiated",
          startAt: new Date("2027-03-05T19:00:00+08:00"),
          endAt: new Date("2027-03-05T20:00:00+08:00"),
          enrollments: [],
        },
      ],
      selectedResponsesAwaitingClass: [],
      seriesNeedingMore: [
        {
          id: "s1",
          title: "週二常態班",
          remainingCount: 1,
          lastUpcomingStartAt: new Date("2027-03-09T19:00:00+08:00"),
        },
        { id: "s0", title: "週四常態班", remainingCount: 0, lastUpcomingStartAt: null },
      ],
    });

    expect(items.map((item) => item.href)).toEqual([
      "/teacher/classes/draft",
      "/teacher/classes/series/s1#generate-more",
      "/teacher/classes/series/s0#generate-more",
    ]);
    expect(items[1].label).toBe("常態班：只剩 1 場");
    expect(items[1].message).toContain("03/09（二）19:00");
    expect(items[2].label).toBe("常態班：已經沒有之後的場次");
    expect(items[2].message).toContain("生成更多");
  });
});

test.describe("generate-more reminder on the dashboard", () => {
  test("an approved teacher sees the reminder and lands on the generate-more section", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "ui"), "ui");
    const series = await seedSeriesWithSessions(teacher.teacherProfileId, `快排完的常態班 ${testInfo.workerIndex}`, [
      { days: 4, status: "open_for_enrollment" },
    ]);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/dashboard");
    const card = page.getByRole("link", { name: /常態班：只剩 1 場/ });
    await expect(card).toHaveCount(1);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}#generate-more`));
    await expect(page.getByRole("button", { name: "生成", exact: true })).toBeVisible();
  });

  test("a suspended teacher does not see the reminder", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "suspended"), "suspended", "suspended");
    await seedSeriesWithSessions(teacher.teacherProfileId, "暫停老師的常態班", [{ days: 4 }]);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/dashboard");
    await expect(page.getByRole("heading", { name: "待你處理" })).toBeVisible();
    await expect(page.getByText(/常態班：/)).toHaveCount(0);
  });
});
