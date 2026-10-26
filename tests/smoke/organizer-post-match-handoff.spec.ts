import { expect, test } from "@playwright/test";

import { getClassDraftKind } from "../../src/domain/class-session/draft-kind";
import { createDemandResponse, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-post-match-handoff（spec：docs/specs/organizer-post-match-handoff-spec.md）：
// 團主選定老師之後的交接——草稿課程的提醒（票 01–03）與雙方聯絡方式（票 04）。
const testEmailDomain = "organizer-post-match-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: emails } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.demandResponse.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails.filter((email) => email.startsWith("organizer-")));
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await prisma.user.deleteMany({ where: { email: emails } });
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

function slot(daysFromNow: number) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + HOUR) };
}

// 一筆已選定老師、已轉成課程的需求，課程狀態與時間由呼叫端決定。
async function setupMatchedClass(
  id: string,
  classSession: { status: "draft" | "open_for_enrollment"; daysFromNow: number },
) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  const teacherEmail = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Handoff Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Handoff Teacher ${id}`,
    status: "approved",
  });
  const demand = await createDemandRequest({
    organizerProfileId: organizer.organizerProfileId,
    organizationId: organizer.organizationId,
    status: "converted_to_class",
    data: completeDemandRequestData({ title: `交接需求 ${id}` }),
  });
  await createDemandResponse({
    demandRequestId: demand.id,
    teacherProfileId: teacher.teacherProfileId,
    status: "selected",
  });
  const created = await prisma.classSession.create({
    data: {
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      origin: "organizer_matched",
      status: classSession.status,
      title: `交接課程 ${id}`,
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      ...slot(classSession.daysFromNow),
      location: `交接地點 ${id}`,
      capacity: 12,
    },
    select: { id: true },
  });

  return { organizer, teacher, demandId: demand.id, classSessionId: created.id };
}

test.describe("organizer post-match handoff", () => {
  test("draft kind: openable before start, expired at or after start, not_draft otherwise", () => {
    const now = new Date("2026-10-26T12:00:00.000Z");

    expect(getClassDraftKind({ status: "draft", startAt: new Date(now.getTime() + 1) }, now)).toBe("openable_draft");
    expect(getClassDraftKind({ status: "draft", startAt: now }, now)).toBe("expired_draft");
    expect(getClassDraftKind({ status: "draft", startAt: new Date(now.getTime() - HOUR) }, now)).toBe("expired_draft");
    expect(getClassDraftKind({ status: "open_for_enrollment", startAt: new Date(now.getTime() + DAY) }, now)).toBe("not_draft");
    expect(getClassDraftKind({ status: "cancelled", startAt: new Date(now.getTime() - DAY) }, now)).toBe("not_draft");
  });

  test("class page: openable draft explains members cannot see it and offers 開放報名", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "openable");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "draft", daysFromNow: 10 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();

    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByText("學員還看不到這堂課。確認時間、地點後按「開放報名」，就能複製連結分享給團員。")).toBeVisible();
    await expect(page.getByRole("button", { name: "開放報名" })).toBeVisible();
    await expect(page.getByText("開課時間已過，這堂課沒有開放報名，無法再開放。")).toHaveCount(0);
    await context.close();
  });

  test("class page: expired draft hides 開放報名 and points to new demand or direct class", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "expired");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "draft", daysFromNow: -1 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();

    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByText("開課時間已過，這堂課沒有開放報名，無法再開放。")).toBeVisible();
    await expect(page.getByRole("button", { name: "開放報名" })).toHaveCount(0);
    await expect(page.getByText("學員還看不到這堂課。", { exact: false })).toHaveCount(0);

    await page.getByRole("link", { name: "建立新的需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands\/new/);
    await page.goto(`/organizer/classes/${classSessionId}`);
    await page.getByRole("link", { name: "直接邀請合作老師開課" }).click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/new/);
    await context.close();
  });

  test("class page: opened class shows neither draft notice", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "opened");
    const { organizer, classSessionId } = await setupMatchedClass(id, { status: "open_for_enrollment", daysFromNow: 10 });
    const context = await browser.newContext();
    await addAuthSessionCookie(context, organizer.sessionToken);
    const page = await context.newPage();

    await page.goto(`/organizer/classes/${classSessionId}`);

    await expect(page.getByRole("button", { name: "複製報名連結" })).toBeVisible();
    await expect(page.getByText("學員還看不到這堂課。", { exact: false })).toHaveCount(0);
    await expect(page.getByText("開課時間已過，這堂課沒有開放報名", { exact: false })).toHaveCount(0);
    await context.close();
  });
});
