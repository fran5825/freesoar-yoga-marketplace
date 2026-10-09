import { expect, test } from "@playwright/test";

import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { withdrawSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/withdraw-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-class-scheduling 票 09：整期學員請假與退出整期。
const fixtures = createTermFixtures("term-leave-withdraw-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, markStarted } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

async function enrollWholeTerm(memberId: string, seriesId: string) {
  const result = await createSeriesEnrollmentForUser(memberId, seriesId, { notes: null }, undefined, noNotify);
  expect(result.ok).toBe(true);

  return result.ok ? result.seriesEnrollmentId : "";
}

test.describe("withdraw from a term (domain)", () => {
  test("cancels every upcoming session, keeps the started one, marks the term withdrawn, and blocks re-enrolling", async ({}, testInfo) => {
    const id = runId(testInfo, "withdraw");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3 });
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);
    await markStarted(sessions[0].id);

    const result = await withdrawSeriesEnrollmentForUser(member.id, seriesEnrollmentId);
    expect(result).toEqual({ ok: true, cancelledCount: 2 });

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: member.id },
      orderBy: { classSession: { startAt: "asc" } },
    });
    expect(enrollments.map((enrollment) => enrollment.status)).toEqual(["confirmed", "cancelled", "cancelled"]);
    expect(await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: seriesEnrollmentId } })).toMatchObject({
      status: "withdrawn",
    });

    expect(await withdrawSeriesEnrollmentForUser(member.id, seriesEnrollmentId)).toEqual({
      ok: false,
      code: "series_enrollment_not_active",
    });
    expect(await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "already_term_enrolled",
    });
  });

  test("only the member can withdraw, and the notice goes to the member alone", async ({}, testInfo) => {
    const id = runId(testInfo, "own");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const stranger = await seedMember(id, "b");
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 2, title: "只通知本人" });
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);

    expect(await withdrawSeriesEnrollmentForUser(stranger.id, seriesEnrollmentId)).toEqual({
      ok: false,
      code: "series_enrollment_not_found",
    });

    expect((await withdrawSeriesEnrollmentForUser(member.id, seriesEnrollmentId)).ok).toBe(true);
    const memberNotices = await prisma.notification.findMany({ where: { userId: member.id } });
    expect(memberNotices).toHaveLength(1);
    expect(memberNotices[0]).toMatchObject({ type: "enrollment_cancelled" });
    // 老師只會有建立場次時的「課程已建立」，退出整期不另外通知老師（推導規則 10）。
    expect(
      await prisma.notification.count({ where: { userId: teacher.userId, type: { not: "class_session_created" } } }),
    ).toBe(0);
  });
});

test.describe("leave and withdraw (UI)", () => {
  test("a term member takes leave for one class from its page; the other classes stay", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-leave");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui-leave");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3, title: `請假 ${id}` });
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/${sessions[1].id}`);
    await expect(page.getByText("這一堂屬於你的整期報名。")).toBeVisible();
    await page.getByText("請假這一堂…").click();
    await page.getByLabel("我確認這一堂要請假。").check();
    await page.getByRole("button", { name: "確認請假" }).click();
    await expect(page.getByText("已請假這一堂，整期的其他堂照常。")).toBeVisible();

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: member.id },
      orderBy: { classSession: { startAt: "asc" } },
    });
    expect(enrollments.map((enrollment) => enrollment.status)).toEqual(["confirmed", "cancelled", "confirmed"]);
    expect(await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: seriesEnrollmentId } })).toMatchObject({
      status: "confirmed",
    });
  });

  test("a term member withdraws from the term page after seeing which classes will be cancelled", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-withdraw");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui-withdraw");
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, title: `退出 ${id}` });
    await enrollWholeTerm(member.id, series.id);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/terms/${series.id}`);
    await page.getByText("退出整期…").click();
    await expect(page.getByRole("list", { name: "退出後會取消的場次" }).getByRole("listitem")).toHaveCount(3);
    await page.getByLabel("我確認要退出這一期。").check();
    await page.getByRole("button", { name: "確認退出整期" }).click();
    await expect(page.getByText("已退出整期，取消了之後的 3 堂。")).toBeVisible();
    await expect(page.getByText("你已退出這一期")).toBeVisible();
    expect(await prisma.enrollment.count({ where: { userId: member.id, status: "cancelled" } })).toBe(3);
  });
});
