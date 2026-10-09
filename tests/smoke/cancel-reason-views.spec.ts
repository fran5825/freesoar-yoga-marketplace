import { expect, test } from "@playwright/test";

import { formatTaipeiDatetime } from "../../src/domain/class-session/timezone";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, createUserSession, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// enrollment-re-enrollment 票 04：老師名單把請假與管理員取消分開、管理員在名單看到取消原因（spec 4.5）。
const fixtures = createTermFixtures("cancel-reason-views-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;
const adminEmails: string[] = [];

test.afterAll(async () => {
  await prisma.session.deleteMany({ where: { user: { email: { in: adminEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: adminEmails } } });
  await fixtures.cleanup();
  await prisma.$disconnect();
});

type By = "member" | "teacher" | "admin" | "system" | null;

test("the teacher's term roster lists leave, admin cancellation and unrecorded cancellation separately", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "teacher-view");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 5, title: `名單期班 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const cancel = (index: number, cancelledBy: By) =>
    prisma.enrollment.updateMany({ where: { userId: member.id, classSessionId: sessions[index].id }, data: { status: "cancelled", cancelledBy } });
  await cancel(0, "member");
  await cancel(1, "admin");
  await cancel(2, null);
  // 第 4 堂整堂被老師停課：不列。
  await cancel(3, "system");
  await prisma.classSession.update({ where: { id: sessions[3].id }, data: { status: "cancelled" } });

  await addAuthSessionCookie(context, teacher.sessionToken);
  await page.goto(`/teacher/classes/series/${series.id}`);
  const roster = page.locator("#term-enrollments");
  await expect(roster).toContainText(`請假：${formatTaipeiDatetime(sessions[0].startAt)}`);
  await expect(roster).toContainText(`管理員取消：${formatTaipeiDatetime(sessions[1].startAt)}`);
  await expect(roster).toContainText(`已取消（原因未記錄）：${formatTaipeiDatetime(sessions[2].startAt)}`);
  await expect(roster).not.toContainText(formatTaipeiDatetime(sessions[3].startAt));
  await expect(roster).not.toContainText("請假或取消");
});

test("the admin roster shows a reason next to every cancelled enrollment", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "admin-view");
  const teacher = await seedTeacher(id);
  const adminEmail = `admin-${id}@cancel-reason-views-smoke.local`;
  adminEmails.push(adminEmail);
  await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);

  const single = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `原因單堂 ${id}` });
  const stopped = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `原因停課 ${id}`, dayOfWeek: 5 });
  const term = await seedTerm(teacher.teacherProfileId, { count: 2, title: `原因期班 ${id}` });
  const label = async (key: string, classSessionId: string, status: "confirmed" | "cancelled", cancelledBy: By) => {
    const member = await seedMember(id, key);
    await prisma.user.update({ where: { id: member.id }, data: { name: `原因${key}號` } });
    await prisma.enrollment.create({ data: { classSessionId, userId: member.id, status, cancelledBy, consentedAt: new Date() } });
  };

  await label("m", single.sessions[0].id, "cancelled", "member");
  await label("t", single.sessions[0].id, "cancelled", "teacher");
  await label("a", single.sessions[0].id, "cancelled", "admin");
  await label("s", single.sessions[0].id, "cancelled", "system");
  await label("u", single.sessions[0].id, "cancelled", null);
  await label("c", single.sessions[0].id, "confirmed", null);

  const leaver = await seedMember(id, "leaver");
  await prisma.user.update({ where: { id: leaver.id }, data: { name: "原因leaver號" } });
  const joined = await createSeriesEnrollmentForUser(leaver.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  await prisma.enrollment.updateMany({ where: { userId: leaver.id, classSessionId: term.sessions[0].id }, data: { status: "cancelled", cancelledBy: "member" } });

  await label("x", stopped.sessions[0].id, "cancelled", "system");
  await prisma.classSession.update({ where: { id: stopped.sessions[0].id }, data: { status: "cancelled" } });

  await page.goto(`/admin/classes/${single.sessions[0].id}`);
  await expect(page.locator("li", { hasText: "原因m號" })).toContainText("（學員取消）");
  await expect(page.locator("li", { hasText: "原因t號" })).toContainText("（老師婉拒）");
  await expect(page.locator("li", { hasText: "原因a號" })).toContainText("（管理員取消）");
  await expect(page.locator("li", { hasText: "原因s號" })).toContainText("（系統取消）");
  await expect(page.locator("li", { hasText: "原因u號" })).toContainText("（原因未記錄）");
  await expect(page.locator("li", { hasText: "原因c號" })).not.toContainText("（");

  await page.goto(`/admin/classes/${term.sessions[0].id}`);
  await expect(page.locator("li", { hasText: "原因leaver號" })).toContainText("（學員請假）");

  await page.goto(`/admin/classes/${stopped.sessions[0].id}`);
  await expect(page.locator("li", { hasText: "原因x號" })).toContainText("（老師停課／課程取消）");
});
