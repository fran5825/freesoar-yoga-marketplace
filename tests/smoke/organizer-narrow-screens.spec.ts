import { expect, test, type Page } from "@playwright/test";

import { openDirectClassFromProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/open-direct-class-core";
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

// organizer-usability-redesign 票 14：320px 寬的手機上，團主改版涉及的每一頁都不能出現水平捲動。
// 用很長、沒有空白的名稱測試最壞情況（長團體名、長老師名、長課名）。截圖留在 .ai-runs/organizer-narrow/。
const testEmailDomain = "organizer-narrow-smoke.local";
const createdEmails: string[] = [];

test.use({ viewport: { width: 320, height: 640 } });

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: emails } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.demandResponse.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

const HOUR = 3_600_000;
const DAY = 86_400_000;

function slot(daysFromNow: number) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + HOUR) };
}

async function expectNoOverflow(page: Page, path: string, shot: string) {
  const response = await page.goto(path);
  await page.waitForLoadState("networkidle");
  // 確認真的停在這一頁（沒有被導去登入或 404），沒有溢出才有意義。
  expect(response?.status(), `${path} 應該正常顯示`).toBe(200);
  expect(new URL(page.url()).pathname).toBe(path.split("?")[0]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `.ai-runs/organizer-narrow/${shot}.png`, fullPage: true });
  expect(overflow, `${path} 在 320px 出現水平捲動`).toBeLessThanOrEqual(0);
}

test.describe("organizer pages at 320px", () => {
  // 一次掃過近二十頁，給比預設 30 秒長的時限。
  test.setTimeout(240_000);

  test("no horizontal overflow on organizer, teacher and member pages touched by the redesign", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "只在手機 project 跑一次");
    const id = normalizeForEmail(`narrow-${Date.now()}`);
    const longWord = `超長名稱沒有空白${"Ｘ".repeat(6)}${id}`;
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    const teacherEmail = `teacher-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `團主${longWord}`,
      organizationName: `團體${longWord}`,
      contactName: "聯絡人",
      contactEmail: `contact-${id}@example.com`,
      contactPhone: "0900000000",
    });
    const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: `老師${longWord}`, status: "approved" });
    const teacherUser = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId }, select: { userId: true } });

    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `需求${longWord}` }),
    });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId });
    const pending = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        teacherProfileId: teacher.teacherProfileId,
        title: `邀請${longWord}`,
        serviceTypes: ["伸展與身體保養"],
        ...slot(30),
        location: `地點${longWord}`,
        capacity: 10,
        status: "pending_confirmation",
        submittedAt: new Date(),
        transitionSeq: 2,
      },
    });
    const confirmed = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        teacherProfileId: teacher.teacherProfileId,
        title: `開放課${longWord}`,
        serviceTypes: ["伸展與身體保養"],
        ...slot(31),
        location: `地點${longWord}`,
        capacity: 10,
        status: "confirmed",
        submittedAt: new Date(),
        confirmedVersion: 1,
        confirmedAt: new Date(),
        confirmedByUserId: teacherUser.userId,
        transitionSeq: 3,
      },
    });
    const opened = await openDirectClassFromProposalCore(organizer.organizerProfileId, confirmed.id, 1);
    if (!opened.ok) throw new Error("open failed");

    const organizerContext = await browser.newContext({ viewport: { width: 320, height: 640 } });
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const organizerPage = await organizerContext.newPage();
    for (const [path, shot] of [
      ["/organizers/request", "organizer-entry"],
      ["/organizer/dashboard", "organizer-dashboard"],
      ["/organizer/demands", "organizer-demands"],
      ["/organizer/demands/new", "organizer-demand-new"],
      [`/organizer/demands/${demand.id}`, "organizer-demand-detail"],
      ["/organizer/class-proposals/new", "organizer-proposal-new"],
      [`/organizer/class-proposals/${pending.id}`, "organizer-proposal-detail"],
      [`/organizer/class-proposals/${pending.id}/edit`, "organizer-proposal-edit"],
      ["/organizer/classes", "organizer-classes"],
      [`/organizer/classes/${opened.classSessionId}`, "organizer-class-detail"],
      ["/organizer/organizations", "organizer-organizations"],
      ["/organizer/profile", "organizer-profile"],
      ["/organizer/notifications", "organizer-notifications"],
    ] as const) {
      await expectNoOverflow(organizerPage, path, shot);
    }
    await organizerContext.close();

    const teacherContext = await browser.newContext({ viewport: { width: 320, height: 640 } });
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const teacherPage = await teacherContext.newPage();
    for (const [path, shot] of [
      ["/teacher/dashboard", "teacher-dashboard"],
      [`/teacher/class-proposals/${pending.id}`, "teacher-proposal"],
      [`/teacher/classes/${opened.classSessionId}`, "teacher-class"],
      ["/teacher/notifications", "teacher-notifications"],
    ] as const) {
      await expectNoOverflow(teacherPage, path, shot);
    }
    await teacherContext.close();

    const visitorContext = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const visitorPage = await visitorContext.newPage();
    await expectNoOverflow(visitorPage, "/organizers/request", "visitor-entry");
    await expectNoOverflow(visitorPage, `/classes/${opened.classSessionId}`, "visitor-class-guide");
    await visitorContext.close();
  });
});
