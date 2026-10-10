import { expect, test } from "@playwright/test";

import { cancelClassSessionForAdmin } from "../../src/domain/class-session/__internal__/cancel-class-session-core";
import { cancelEnrollmentForAdminCore } from "../../src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { declineSeriesEnrollmentForTeacher } from "../../src/domain/enrollment/__internal__/decide-series-enrollment-core";
import { withdrawSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/withdraw-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// enrollment-re-enrollment 票 01：每一種取消來源都要記錄取消者（spec 4.1），舊資料維持 NULL。
const fixtures = createTermFixtures("enrollment-cancelled-by-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const cancelledByOf = async (id: string) =>
  (await prisma.enrollment.findUniqueOrThrow({ where: { id }, select: { status: true, cancelledBy: true } }));

test.describe("cancelledBy is recorded for every cancel source (domain)", () => {
  test("admin cancel → admin", async ({}, testInfo) => {
    const id = runId(testInfo, "admin");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1 });
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");

    expect((await cancelEnrollmentForAdminCore(created.enrollmentId, noNotify)).ok).toBe(true);
    expect(await cancelledByOf(created.enrollmentId)).toEqual({ status: "cancelled", cancelledBy: "admin" });
  });

  test("whole class cancelled → system", async ({}, testInfo) => {
    const id = runId(testInfo, "class");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1 });
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");

    expect((await cancelClassSessionForAdmin(sessions[0].id, undefined, noNotify)).ok).toBe(true);
    expect(await cancelledByOf(created.enrollmentId)).toEqual({ status: "cancelled", cancelledBy: "system" });
  });

  test("withdrawing the whole term → system", async ({}, testInfo) => {
    const id = runId(testInfo, "withdraw");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 2 });
    const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify);
    if (!joined.ok) throw new Error("fixture");

    expect((await withdrawSeriesEnrollmentForUser(member.id, joined.seriesEnrollmentId, undefined, noNotify)).ok).toBe(true);
    const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId }, select: { status: true, cancelledBy: true } });
    expect(rows).toHaveLength(2);
    expect(rows).toEqual([{ status: "cancelled", cancelledBy: "system" }, { status: "cancelled", cancelledBy: "system" }]);
  });

  test("teacher declines a term → teacher; a merged single already on leave becomes system (cannot slip past R8)", async ({}, testInfo) => {
    const id = runId(testInfo, "decline");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3, mode: "term_and_single", requiresApproval: true });
    // 先單堂報名第 1 堂（待確認），再報整期併入；之後學員對這一堂請假、對最後一堂也請假（整期新增的那一筆）。
    const single = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!single.ok) throw new Error("fixture");
    const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify);
    if (!joined.ok) throw new Error("fixture");
    const termCreated = await prisma.enrollment.findFirstOrThrow({ where: { seriesEnrollmentId: joined.seriesEnrollmentId, seriesEnrollmentSource: "term_created", classSessionId: sessions[2].id } });
    await prisma.enrollment.updateMany({ where: { id: { in: [single.enrollmentId, termCreated.id] } }, data: { status: "cancelled", cancelledBy: "member" } });

    expect((await declineSeriesEnrollmentForTeacher(teacher.teacherProfileId, joined.seriesEnrollmentId)).ok).toBe(true);

    // 併入單堂的請假：脫離整期、取消者改為 system。
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { id: single.enrollmentId }, select: { status: true, cancelledBy: true, seriesEnrollmentId: true } })).toEqual({
      status: "cancelled",
      cancelledBy: "system",
      seriesEnrollmentId: null,
    });
    // 整期新增的請假保持學員取消（整期已被婉拒，之後靠整期狀態擋下重新報名），其餘有效的逐場被婉拒取消。
    expect(await cancelledByOf(termCreated.id)).toEqual({ status: "cancelled", cancelledBy: "member" });
    const declined = await prisma.enrollment.findFirstOrThrow({ where: { seriesEnrollmentId: joined.seriesEnrollmentId, classSessionId: sessions[1].id } });
    expect(await cancelledByOf(declined.id)).toEqual({ status: "cancelled", cancelledBy: "teacher" });
  });
});

test.describe("database check", () => {
  test("cancelledBy can only be set on a cancelled enrollment, and legacy cancelled rows stay NULL", async ({}, testInfo) => {
    const id = runId(testInfo, "check");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1 });
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");

    await expect(prisma.enrollment.update({ where: { id: created.enrollmentId }, data: { cancelledBy: "member" } })).rejects.toThrow();
    // 舊資料樣子：已取消但沒有取消者，是允許的。
    await prisma.enrollment.update({ where: { id: created.enrollmentId }, data: { status: "cancelled" } });
    expect(await cancelledByOf(created.enrollmentId)).toEqual({ status: "cancelled", cancelledBy: null });
  });
});

test.describe("cancelledBy is recorded for member and teacher actions (UI)", () => {
  test("a member cancelling a single class and taking leave from a term are both recorded as member", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "member");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    await addAuthSessionCookie(context, member.sessionToken);
    const single = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `單堂取消 ${id}` });
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 2, title: `請假期班 ${id}` });
    const singleEnrollment = await createEnrollmentForUser(member.id, single.sessions[0].id, { notes: null });
    const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
    if (!singleEnrollment.ok || !joined.ok) throw new Error("fixture");

    await page.goto(`/classes/${single.sessions[0].id}`);
    await page.getByText("取消報名…").click();
    await page.getByLabel("我確認要取消這則報名。").check();
    await page.getByRole("button", { name: "確認取消" }).click();
    await expect(page.getByText("報名已取消。")).toBeVisible();
    expect(await cancelledByOf(singleEnrollment.enrollmentId)).toEqual({ status: "cancelled", cancelledBy: "member" });

    await page.goto(`/classes/${term.sessions[0].id}`);
    await page.getByRole("region", { name: "課程重點" }).getByText("請假", { exact: true }).click();
    await page.getByRole("region", { name: "課程重點" }).getByLabel("我確認這一堂要請假。").check();
    await page.getByRole("region", { name: "課程重點" }).getByRole("button", { name: "確認請假" }).click();
    await expect(page.getByText("已請假這一堂，整期的其他堂照常。")).toBeVisible();
    const leave = await prisma.enrollment.findFirstOrThrow({ where: { seriesEnrollmentId: joined.seriesEnrollmentId, classSessionId: term.sessions[0].id } });
    expect(await cancelledByOf(leave.id)).toEqual({ status: "cancelled", cancelledBy: "member" });
  });

  test("a teacher declining a pending single enrollment is recorded as teacher", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "teacher");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `婉拒單堂 ${id}` });
    await prisma.classSession.update({ where: { id: sessions[0].id }, data: { requiresApproval: true } });
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: `note-${id}` });
    if (!created.ok) throw new Error("fixture");

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${sessions[0].id}`);
    const card = page.locator("li").filter({ hasText: `note-${id}` });
    await card.getByRole("button", { name: /^婉拒/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確定婉拒" }).click();
    await expect(page.getByText("已婉拒這筆報名。")).toBeVisible();
    expect(await cancelledByOf(created.enrollmentId)).toEqual({ status: "cancelled", cancelledBy: "teacher" });
  });
});
