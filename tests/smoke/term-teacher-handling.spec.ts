import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import {
  confirmSeriesEnrollmentForTeacher,
  declineSeriesEnrollmentForTeacher,
} from "../../src/domain/enrollment/__internal__/decide-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-class-scheduling 票 10：老師對整期報名確認或婉拒一次。
const fixtures = createTermFixtures("term-teacher-handling-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

async function enrollWholeTerm(memberId: string, seriesId: string) {
  const result = await createSeriesEnrollmentForUser(memberId, seriesId, { notes: "想整期上" }, undefined, noNotify);
  expect(result.ok).toBe(true);

  return result.ok ? result.seriesEnrollmentId : "";
}

test.describe("teacher decides a term enrollment (domain)", () => {
  test("confirming once confirms every pending class and sends one notice", async ({}, testInfo) => {
    const id = runId(testInfo, "confirm");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true, count: 3 });
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);

    expect(await confirmSeriesEnrollmentForTeacher(teacher.teacherProfileId, seriesEnrollmentId)).toEqual({
      ok: true,
      affectedCount: 3,
      restoredSingleCount: 0,
    });
    expect(await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: seriesEnrollmentId } })).toMatchObject({
      status: "confirmed",
    });
    expect(await prisma.enrollment.count({ where: { userId: member.id, status: "confirmed" } })).toBe(3);
    const notices = await prisma.notification.findMany({ where: { userId: member.id } });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ type: "enrollment_confirmed" });

    expect(await confirmSeriesEnrollmentForTeacher(teacher.teacherProfileId, seriesEnrollmentId)).toEqual({
      ok: false,
      code: "series_enrollment_not_pending",
    });
  });

  test("declining cancels the term-created classes and restores a merged single enrollment with its status", async ({}, testInfo) => {
    const id = runId(testInfo, "decline");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true, count: 3 });
    // 學員先單堂報了第二堂（pending），再報整期：第二堂併入，另兩堂是整期新增，狀態都是 pending。
    const single = await createEnrollmentForUser(member.id, sessions[1].id, { notes: null });
    expect(single.ok).toBe(true);
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);

    expect(await declineSeriesEnrollmentForTeacher(teacher.teacherProfileId, seriesEnrollmentId)).toEqual({
      ok: true,
      affectedCount: 2,
      restoredSingleCount: 1,
    });

    const reloaded = await prisma.enrollment.findMany({
      where: { userId: member.id },
      orderBy: { classSession: { startAt: "asc" } },
    });
    expect(reloaded.map((enrollment) => [enrollment.status, enrollment.seriesEnrollmentId, enrollment.seriesEnrollmentSource])).toEqual([
      ["cancelled", seriesEnrollmentId, "term_created"],
      ["pending", null, null],
      ["cancelled", seriesEnrollmentId, "term_created"],
    ]);
    expect(await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: seriesEnrollmentId } })).toMatchObject({
      status: "declined",
    });
    // 恢復成單堂之後，老師可以照一般單堂流程處理（不再被當成整期子報名）。
    expect(reloaded[1].seriesEnrollmentId).toBeNull();
    expect(await prisma.notification.count({ where: { userId: member.id, type: "enrollment_cancelled" } })).toBe(1);
  });

  test("another teacher cannot decide someone else's term enrollment", async ({}, testInfo) => {
    const id = runId(testInfo, "other");
    const teacher = await seedTeacher(id);
    const other = await seedTeacher(`${id}-other`);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true });
    const seriesEnrollmentId = await enrollWholeTerm(member.id, series.id);

    expect(await confirmSeriesEnrollmentForTeacher(other.teacherProfileId, seriesEnrollmentId)).toEqual({
      ok: false,
      code: "series_enrollment_not_found",
    });
    expect(await declineSeriesEnrollmentForTeacher(other.teacherProfileId, seriesEnrollmentId)).toEqual({
      ok: false,
      code: "series_enrollment_not_found",
    });
    expect(await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: seriesEnrollmentId } })).toMatchObject({
      status: "pending",
    });
  });
});

test.describe("teacher term roster (UI)", () => {
  test("the series page lists term members and confirms one in a single click; the class page tags 整期 and links back", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true, title: `整期名單 ${id}` });
    await enrollWholeTerm(member.id, series.id);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${sessions[0].id}`);
    await expect(page.getByText("整期", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "到期班頁處理" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}#term-enrollments`));

    const roster = page.locator("#term-enrollments");
    await expect(roster).toContainText("整期學員（1）・待確認 1");
    await expect(roster).toContainText("想整期上");
    await roster.getByRole("button", { name: /確認 .* 的整期報名/ }).click();
    await expect(page.getByText("已確認整期報名，3 堂改為已報名。")).toBeVisible();
    await expect(page.locator("#term-enrollments")).toContainText("已報名");
    expect(await prisma.enrollment.count({ where: { userId: member.id, status: "confirmed" } })).toBe(3);
  });
});
