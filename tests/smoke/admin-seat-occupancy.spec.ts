import { expect, test } from "@playwright/test";

import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, createUserSession, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// enrollment-re-enrollment 票 03（Codex code review 補強）：管理員課程頁的「名額佔用」與報名時的名額規則一致。
const fixtures = createTermFixtures("admin-seat-occupancy-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;
const adminEmails: string[] = [];

test.afterAll(async () => {
  await prisma.session.deleteMany({ where: { user: { email: { in: adminEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: adminEmails } } });
  await fixtures.cleanup();
  await prisma.$disconnect();
});

test("the admin class header counts a term_only leave seat as occupied, but not a term_and_single one", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "seats");
  const teacher = await seedTeacher(id);
  const adminEmail = `admin-${id}@admin-seat-occupancy-smoke.local`;
  adminEmails.push(adminEmail);
  await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);

  for (const [mode, occupied] of [["term_only", 1], ["term_and_single", 0]] as const) {
    const member = await seedMember(id, mode);
    const term = await seedTerm(teacher.teacherProfileId, { count: 1, capacity: 1, mode, title: `名額期班 ${mode} ${id}` });
    const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
    if (!joined.ok) throw new Error("fixture");
    await prisma.enrollment.updateMany({ where: { userId: member.id, classSessionId: term.sessions[0].id }, data: { status: "cancelled", cancelledBy: "member" } });

    await page.goto(`/admin/classes/${term.sessions[0].id}`);
    await expect(page.getByText(`已報名 0 人・待老師確認 0 人・名額佔用 ${occupied}／1`)).toBeVisible();
    if (occupied > 0) {
      await expect(page.getByText("目前保留 1 個")).toBeVisible();
    } else {
      await expect(page.getByText("目前保留")).toHaveCount(0);
    }
  }
});
