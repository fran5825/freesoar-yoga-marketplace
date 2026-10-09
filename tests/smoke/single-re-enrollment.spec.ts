import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// enrollment-re-enrollment 票 02：單堂重新報名（ADR 0006、spec 4.2、4.6、4.7）。
const fixtures = createTermFixtures("single-re-enrollment-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous, markStarted } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const row = (id: string) => prisma.enrollment.findUniqueOrThrow({ where: { id } });

async function seedEnrolled(label: string, testInfo: Parameters<typeof runId>[0], options: { capacity?: number; requiresApproval?: boolean } = {}) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1, capacity: options.capacity ?? 5, title: `重報 ${id}` });
  if (options.requiresApproval) {
    await prisma.classSession.update({ where: { id: sessions[0].id }, data: { requiresApproval: true } });
  }
  const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: "第一次" });
  if (!created.ok) throw new Error("fixture");

  return { id, teacher, member, session: sessions[0], enrollmentId: created.enrollmentId };
}

async function cancelAs(enrollmentId: string, cancelledBy: "member" | "teacher" | "admin" | "system" | null) {
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "cancelled", cancelledBy } });
}

test.describe("single re-enrollment (domain)", () => {
  test("a member-cancelled enrollment is reused: status restored, notes and consent overwritten, cancelledBy cleared; unlimited times", async ({}, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("reuse", testInfo);
    const firstConsent = (await row(enrollmentId)).consentedAt;

    for (const round of [1, 2, 3]) {
      await cancelAs(enrollmentId, "member");
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await createEnrollmentForUser(member.id, session.id, { notes: `第 ${round} 次重報` });
      expect(result).toEqual({ ok: true, enrollmentId, status: "confirmed" });
      expect(await row(enrollmentId)).toMatchObject({ status: "confirmed", cancelledBy: null, notes: `第 ${round} 次重報` });
    }
    expect((await row(enrollmentId)).consentedAt.getTime()).toBeGreaterThan(firstConsent.getTime());
    expect(await prisma.enrollment.count({ where: { classSessionId: session.id, userId: member.id } })).toBe(1);
  });

  test("a class that needs approval goes back to pending and notifies the member and the teacher", async ({}, testInfo) => {
    const { teacher, member, session, enrollmentId } = await seedEnrolled("approval", testInfo, { requiresApproval: true });
    await prisma.notification.deleteMany({ where: { userId: { in: [member.id, teacher.userId] } } });
    await cancelAs(enrollmentId, "member");

    expect(await createEnrollmentForUser(member.id, session.id, { notes: null })).toEqual({ ok: true, enrollmentId, status: "pending" });
    expect(await row(enrollmentId)).toMatchObject({ status: "pending", cancelledBy: null });
    expect(await prisma.notification.count({ where: { userId: member.id, type: "enrollment_pending_review" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: teacher.userId, type: "enrollment_pending_review" } })).toBe(1);
  });

  test("direct confirmation sends the usual enrollment_confirmed notification", async ({}, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("confirmed-note", testInfo);
    await prisma.notification.deleteMany({ where: { userId: member.id } });
    await cancelAs(enrollmentId, "member");

    expect((await createEnrollmentForUser(member.id, session.id, { notes: null })).ok).toBe(true);
    expect(await prisma.notification.count({ where: { userId: member.id, type: "enrollment_confirmed" } })).toBe(1);
  });

  test("not reusable: teacher, admin, system and legacy NULL cancellations; an active enrollment stays 'active'", async ({}, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("blocked", testInfo);

    expect(await createEnrollmentForUser(member.id, session.id, { notes: null })).toEqual({ ok: false, code: "already_enrolled", alreadyEnrolledReason: "active" });
    for (const [by, reason] of [["teacher", "teacher"], ["admin", "admin"], ["system", "system"], [null, "unknown"]] as const) {
      await cancelAs(enrollmentId, by);
      expect(await createEnrollmentForUser(member.id, session.id, { notes: null })).toEqual({ ok: false, code: "already_enrolled", alreadyEnrolledReason: reason });
      expect((await row(enrollmentId)).status).toBe("cancelled");
    }
  });

  test("a leave inside a term is not re-enrolled as a single (it goes through cancel-leave)", async ({}, testInfo) => {
    const id = runId(testInfo, "leave");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 2, mode: "term_and_single" });
    const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify);
    if (!joined.ok) throw new Error("fixture");
    const leave = await prisma.enrollment.findFirstOrThrow({ where: { seriesEnrollmentId: joined.seriesEnrollmentId, classSessionId: sessions[0].id } });
    await cancelAs(leave.id, "member");

    expect(await createEnrollmentForUser(member.id, sessions[0].id, { notes: null })).toEqual({ ok: false, code: "already_enrolled", alreadyEnrolledReason: "member_in_term" });
    expect((await row(leave.id)).status).toBe("cancelled");
  });

  test("full class, started class and non-approved teacher are rejected like a new enrollment", async ({}, testInfo) => {
    const { teacher, member, session, enrollmentId } = await seedEnrolled("limits", testInfo, { capacity: 1 });
    const other = await seedMember(runId(testInfo, "limits-other"), "b");
    await cancelAs(enrollmentId, "member");
    expect((await createEnrollmentForUser(other.id, session.id, { notes: null })).ok).toBe(true);

    expect(await createEnrollmentForUser(member.id, session.id, { notes: null })).toEqual({ ok: false, code: "class_session_full" });
    expect((await row(enrollmentId)).status).toBe("cancelled");

    await prisma.enrollment.deleteMany({ where: { classSessionId: session.id, userId: other.id } });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    expect(await createEnrollmentForUser(member.id, session.id, { notes: null })).toEqual({ ok: false, code: "teacher_not_approved" });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "approved" } });

    await markStarted(session.id);
    expect(await createEnrollmentForUser(member.id, session.id, { notes: null })).toEqual({ ok: false, code: "class_session_already_started" });
  });

  test("two simultaneous re-enrollments by the same member yield exactly one active enrollment", async ({}, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("double", testInfo);
    await cancelAs(enrollmentId, "member");

    const results = await Promise.all([
      createEnrollmentForUser(member.id, session.id, { notes: "a" }),
      createEnrollmentForUser(member.id, session.id, { notes: "b" }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: "already_enrolled", alreadyEnrolledReason: "active" }]);
    expect(await prisma.enrollment.count({ where: { classSessionId: session.id, userId: member.id, status: "confirmed" } })).toBe(1);
  });

  test("a re-enrollment and a new member racing for the last seat never overbook", async ({}, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("race", testInfo, { capacity: 1 });
    const other = await seedMember(runId(testInfo, "race-other"), "b");
    await cancelAs(enrollmentId, "member");

    const results = await Promise.all([
      createEnrollmentForUser(member.id, session.id, { notes: null }),
      createEnrollmentForUser(other.id, session.id, { notes: null }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.enrollment.count({ where: { classSessionId: session.id, status: { in: ["pending", "confirmed"] } } })).toBe(1);
  });
});

test.describe("single re-enrollment (UI)", () => {
  test("the member re-enrolls from the class page, and cancelling again explains it", async ({ context, page }, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("ui", testInfo);
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/${session.id}`);
    await page.getByText("取消報名…").click();
    await expect(page.getByText("取消後，開課前可以重新報名；名額被報滿則不能。")).toBeVisible();
    await page.getByLabel("我確認要取消這則報名。").check();
    await page.getByRole("button", { name: "確認取消" }).click();
    await expect(page.getByText("報名已取消。")).toBeVisible();

    const region = page.getByRole("region", { name: "你的報名狀態" });
    await expect(region).toContainText("可以重新報名");
    await region.getByLabel("備註（選填）").fill("想再來一次");
    await region.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
    await region.getByRole("button", { name: "重新報名" }).click();
    await expect(page.getByText("已重新報名。")).toBeVisible();
    await expect(region).toContainText("已報名");
    expect(await row(enrollmentId)).toMatchObject({ status: "confirmed", cancelledBy: null, notes: "想再來一次" });
  });

  test("a class that needs approval shows the re-submit label", async ({ context, page }, testInfo) => {
    const { member, session, enrollmentId } = await seedEnrolled("ui-approval", testInfo, { requiresApproval: true });
    await cancelAs(enrollmentId, "member");
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/${session.id}`);
    const region = page.getByRole("region", { name: "你的報名狀態" });
    await region.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
    await region.getByRole("button", { name: "重新送出報名申請" }).click();
    await expect(page.getByText("重新報名已送出，等待老師確認。")).toBeVisible();
    expect((await row(enrollmentId)).status).toBe("pending");
  });

  test("no form is shown when it cannot work: full, teacher declined, admin cancelled, legacy, teacher not approved", async ({ context, page }, testInfo) => {
    const { teacher, member, session, enrollmentId } = await seedEnrolled("ui-blocked", testInfo, { capacity: 1 });
    const other = await seedMember(runId(testInfo, "ui-blocked-other"), "b");
    await addAuthSessionCookie(context, member.sessionToken);
    const region = page.getByRole("region", { name: "你的報名狀態" });
    const noForm = async () => {
      await expect(region.getByRole("button", { name: /重新報名|重新送出/ })).toHaveCount(0);
      await expect(region.getByLabel("備註（選填）")).toHaveCount(0);
    };

    await cancelAs(enrollmentId, "member");
    await createEnrollmentForUser(other.id, session.id, { notes: null });
    await page.goto(`/classes/${session.id}`);
    await expect(region).toContainText("這堂課名額已滿，暫時不能重新報名。");
    await noForm();
    await prisma.enrollment.deleteMany({ where: { classSessionId: session.id, userId: other.id } });

    await cancelAs(enrollmentId, "teacher");
    await page.goto(`/classes/${session.id}`);
    await expect(region).toContainText("老師婉拒了這次報名，無法重新報名。");
    await noForm();

    await cancelAs(enrollmentId, "admin");
    await page.goto(`/classes/${session.id}`);
    await expect(region).toContainText("這筆報名已由管理員取消，無法重新報名。");
    await noForm();

    await cancelAs(enrollmentId, null);
    await page.goto(`/classes/${session.id}`);
    await expect(region).toContainText("這筆報名已取消，無法再次報名此課程。");
    await noForm();

    await cancelAs(enrollmentId, "member");
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    await page.goto(`/classes/${session.id}`);
    await expect(region).toContainText("這位老師目前無法接受新報名。");
    await noForm();
  });
});
