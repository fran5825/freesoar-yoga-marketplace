import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { futureWeekdayDateString } from "./_helpers/future-dates";
import { addMakeupSessionForTeacher } from "../../src/domain/class-session/__internal__/add-makeup-session-core";
import { cancelClassSessionForTeacher } from "../../src/domain/class-session/__internal__/cancel-class-session-core-for-teacher";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-class-scheduling 票 13：補齊 S10、S22 的期班情境，並在 375／768／1440 檢查期班相關頁面不溢出。
const fixtures = createTermFixtures("term-acceptance-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

test.describe("term scenarios (domain)", () => {
  test("S10: cancelling one term class cancels that class for term members and keeps the term enrollment", async ({}, testInfo) => {
    const id = runId(testInfo, "s10");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3, title: "放假一週" });
    const enrolled = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify);
    expect(enrolled.ok).toBe(true);

    expect((await cancelClassSessionForTeacher(teacher.teacherProfileId, sessions[1].id)).ok).toBe(true);

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: member.id },
      orderBy: { classSession: { startAt: "asc" } },
    });
    expect(enrollments.map((enrollment) => enrollment.status)).toEqual(["confirmed", "cancelled", "confirmed"]);
    expect(await prisma.seriesEnrollment.findFirstOrThrow({ where: { userId: member.id } })).toMatchObject({
      status: "confirmed",
    });
    expect(await prisma.notification.count({ where: { userId: member.id, type: "class_session_cancelled" } })).toBe(1);
  });

  test("S22: a suspended teacher cannot add a makeup date, and members cannot enroll in that teacher's term", async ({}, testInfo) => {
    const id = runId(testInfo, "s22");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { title: "暫停老師的期班" });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });

    expect(
      await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, futureWeekdayDateString(200, 4)),
    ).toEqual({ ok: false, code: "teacher_not_approved" });
    expect(await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "teacher_not_approved",
    });
  });
});

// 每個寬度都檢查沒有橫向捲軸，並留截圖供產品主人看畫面。
async function checkWidths(page: Page, info: TestInfo, name: string) {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${name} at ${width}px`,
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
  }
}

test.describe("term pages at 375 / 768 / 1440 (RWD)", () => {
  test("teacher pages: create form with 期班 chosen, term series page, term class edit page", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "寬度由測試自己設定，只在 desktop project 跑一次");
    const id = runId(testInfo, "rwd-teacher");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "rwd-teacher");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, {
      requiresApproval: true,
      title: `一個名稱很長很長的晨間流動瑜伽期班，讓卡片與標題換行 ${id}`,
    });
    expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: "膝蓋舊傷，請老師多留意" }, undefined, noNotify)).ok).toBe(true);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定" }).click();
    await page.getByText("期班", { exact: true }).click();
    await checkWidths(page, testInfo, "teacher-create-term");

    await page.goto(`/teacher/classes/series/${series.id}`);
    await expect(page.locator("#term-enrollments")).toBeVisible();
    await checkWidths(page, testInfo, "teacher-term-series");

    await page.goto(`/teacher/classes/${sessions[0].id}/edit`);
    await expect(page.locator("#term-visibility-note")).toBeVisible();
    await checkWidths(page, testInfo, "teacher-term-edit");
  });

  test("member pages: term page, 我的報名 term card, public discovery with a term card", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "寬度由測試自己設定，只在 desktop project 跑一次");
    const id = runId(testInfo, "rwd-member");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "rwd-member");
    const { series } = await seedTerm(teacher.teacherProfileId, {
      isPublic: true,
      count: 6,
      title: `週三晨間期班 ${id}`,
    });

    await page.goto("/classes?includeFull=1");
    await checkWidths(page, testInfo, "public-discovery-term-card");

    await page.goto(`/classes/terms/${series.id}`);
    await checkWidths(page, testInfo, "term-page-visitor");

    expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);
    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/terms/${series.id}`);
    await checkWidths(page, testInfo, "term-page-member");

    await page.goto("/member/enrollments");
    await expect(page.getByRole("region", { name: "整期報名" })).toBeVisible();
    await checkWidths(page, testInfo, "member-enrollments-term");
  });
});
