import { expect, test, type Page } from "@playwright/test";

import { cancelClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/cancel-class-session-core";
import { cancelClassSessionForTeacher } from "../../src/domain/class-session/__internal__/cancel-class-session-core-for-teacher";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { cancelDemandRequestForOrganizer } from "../../src/domain/demand-request/__internal__/cancel-demand-request-core";
import {
  selectDemandResponseForOrganizer,
  submitDemandResponseForTeacher,
} from "../../src/domain/demand-response/__internal__/select-and-submit-core";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { notifyUsers } from "../../src/domain/notification/create";
import type { EmailConfig } from "../../src/domain/notification/email-config";
import type { EmailMessage } from "../../src/domain/notification/email-transport";
import { futureDateTime } from "./_helpers/future-dates";
import { createDemandResponse, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";

// wrong-route-fixes 票 01、02（spec「通知 target」）：同一個帳號同時是老師＋團主＋學員（管理員也可能兼團主、老師）時，
// 每則通知都連到收件人「那個身分」該看的頁面，不再依身分猜（團主優先）而走錯頁。
const testEmailDomain = "notification-role-targets-smoke.local";
const fixtures = createTermFixtures(testEmailDomain);
const createdEmails: string[] = [];
const DAY = 86_400_000;

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: emails } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.demandResponse.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.demandRequest.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.organization.deleteMany({ where: { ownerOrganizerProfile: { user: { email: emails } } } });
  await prisma.organizerProfile.deleteMany({ where: { user: { email: emails } } });
  await fixtures.cleanup();
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await prisma.user.deleteMany({ where: { email: emails } });
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return fixtures.runId(testInfo, label);
}

// 老師＋團主＋（之後報名就是）學員的同一個帳號。
async function seedMultiRoleUser(id: string, label: string, isAdmin = false) {
  const email = `multi-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({ email, displayName: `多重身分 ${label}`, status: "approved" });
  if (isAdmin) await prisma.user.update({ where: { id: teacher.userId }, data: { isAdmin: true } });
  const organizerProfile = await prisma.organizerProfile.create({ data: { userId: teacher.userId, displayName: `多重身分團主 ${label}` } });
  const organization = await prisma.organization.create({
    data: {
      name: `多重身分團體 ${label} ${id}`,
      type: "company",
      contactName: "聯絡人",
      contactEmail: `contact-${label}-${id}@example.com`,
      contactPhone: "0900000000",
      ownerOrganizerProfileId: organizerProfile.id,
    },
  });
  return { ...teacher, email, organizerProfileId: organizerProfile.id, organizationId: organization.id };
}

async function seedTeacher(id: string, label: string) {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({ email, displayName: `老師 ${label}`, status: "approved" });
}

async function seedOrganizer(id: string, label: string) {
  const email = `organizer-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createOrganizerProfileWithOrganization({
    email,
    displayName: `團主 ${label}`,
    organizationName: `團體 ${label} ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${label}-${id}@example.com`,
    contactPhone: "0900000000",
  });
}

async function seedClass(teacherProfileId: string, title: string, options: { daysFromNow: number; requiresApproval?: boolean }) {
  const start = new Date(Date.now() + options.daysFromNow * DAY);
  start.setUTCHours(3, 0, 0, 0);
  return prisma.classSession.create({
    data: {
      origin: "teacher_initiated",
      teacherProfileId,
      title,
      description: "說明",
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: start,
      endAt: new Date(start.getTime() + 3_600_000),
      location: "台北市測試教室",
      capacity: 10,
      isPublic: false,
      requiresApproval: options.requiresApproval ?? false,
      status: "open_for_enrollment",
    },
  });
}

async function openNotifications(page: Page, sessionToken: string) {
  await addAuthSessionCookie(page.context(), sessionToken);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "我的通知" })).toBeVisible();
}

function notificationLink(page: Page, text: string) {
  return page.locator("article").filter({ hasText: text }).getByRole("link");
}

test.describe("notification links for multi-role accounts", () => {
  test("member side: change, cancel and pending review link to member pages", async ({ page }, testInfo) => {
    const id = runId(testInfo, "member");
    const multi = await seedMultiRoleUser(id, "member");
    const teacher = await seedTeacher(id, "owner");
    const changed = await seedClass(teacher.teacherProfileId, `異動課 ${id}`, { daysFromNow: 20 });
    const cancelled = await seedClass(teacher.teacherProfileId, `取消課 ${id}`, { daysFromNow: 21 });
    const review = await seedClass(teacher.teacherProfileId, `審核課 ${id}`, { daysFromNow: 22, requiresApproval: true });
    for (const classSession of [changed, cancelled]) {
      await prisma.enrollment.create({ data: { classSessionId: classSession.id, userId: multi.userId, status: "confirmed", consentedAt: new Date() } });
    }

    const newStart = new Date(changed.startAt.getTime() + 30 * 60_000);
    const edited = await editClassSessionForTeacher(teacher.teacherProfileId, changed.id, {
      title: changed.title,
      description: "說明",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: formatTaipeiDatetimeLocal(newStart),
      endAt: formatTaipeiDatetimeLocal(new Date(newStart.getTime() + 3_600_000)),
      location: changed.location,
      capacity: changed.capacity,
    });
    expect(edited).toMatchObject({ ok: true });
    expect(await cancelClassSessionForTeacher(teacher.teacherProfileId, cancelled.id)).toMatchObject({ ok: true });
    expect(await createEnrollmentForUser(multi.userId, review.id, { notes: null })).toMatchObject({ ok: true, status: "pending" });

    // 授課老師收到的待審核通知直達老師端那堂課。
    expect(
      await prisma.notification.findFirst({
        where: { userId: teacher.userId, type: "enrollment_pending_review", channel: "in_app" },
        select: { targetType: true, targetId: true },
      }),
    ).toEqual({ targetType: "teacher_class_session", targetId: review.id });

    await openNotifications(page, multi.sessionToken);
    await expect(notificationLink(page, `異動課 ${id}`)).toHaveAttribute("href", `/classes/${changed.id}`);
    await expect(notificationLink(page, `取消課 ${id}`)).toHaveAttribute("href", "/member/enrollments");
    await expect(notificationLink(page, `審核課 ${id}`)).toHaveAttribute("href", `/classes/${review.id}`);

    // 點進去：多重身分帳號看得到學員課程頁（不是 not-found）。
    await notificationLink(page, `異動課 ${id}`).click();
    await expect(page).toHaveURL(new RegExp(`/classes/${changed.id}$`));
    await expect(page.getByRole("heading", { name: `異動課 ${id}` }).first()).toBeVisible();
  });

  test("teacher side: organizer-created and cancelled classes link to the teacher's class page", async ({ page }, testInfo) => {
    const id = runId(testInfo, "teacher");
    const multi = await seedMultiRoleUser(id, "teacher");
    const organizer = await seedOrganizer(id, "partner");
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `媒合需求 ${id}` }),
    });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: multi.teacherProfileId, status: "selected" });
    const validation = validateClassSessionCreate({
      title: `團主建的課 ${id}`,
      description: null,
      serviceType: "伸展與身體保養",
      startAt: futureDateTime(40, "14:00"),
      endAt: futureDateTime(40, "15:00"),
      location: "Test Studio",
      capacity: 5,
      isPublic: false,
    });
    if (!validation.valid) throw new Error("fixture");
    const created = await createClassSessionForOrganizer(organizer.organizerProfileId, demand.id, validation.normalized);
    if (!created.ok) throw new Error(`fixture: ${created.code}`);

    expect(
      await prisma.notification.findFirst({
        where: { userId: organizer.userId, type: "class_session_created", channel: "in_app" },
        select: { targetType: true, targetId: true },
      }),
    ).toEqual({ targetType: "organizer_class_session", targetId: created.classSessionId });

    await prisma.classSession.update({ where: { id: created.classSessionId }, data: { status: "open_for_enrollment" } });
    expect(await cancelClassSessionForOrganizer(organizer.organizerProfileId, created.classSessionId)).toMatchObject({ ok: true });
    const own = await seedClass(multi.teacherProfileId, `自己的課 ${id}`, { daysFromNow: 30 });
    expect(await cancelClassSessionForTeacher(multi.teacherProfileId, own.id)).toMatchObject({ ok: true });

    await openNotifications(page, multi.sessionToken);
    const organizerClassLinks = notificationLink(page, `團主建的課 ${id}`);
    await expect(organizerClassLinks).toHaveCount(2);
    for (const link of await organizerClassLinks.all()) {
      await expect(link).toHaveAttribute("href", `/teacher/classes/${created.classSessionId}`);
    }
    await expect(notificationLink(page, `自己的課 ${id}`)).toHaveAttribute("href", `/teacher/classes/${own.id}`);
  });

  test("demand side: organizer, responding teacher and admin each reach their own page", async ({ page }, testInfo) => {
    const id = runId(testInfo, "demand");
    const multi = await seedMultiRoleUser(id, "demand");
    const admin = await seedMultiRoleUser(id, "admin", true);
    const teacher = await seedTeacher(id, "responder");
    const otherOrganizer = await seedOrganizer(id, "other");
    const response = { message: "測試用回應內容，說明教學風格與合作想法。", proposedTimeSlots: ["平日晚上"], proposedPrice: null };

    // 多重身分帳號當團主：老師回應、選定老師 → 團主自己的需求詳情；管理員 → 後台那筆需求。
    const ownDemand = await createDemandRequest({
      organizerProfileId: multi.organizerProfileId,
      organizationId: multi.organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `自己的需求 ${id}` }),
    });
    const submitted = await submitDemandResponseForTeacher(teacher.teacherProfileId, ownDemand.id, response);
    if (!submitted.ok) throw new Error(`fixture: ${submitted.code}`);
    const responseRow = await prisma.demandResponse.findFirstOrThrow({ where: { demandRequestId: ownDemand.id }, select: { id: true } });
    expect(await selectDemandResponseForOrganizer(multi.organizerProfileId, responseRow.id)).toMatchObject({ ok: true });
    // 被選定的老師那一則連「團體需求」列表。
    expect(
      await prisma.notification.findFirst({
        where: { userId: teacher.userId, type: "demand_response_selected", channel: "in_app" },
        select: { targetType: true, targetId: true },
      }),
    ).toEqual({ targetType: "teacher_demand_request", targetId: ownDemand.id });

    // 多重身分帳號自己取消另一筆需求 → 團主自己的需求詳情。
    const cancelledOwn = await createDemandRequest({
      organizerProfileId: multi.organizerProfileId,
      organizationId: multi.organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `取消的需求 ${id}` }),
    });
    expect(await cancelDemandRequestForOrganizer(multi.organizerProfileId, cancelledOwn.id)).toMatchObject({ ok: true });

    // 多重身分帳號當回應的老師：別人的需求被取消 → 老師的團體需求頁。
    const otherDemand = await createDemandRequest({
      organizerProfileId: otherOrganizer.organizerProfileId,
      organizationId: otherOrganizer.organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `別人的需求 ${id}` }),
    });
    const responded = await submitDemandResponseForTeacher(multi.teacherProfileId, otherDemand.id, response);
    if (!responded.ok) throw new Error(`fixture: ${responded.code}`);
    expect(await cancelDemandRequestForOrganizer(otherOrganizer.organizerProfileId, otherDemand.id)).toMatchObject({ ok: true });

    await openNotifications(page, multi.sessionToken);
    await expect(notificationLink(page, "有老師回應了你的需求")).toHaveAttribute("href", `/organizer/demands/${ownDemand.id}`);
    await expect(notificationLink(page, "已選定老師")).toHaveAttribute("href", `/organizer/demands/${ownDemand.id}`);
    await expect(notificationLink(page, `別人的需求 ${id}`)).toHaveAttribute("href", "/teacher/demands");
    await expect(notificationLink(page, `取消的需求 ${id}`)).toHaveAttribute("href", `/organizer/demands/${cancelledOwn.id}`);

    await page.context().clearCookies();
    await openNotifications(page, admin.sessionToken);
    // 管理員的文案不含需求名稱，而且所有管理員都會收到（含平行測試建立的），所以找連到這筆需求的那一則。
    const adminLink = page.locator("article").filter({ hasText: "有新的需求回應" }).locator(`a[href="/admin/demands/${ownDemand.id}"]`);
    await expect(adminLink).toHaveCount(1);
    // 點進去：兼團主＋老師的管理員看得到後台那筆需求。
    await adminLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin/demands/${ownDemand.id}$`));
    await expect(page.getByText(`自己的需求 ${id}`).first()).toBeVisible();
  });

  test("term enrollment pending review: in-app and email both link to the term page", async ({ page }, testInfo) => {
    const id = runId(testInfo, "term");
    const multi = await seedMultiRoleUser(id, "term");
    const owner = await fixtures.seedTeacher(id);
    const term = await fixtures.seedTerm(owner.teacherProfileId, { count: 2, requiresApproval: true, title: `審核期班 ${id}` });
    const sent: EmailMessage[] = [];
    const config: EmailConfig = {
      status: "enabled",
      mode: "allowlist",
      apiKey: "test-key",
      from: "飛索 <notifications@test.local>",
      baseUrl: "https://app.test",
      allowedRecipients: new Set([multi.email]),
      timeoutMs: 1_000,
    };

    const joined = await createSeriesEnrollmentForUser(multi.userId, term.series.id, { notes: null }, undefined, (type, recipients, payload, sender, options) =>
      notifyUsers(type, recipients, payload, sender, { ...options, email: { config, transport: async (message) => void sent.push(message) } }),
    );
    expect(joined).toMatchObject({ ok: true });

    const memberEmail = sent.find((message) => message.to === multi.email);
    expect(memberEmail).toBeDefined();
    expect(decodeURIComponent(memberEmail!.text)).toContain(`/classes/terms/${term.series.id}`);
    expect(decodeURIComponent(memberEmail!.text)).not.toContain("/teacher/classes");

    await openNotifications(page, multi.sessionToken);
    await expect(notificationLink(page, "報名已送出，等待老師確認")).toHaveAttribute("href", `/classes/terms/${term.series.id}`);
  });

  test("series occurrence with a member target: alone links to the class, grouped links to the series", async ({ page }, testInfo) => {
    const id = runId(testInfo, "group");
    const multi = await seedMultiRoleUser(id, "group");
    const owner = await fixtures.seedTeacher(id);
    const single = await fixtures.seedTerm(owner.teacherProfileId, { count: 1, title: `單則期班 ${id}` });
    const grouped = await fixtures.seedTerm(owner.teacherProfileId, { count: 2, title: `合併期班 ${id}` });
    const row = (title: string, body: string, classSessionId: string, recurringClassSeriesId: string) =>
      prisma.notification.create({
        data: {
          userId: multi.userId,
          type: "class_session_changed",
          channel: "in_app",
          title,
          body,
          status: "sent",
          targetType: "member_class_session",
          targetId: classSessionId,
          recurringClassSeriesId,
        },
      });
    await row("課程時間或地點有變更", `單則 ${id}`, single.sessions[0].id, single.series.id);
    await row("課程時間或地點有變更", `合併 ${id}`, grouped.sessions[0].id, grouped.series.id);
    await row("課程時間或地點有變更", `合併 ${id}`, grouped.sessions[1].id, grouped.series.id);

    await openNotifications(page, multi.sessionToken);
    await expect(notificationLink(page, `單則 ${id}`)).toHaveAttribute("href", `/classes/${single.sessions[0].id}`);
    await expect(notificationLink(page, `合併 ${id}`)).toHaveAttribute("href", `/classes/terms/${grouped.series.id}`);
  });
});
