import { expect, test } from "@playwright/test";

import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import { getPublicClassListEntries } from "../../src/domain/class-session/public-read-service";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { declineSeriesEnrollmentForTeacher } from "../../src/domain/enrollment/__internal__/decide-series-enrollment-core";
import { restoreLeaveForUser } from "../../src/domain/enrollment/__internal__/restore-leave-core";
import { withdrawSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/withdraw-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// enrollment-re-enrollment 票 03：取消請假與名額占用規則（ADR 0006、spec 4.3、4.4、4.6）。
const fixtures = createTermFixtures("term-leave-restore-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, markStarted } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

type Mode = "term_only" | "term_and_single";

async function seedJoined(label: string, testInfo: Parameters<typeof runId>[0], options: { mode?: Mode; capacity?: number; count?: number; requiresApproval?: boolean } = {}) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: options.count ?? 3, capacity: options.capacity ?? 5, mode: options.mode ?? "term_and_single", requiresApproval: options.requiresApproval, title: `請假期班 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });

  return { id, teacher, member, term, joined, rows };
}

const leave = (enrollmentId: string) => prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
const row = (id: string) => prisma.enrollment.findUniqueOrThrow({ where: { id } });

test.describe("restore leave (domain)", () => {
  test("a confirmed term: restore goes back to confirmed in the same term enrollment, no new consent", async ({}, testInfo) => {
    const { member, rows } = await seedJoined("confirmed", testInfo);
    const before = await row(rows[0].id);
    await leave(rows[0].id);

    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: true, status: "confirmed" });
    expect(await row(rows[0].id)).toMatchObject({ status: "confirmed", cancelledBy: null, seriesEnrollmentId: before.seriesEnrollmentId, seriesEnrollmentSource: before.seriesEnrollmentSource });
    expect((await row(rows[0].id)).consentedAt).toEqual(before.consentedAt);
  });

  test("a term waiting for the teacher: restore goes back to pending (follows the term enrollment)", async ({}, testInfo) => {
    const { member, rows } = await seedJoined("pending", testInfo, { requiresApproval: true });
    expect(rows[0].status).toBe("pending");
    await leave(rows[0].id);

    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: true, status: "pending" });
    expect((await row(rows[0].id)).status).toBe("pending");
  });

  test("term_only keeps the leave seat: a new member cannot take it, and the leaver can always come back", async ({}, testInfo) => {
    const { id, member, term, rows } = await seedJoined("only", testInfo, { mode: "term_only", capacity: 1, count: 2 });
    const other = await seedMember(id, "b");
    for (const enrollment of rows) await leave(enrollment.id);

    const blocked = await createSeriesEnrollmentForUser(other.id, term.series.id, { notes: null }, undefined, noNotify);
    expect(blocked).toMatchObject({ ok: false, code: "term_session_full" });
    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: true, status: "confirmed" });
    expect(await restoreLeaveForUser(member.id, rows[1].id)).toEqual({ ok: true, status: "confirmed" });
  });

  test("term_and_single releases the leave seat: others can take it, then the leaver cannot come back", async ({}, testInfo) => {
    const { id, member, term, rows } = await seedJoined("single", testInfo, { mode: "term_and_single", capacity: 1, count: 2 });
    const other = await seedMember(id, "b");
    for (const enrollment of rows) await leave(enrollment.id);

    expect((await createSeriesEnrollmentForUser(other.id, term.series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);
    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: false, code: "leave_restore_session_full" });
    expect((await row(rows[0].id)).status).toBe("cancelled");
  });

  test("once the term is withdrawn or declined there is nothing to go back to", async ({}, testInfo) => {
    const withdrawn = await seedJoined("withdrawn", testInfo);
    await leave(withdrawn.rows[0].id);
    expect((await withdrawSeriesEnrollmentForUser(withdrawn.member.id, withdrawn.joined.seriesEnrollmentId, undefined, noNotify)).ok).toBe(true);
    expect(await restoreLeaveForUser(withdrawn.member.id, withdrawn.rows[0].id)).toEqual({ ok: false, code: "series_enrollment_not_active" });

    const declined = await seedJoined("declined", testInfo, { requiresApproval: true });
    await leave(declined.rows[0].id);
    expect((await declineSeriesEnrollmentForTeacher(declined.teacher.teacherProfileId, declined.joined.seriesEnrollmentId)).ok).toBe(true);
    expect(await restoreLeaveForUser(declined.member.id, declined.rows[0].id)).toEqual({ ok: false, code: "series_enrollment_not_active" });
  });

  test("rejections: started class, suspended teacher, not a leave, someone else's enrollment", async ({}, testInfo) => {
    const { teacher, member, rows } = await seedJoined("reject", testInfo);
    const stranger = await seedMember(runId(testInfo, "reject-x"), "x");
    await leave(rows[0].id);
    await leave(rows[1].id);
    await prisma.enrollment.update({ where: { id: rows[1].id }, data: { cancelledBy: "admin" } });

    expect(await restoreLeaveForUser(stranger.id, rows[0].id)).toEqual({ ok: false, code: "enrollment_not_found" });
    expect(await restoreLeaveForUser(member.id, rows[1].id)).toEqual({ ok: false, code: "leave_not_restorable" });
    expect(await restoreLeaveForUser(member.id, rows[2].id)).toEqual({ ok: false, code: "leave_not_restorable" });

    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: false, code: "teacher_not_approved" });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "approved" } });

    await markStarted(rows[0].classSessionId);
    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: false, code: "class_session_already_started" });
  });

  test("a single (not in a term) member cancellation is not a leave", async ({}, testInfo) => {
    const id = runId(testInfo, "plain");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 1 });
    const single = await createEnrollmentForUser(member.id, term.sessions[0].id, { notes: null });
    if (!single.ok) throw new Error("fixture");
    await leave(single.enrollmentId);

    expect(await restoreLeaveForUser(member.id, single.enrollmentId)).toEqual({ ok: false, code: "leave_not_restorable" });
  });

  test("restoring a leave and a single member racing for the last seat never overbook", async ({}, testInfo) => {
    const { id, member, term, rows } = await seedJoined("race", testInfo, { mode: "term_and_single", capacity: 1, count: 1 });
    const other = await seedMember(id, "b");
    await leave(rows[0].id);

    const results = await Promise.all([restoreLeaveForUser(member.id, rows[0].id), createEnrollmentForUser(other.id, term.sessions[0].id, { notes: null })]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.enrollment.count({ where: { classSessionId: term.sessions[0].id, status: { in: ["pending", "confirmed"] } } })).toBe(1);
  });

  test("restoring a leave while withdrawing the whole term ends consistent: the term is withdrawn and nothing stays active", async ({}, testInfo) => {
    const { member, joined, rows } = await seedJoined("withdraw-race", testInfo);
    await leave(rows[0].id);

    await Promise.all([restoreLeaveForUser(member.id, rows[0].id), withdrawSeriesEnrollmentForUser(member.id, joined.seriesEnrollmentId, undefined, noNotify)]);

    expect((await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: joined.seriesEnrollmentId } })).status).toBe("withdrawn");
    expect(await prisma.enrollment.count({ where: { seriesEnrollmentId: joined.seriesEnrollmentId, status: { in: ["pending", "confirmed"] } } })).toBe(0);
  });
});

test.describe("seat occupancy rule is used everywhere", () => {
  test("the capacity floor for editing counts a term_only leave seat, but not a term_and_single one", async ({}, testInfo) => {
    for (const [mode, expected] of [["term_only", false], ["term_and_single", true]] as const) {
      const { id, teacher, term, rows } = await seedJoined(`floor-${mode}`, testInfo, { mode, capacity: 2, count: 1 });
      const other = await seedMember(id, "b");
      expect((await createSeriesEnrollmentForUser(other.id, term.series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);
      await leave(rows[0].id);
      const session = term.sessions[0];

      const result = await editClassSessionForTeacher(teacher.teacherProfileId, session.id, {
        title: term.series.title,
        description: "",
        serviceTypes: ["放鬆紓壓"],
        yogaStyles: ["哈達瑜伽"],
        location: "台北市期班教室",
        startAt: formatTaipeiDatetimeLocal(session.startAt),
        endAt: formatTaipeiDatetimeLocal(session.endAt),
        capacity: 1,
      });
      // term_only：請假名額保留，占用 2，不能縮到 1；term_and_single：請假名額已釋出，占用 1，可以縮到 1。
      expect(result.ok).toBe(expected);
      if (!result.ok) expect(result).toMatchObject({ code: "capacity_below_enrolled", enrolledCount: 2 });
    }
  });

  test("the public term card treats a term_only leave seat as taken", async ({}, testInfo) => {
    const only = await seedJoined("card-only", testInfo, { mode: "term_only", capacity: 1, count: 1 });
    const loose = await seedJoined("card-single", testInfo, { mode: "term_and_single", capacity: 1, count: 1 });
    await leave(only.rows[0].id);
    await leave(loose.rows[0].id);

    const entries = await getPublicClassListEntries({ availableOnly: false });
    const card = (seriesId: string) => entries.find((entry) => entry.kind === "term" && entry.item.id === seriesId);
    expect(card(only.term.series.id)).toMatchObject({ item: { canEnroll: false } });
    expect(card(loose.term.series.id)).toMatchObject({ item: { canEnroll: true } });
  });
});

test.describe("restore leave (UI)", () => {
  test("term_and_single: the leave confirmation explains it, and the member can cancel the leave", async ({ context, page }, testInfo) => {
    const { member, rows } = await seedJoined("ui", testInfo, { mode: "term_and_single" });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/${rows[0].classSessionId}`);
    await page.getByText("請假這一堂…").click();
    await expect(page.getByText("請假後，這一堂的名額會開放給單堂報名；整期的其他堂照常。開課前、名額還在時可以取消請假。")).toBeVisible();
    await page.getByLabel("我確認這一堂要請假。").check();
    await page.getByRole("button", { name: "確認請假" }).click();
    await expect(page.getByText("已請假這一堂，整期的其他堂照常。")).toBeVisible();

    const region = page.getByRole("region", { name: "你的報名狀態" });
    await expect(region).toContainText("開課前、名額還在時可以取消請假");
    await region.getByRole("button", { name: "取消請假" }).click();
    await expect(page.getByText("已取消請假，這一堂照常上課。")).toBeVisible();
    await expect(region).toContainText("已報名");
    expect(await row(rows[0].id)).toMatchObject({ status: "confirmed", cancelledBy: null });
  });

  test("term_only: the leave confirmation says the seat is kept", async ({ context, page }, testInfo) => {
    const { member, rows } = await seedJoined("ui-only", testInfo, { mode: "term_only" });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/${rows[0].classSessionId}`);
    await page.getByText("請假這一堂…").click();
    await expect(page.getByText("請假後，這一堂會標示為請假；整期的其他堂照常。開課前可以取消請假。")).toBeVisible();
    await page.getByLabel("我確認這一堂要請假。").check();
    await page.getByRole("button", { name: "確認請假" }).click();
    await expect(page.getByRole("region", { name: "你的報名狀態" })).toContainText("名額已為你保留");
  });

  test("no button when it cannot work: seat taken, term withdrawn, term declined", async ({ context, page }, testInfo) => {
    const full = await seedJoined("ui-full", testInfo, { mode: "term_and_single", capacity: 1, count: 1 });
    const other = await seedMember(full.id, "b");
    await leave(full.rows[0].id);
    await createEnrollmentForUser(other.id, full.term.sessions[0].id, { notes: null });
    await addAuthSessionCookie(context, full.member.sessionToken);
    const region = page.getByRole("region", { name: "你的報名狀態" });

    await page.goto(`/classes/${full.rows[0].classSessionId}`);
    await expect(region).toContainText("這一堂名額已被報滿，請聯絡老師。");
    await expect(region.getByRole("button", { name: "取消請假" })).toHaveCount(0);

    const withdrawn = await seedJoined("ui-withdrawn", testInfo);
    await leave(withdrawn.rows[0].id);
    await withdrawSeriesEnrollmentForUser(withdrawn.member.id, withdrawn.joined.seriesEnrollmentId, undefined, noNotify);
    await context.clearCookies();
    await addAuthSessionCookie(context, withdrawn.member.sessionToken);
    await page.goto(`/classes/${withdrawn.rows[0].classSessionId}`);
    await expect(region).toContainText("你已退出這一期，這一堂無法再報名。");
    await expect(region.getByRole("button", { name: "取消請假" })).toHaveCount(0);

    const declined = await seedJoined("ui-declined", testInfo, { requiresApproval: true });
    await leave(declined.rows[0].id);
    await declineSeriesEnrollmentForTeacher(declined.teacher.teacherProfileId, declined.joined.seriesEnrollmentId);
    await context.clearCookies();
    await addAuthSessionCookie(context, declined.member.sessionToken);
    await page.goto(`/classes/${declined.rows[0].classSessionId}`);
    await expect(region).toContainText("老師婉拒了你的整期報名，這一堂無法再報名。");
    await expect(region.getByRole("button", { name: "取消請假" })).toHaveCount(0);
  });

  test("a member who cancelled one single of a term is told to re-enroll it before joining the whole term", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "r6");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 2, title: `先重報期班 ${id}` });
    const single = await createEnrollmentForUser(member.id, term.sessions[0].id, { notes: null });
    if (!single.ok) throw new Error("fixture");
    await leave(single.enrollmentId);
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/terms/${term.series.id}`);
    await expect(page.getByText("請先到那一堂重新報名，再回來報整期。")).toBeVisible();
    expect(await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify)).toMatchObject({ ok: false, code: "term_has_cancelled_enrollment", reEnrollable: true });

    // 老師婉拒的取消不能重報：維持原本的提示。
    await prisma.enrollment.update({ where: { id: single.enrollmentId }, data: { cancelledBy: "teacher" } });
    await page.goto(`/classes/terms/${term.series.id}`);
    await expect(page.getByText("這一期無法再報整期。")).toBeVisible();
  });
});
