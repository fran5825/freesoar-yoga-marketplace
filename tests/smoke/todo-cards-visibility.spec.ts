import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import { cleanupDemandResponseFixtures, createDemandResponse } from "./_helpers/demand-response-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";

// inline-member-actions 票 04：「待你處理」沒有輪到自己處理的事項就整張不出現；有事項時是第一張卡；等待事項另放（spec I10）。
const fixtures = createTermFixtures("todo-cards-visibility-smoke.local");
const { runId, seedTeacher, seedMember, seedContinuous } = fixtures;

const organizerEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(organizerEmails);
  await prisma.user.deleteMany({ where: { email: { in: organizerEmails } } });
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const noEmptyCard = async (page: import("@playwright/test").Page) => {
  await expect(page.getByRole("region", { name: "待你處理" })).toHaveCount(0);
  await expect(page.getByText("目前沒有待處理事項")).toHaveCount(0);
};

test("member: waiting-for-teacher alone does not make a 待你處理 card; a class to review does, and it is the first card", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "member");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const waiting = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `等老師 ${id}` });
  await prisma.classSession.update({ where: { id: waiting.sessions[0].id }, data: { requiresApproval: true } });
  expect((await createEnrollmentForUser(member.id, waiting.sessions[0].id, { notes: null })).ok).toBe(true);
  await addAuthSessionCookie(context, member.sessionToken);

  for (const path of ["/member/dashboard", "/member/enrollments"]) {
    await page.goto(path);
    await noEmptyCard(page);
    await expect(page.getByRole("region", { name: "等待老師確認" })).toBeVisible();
  }

  // 一堂已結束、還沒評價的課 → 待你處理，而且在其他卡片之前。
  const done = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `待評價 ${id}`, dayOfWeek: 5 });
  await prisma.enrollment.create({ data: { classSessionId: done.sessions[0].id, userId: member.id, status: "confirmed", consentedAt: new Date() } });
  await prisma.classSession.update({
    where: { id: done.sessions[0].id },
    data: { status: "completed", startAt: new Date(Date.now() - 7_200_000), endAt: new Date(Date.now() - 3_600_000) },
  });

  for (const path of ["/member/dashboard", "/member/enrollments"]) {
    await page.goto(path);
    const todo = page.getByRole("heading", { name: "待你處理" });
    await expect(todo).toBeVisible();
    const todoY = (await todo.boundingBox())!.y;
    for (const other of [page.getByRole("heading", { name: "等待老師確認" }), page.getByRole("heading", { name: "即將上課" })]) {
      if ((await other.count()) > 0) expect((await other.first().boundingBox())!.y).toBeGreaterThan(todoY);
    }
  }
});

test("member with nothing at all: no 待你處理 card and no empty message", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "empty");
  const member = await seedMember(id, "a");
  await addAuthSessionCookie(context, member.sessionToken);

  for (const path of ["/member/dashboard", "/member/enrollments"]) {
    await page.goto(path);
    await noEmptyCard(page);
  }
});

test("teacher: only a waiting item shows 等待對方回覆 and no 待你處理; nothing at all shows neither", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "teacher");
  const teacher = await seedTeacher(id);
  await addAuthSessionCookie(context, teacher.sessionToken);

  await page.goto("/teacher/dashboard");
  await noEmptyCard(page);
  await expect(page.getByRole("region", { name: "等待對方回覆" })).toHaveCount(0);

  const organizerEmail = `organizer-${id}@todo-cards-visibility-smoke.local`;
  organizerEmails.push(organizerEmail);
  const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Org ${id}`,
  });
  const demand = await createDemandRequest({ organizerProfileId, organizationId, status: "matched", data: completeDemandRequestData({ title: `只剩等待 ${id}` }) });
  await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId, status: "selected" });
  await page.goto("/teacher/dashboard");
  await noEmptyCard(page);
  await expect(page.getByRole("region", { name: "等待對方回覆" })).toContainText(`只剩等待 ${id}`);
});

test("organizer with nothing to do shows no 待你處理 card", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "organizer");
  const email = `organizer-${id}@todo-cards-visibility-smoke.local`;
  organizerEmails.push(email);
  const { sessionToken } = await createOrganizerProfileWithOrganization({ email, displayName: `Organizer ${id}`, organizationName: `Org ${id}` });
  await addAuthSessionCookie(context, sessionToken);

  await page.goto("/organizer/dashboard");
  await noEmptyCard(page);
});
