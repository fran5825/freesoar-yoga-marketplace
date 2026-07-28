import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  selectDemandResponseForOrganizer,
  submitDemandResponseForTeacher,
} from "../../src/domain/demand-response/__internal__/select-and-submit-core";
import { notifyUsers } from "../../src/domain/notification/create";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "notification-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("notification smoke", () => {
  // D1: teacher_application_submitted (self + admin fan-out with 2 admins), teacher_application_approved (self).
  test("teacher application submit notifies self + all admins, approve notifies self", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-teacher-approve-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const admin1Email = `admin1-${testRunId}@${testEmailDomain}`;
    const admin2Email = `admin2-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, admin1Email, admin2Email);

    const { userId: teacherUserId, sessionToken: teacherSession } =
      await createUserSession({ email: teacherEmail });
    const { userId: admin1Id } = await createUserSession({
      email: admin1Email,
      isAdmin: true,
    });
    const { userId: admin2Id } = await createUserSession({
      email: admin2Email,
      isAdmin: true,
    });

    const displayName = `Teacher ${testRunId}`;
    await prisma.teacherProfile.create({
      data: {
        userId: teacherUserId,
        displayName,
        bio: "bio",
        teachingStyle: "style",
        experienceYears: 3,
        specialties: ["Hatha Yoga"],
        serviceAreas: ["台北市"],
        teachingFormats: ["實體"],
        status: "draft",
      },
    });

    await addAuthSessionCookie(context, teacherSession);
    await page.goto("/teachers/join");
    await expect(page.getByLabel("公開顯示名稱")).toHaveValue(displayName);
    await page.getByRole("button", { name: "送出審核" }).click();
    await page.getByRole("button", { name: "確認送出審核" }).click();
    await expect(page.getByText("已送出審核").first()).toBeVisible();

    // 注意：listAdminUserIds() 是全域查詢（見 D5），在平行執行的其他測試檔案裡，
    // 若剛好也有 admin 使用者存在，可能也會收到「與本測試無關」的其他事件通知，
    // 這是正確行為（admin 本來就該收到所有事件），不是 bug。因此這裡只斷言「本測試
    // 建立的收件人各自至少有一筆正確內容的記錄」，不斷言總筆數（總筆數在平行測試下
    // 不是決定性的）。
    const teacherSelfNotif = await prisma.notification.findFirst({
      where: { type: "teacher_application_submitted", userId: teacherUserId },
    });
    expect(teacherSelfNotif?.title).toBe("老師申請已送出");
    expect(teacherSelfNotif?.status).toBe("sent");
    expect(teacherSelfNotif?.channel).toBe("in_app");

    for (const adminId of [admin1Id, admin2Id]) {
      const adminNotif = await prisma.notification.findFirst({
        where: {
          type: "teacher_application_submitted",
          userId: adminId,
          // actorLabel 來自 User.name（createUserSession 用 email 本地部分當 name），
          // 不是 TeacherProfile.displayName，所以用 testRunId 當作本測試的唯一標記比對。
          body: { contains: testRunId },
        },
      });
      expect(adminNotif?.title).toBe("有新的老師申請待審核");
      expect(adminNotif?.status).toBe("sent");
    }

    const { sessionToken: adminSession } = await createUserSession({
      email: `approver-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    createdEmails.push(`approver-${testRunId}@${testEmailDomain}`);
    await context.clearCookies();
    await addAuthSessionCookie(context, adminSession);
    await page.goto("/admin/teachers");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: displayName }),
    });
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("TeacherProfile application approved.")).toBeVisible();

    const approvedNotif = await prisma.notification.findFirst({
      where: { type: "teacher_application_approved", userId: teacherUserId },
    });
    expect(approvedNotif?.title).toBe("老師申請已通過");
    expect(approvedNotif?.status).toBe("sent");
  });

  // D1: teacher_application_rejected (self, with reason in body).
  test("teacher application reject notifies self with the rejection reason", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-teacher-reject-${Date.now()}`,
    );
    const teacherEmail = `teacher-reject-${testRunId}@${testEmailDomain}`;
    const adminEmail = `admin-reject-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, adminEmail);

    const { userId: teacherUserId } = await createUserSession({
      email: teacherEmail,
    });
    const displayName = `Teacher Reject ${testRunId}`;
    await prisma.teacherProfile.create({
      data: {
        userId: teacherUserId,
        displayName,
        bio: "bio",
        teachingStyle: "style",
        experienceYears: 3,
        specialties: ["Yin Yoga"],
        serviceAreas: ["新北市"],
        teachingFormats: ["線上"],
        status: "submitted",
      },
    });

    const { sessionToken: adminSession } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSession);
    await page.goto("/admin/teachers");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: displayName }),
    });
    await card.locator("summary").click();
    const reasonField = card.getByLabel("退回原因");
    await reasonField.fill("資料尚不完整，請補充教學經歷細節。");
    await card.getByRole("checkbox").check();
    await card.getByRole("button", { name: "確認退回" }).click();
    await expect(page).toHaveURL(/result=/);

    const rejectedNotif = await prisma.notification.findFirst({
      where: { type: "teacher_application_rejected", userId: teacherUserId },
    });
    expect(rejectedNotif?.title).toBe("老師申請審核結果");
    expect(rejectedNotif?.body).toContain("資料尚不完整，請補充教學經歷細節。");
  });

  // D1: demand_request_submitted (self + admin), demand_request_published (self).
  test("demand request submit notifies self + admin, publish notifies self", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-demand-publish-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);

    const { organizerProfileId, organizationId, sessionToken: organizerSession, userId: organizerUserId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: `contact-${testRunId}@example.com`,
        contactPhone: "0900000000",
      });
    const { userId: adminUserId } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });

    const demandTitle = `Demand ${testRunId}`;
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: demandTitle }),
    });

    await addAuthSessionCookie(context, organizerSession);
    await page.goto(`/organizer/demands/${demand.id}/edit`);
    await expect(page.getByLabel("需求標題")).toHaveValue(demandTitle);
    await page.getByRole("button", { name: "送出審核" }).click();
    await expect(page.getByText("確認送出需求")).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).click();
    await expect(
      page.getByText("需求已收到，待平台審核後才會公開給合適的老師。"),
    ).toBeVisible();

    // 見上方 teacher_application_submitted 測試的註解：admin fan-out 是全域的，
    // 平行測試下不斷言總筆數，只斷言各自預期的收件人有一筆正確內容的記錄。
    const orgSelfNotif = await prisma.notification.findFirst({
      where: { type: "demand_request_submitted", userId: organizerUserId },
    });
    expect(orgSelfNotif?.title).toBe("需求已送出");

    const adminNotif = await prisma.notification.findFirst({
      where: {
        type: "demand_request_submitted",
        userId: adminUserId,
        body: { contains: testRunId },
      },
    });
    expect(adminNotif?.title).toBe("有新的需求待審核");

    const { sessionToken: publisherSession } = await createUserSession({
      email: `publisher-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    createdEmails.push(`publisher-${testRunId}@${testEmailDomain}`);
    await context.clearCookies();
    await addAuthSessionCookie(context, publisherSession);
    await page.goto("/admin/demands");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: demandTitle }),
    });
    await card.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("需求已公開。")).toBeVisible();

    const publishedNotif = await prisma.notification.findFirst({
      where: { type: "demand_request_published", userId: organizerUserId },
    });
    expect(publishedNotif?.title).toBe("需求已發布");
  });

  // D1: demand_request_rejected (self, with reason).
  test("demand request reject notifies self with the rejection reason", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-demand-reject-${Date.now()}`,
    );
    const organizerEmail = `organizer-reject-${testRunId}@${testEmailDomain}`;
    const adminEmail = `admin-reject-demand-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);

    const { organizerProfileId, organizationId, userId: organizerUserId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer Reject ${testRunId}`,
        organizationName: `Org Reject ${testRunId}`,
      });

    const demandTitle = `Demand Reject ${testRunId}`;
    await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: demandTitle }),
    });

    const { sessionToken: adminSession } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSession);
    await page.goto("/admin/demands");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: demandTitle }),
    });
    await card.locator("summary").click();
    await card.getByLabel("退回原因").fill("地點資訊需要再確認，請補充細節。");
    await card.getByRole("checkbox").check();
    await card.getByRole("button", { name: "確認退回" }).click();
    await expect(page).toHaveURL(/result=/);

    const rejectedNotif = await prisma.notification.findFirst({
      where: { type: "demand_request_rejected", userId: organizerUserId },
    });
    expect(rejectedNotif?.title).toBe("需求審核結果");
    expect(rejectedNotif?.body).toContain("地點資訊需要再確認，請補充細節。");
  });

  // D1: demand_response_submitted (organizer counterpart + admin), demand_response_selected
  // (organizer self + teacher counterpart), class_session_created (organizer self + teacher
  // counterpart), enrollment_confirmed (member self). These four triggers live in
  // __internal__ cores that don't call requireUser(), so — like the existing enrollment
  // concurrency test — they're called directly from this Node process, no browser needed.
  test("demand-response through class-session through enrollment lifecycle notifies the right people at each step", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-lifecycle-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail, adminEmail, memberEmail);

    const { organizerProfileId, organizationId, userId: organizerUserId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const { userId: adminUserId } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    const { userId: teacherUserId, teacherProfileId } =
      await createTeacherProfileWithSession({
        email: teacherEmail,
        displayName: `Teacher ${testRunId}`,
        status: "approved",
      });

    const demandTitle = `Demand ${testRunId}`;
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: demandTitle }),
    });

    // 1) demand_response_submitted -> organizer (counterpart) + admin.
    const submitResult = await submitDemandResponseForTeacher(
      teacherProfileId,
      demand.id,
      { message: "我很樂意接這堂課。", proposedTimeSlots: ["平日晚上"], proposedPrice: null },
    );
    if (!submitResult.ok) throw new Error(`unexpected submit failure: ${submitResult.code}`);

    // 見上方 teacher_application_submitted 測試的註解：admin fan-out 是全域的，
    // 平行測試下不斷言總筆數，只斷言各自預期的收件人有一筆正確內容的記錄。
    const orgCounterpartNotif = await prisma.notification.findFirst({
      where: { type: "demand_response_submitted", userId: organizerUserId },
    });
    expect(orgCounterpartNotif?.title).toBe("有老師回應了你的需求");

    const adminResponseNotif = await prisma.notification.findFirst({
      where: { type: "demand_response_submitted", userId: adminUserId },
    });
    expect(adminResponseNotif?.title).toBe("有新的需求回應");

    // 2) demand_response_selected -> organizer (self) + teacher (counterpart).
    const selectResult = await selectDemandResponseForOrganizer(
      organizerProfileId,
      submitResult.demandResponse.id,
    );
    if (!selectResult.ok) throw new Error(`unexpected select failure: ${selectResult.code}`);

    const selectedNotifs = await prisma.notification.findMany({
      where: {
        type: "demand_response_selected",
        userId: { in: [organizerUserId, teacherUserId] },
      },
    });
    expect(selectedNotifs).toHaveLength(2);
    expect(selectedNotifs.find((n) => n.userId === organizerUserId)?.title).toBe(
      "已選定老師",
    );
    expect(selectedNotifs.find((n) => n.userId === teacherUserId)?.title).toBe(
      "你被選中了",
    );

    // 3) class_session_created -> organizer (self) + teacher (counterpart).
    const startAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const endAt = new Date(startAt.getTime() + 1000 * 60 * 60);
    const validation = validateClassSessionCreate({
      title: `Class ${testRunId}`,
      description: null,
      serviceType: "Hatha Yoga",
      startAt: toLocalInputValue(startAt),
      endAt: toLocalInputValue(endAt),
      location: "測試教室",
      capacity: 5,
      isPublic: false,
    });
    if (!validation.valid) throw new Error("unexpected invalid class session input");

    const createResult = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
    );
    if (!createResult.ok) throw new Error(`unexpected create failure: ${createResult.code}`);

    const classCreatedNotifs = await prisma.notification.findMany({
      where: {
        type: "class_session_created",
        userId: { in: [organizerUserId, teacherUserId] },
      },
    });
    expect(classCreatedNotifs).toHaveLength(2);

    // Bypass the open-for-enrollment trigger itself (out of scope here, covered by D10).
    await prisma.classSession.update({
      where: { id: createResult.classSessionId },
      data: { status: "open_for_enrollment" },
    });

    const { userId: memberUserId } = await createUserSession({ email: memberEmail });

    // 4) enrollment_confirmed -> member (self).
    const enrollResult = await createEnrollmentForUser(
      memberUserId,
      createResult.classSessionId,
      { notes: null },
    );
    if (!enrollResult.ok) throw new Error(`unexpected enroll failure: ${enrollResult.code}`);

    const enrollConfirmedNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_confirmed", userId: memberUserId },
    });
    expect(enrollConfirmedNotif?.title).toBe("報名成功");
  });

  // D1: enrollment_cancelled (self). cancelOwnEnrollment calls requireUser(), so — unlike the
  // four triggers above — it needs a real browser session, driven through /member/enrollments.
  test("enrollment cancel notifies self", async ({ context, page }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cancel-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail, memberEmail);

    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const { teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId,
      status: "selected",
    });

    const startAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const endAt = new Date(startAt.getTime() + 1000 * 60 * 60);
    const validation = validateClassSessionCreate({
      title: `Class ${testRunId}`,
      description: null,
      serviceType: "Hatha Yoga",
      startAt: toLocalInputValue(startAt),
      endAt: toLocalInputValue(endAt),
      location: "測試教室",
      capacity: 5,
      isPublic: false,
    });
    if (!validation.valid) throw new Error("unexpected invalid class session input");
    const created = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
    );
    if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status: "open_for_enrollment" },
    });

    const { userId: memberUserId, sessionToken: memberSession } =
      await createUserSession({ email: memberEmail });
    const enrolled = await createEnrollmentForUser(memberUserId, created.classSessionId, {
      notes: null,
    });
    if (!enrolled.ok) throw new Error(`unexpected enroll failure: ${enrolled.code}`);

    await addAuthSessionCookie(context, memberSession);
    await page.goto("/member/enrollments");
    await page.getByText("取消報名…").click();
    await page.getByRole("checkbox", { name: "我確認要取消這則報名。" }).check();
    await page.getByRole("button", { name: "確認取消" }).click();
    await expect(page.getByText("報名已取消。")).toBeVisible();

    const cancelledNotif = await prisma.notification.findFirst({
      where: { type: "enrollment_cancelled", userId: memberUserId },
    });
    expect(cancelledNotif?.title).toBe("報名已取消");
  });

  // Own-scoped isolation: user A's notifications must never appear in user B's list.
  test("a user only sees their own notifications on /notifications, not another user's", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-isolation-${Date.now()}`,
    );
    const userAEmail = `user-a-${testRunId}@${testEmailDomain}`;
    const userBEmail = `user-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(userAEmail, userBEmail);

    const { userId: userAId } = await createUserSession({ email: userAEmail });
    const { sessionToken: userBSession } = await createUserSession({
      email: userBEmail,
    });

    await notifyUsers(
      "enrollment_confirmed",
      [{ userId: userAId, role: "self" }],
      { classSessionTitle: `Isolation Test ${testRunId}` },
    );

    await addAuthSessionCookie(context, userBSession);
    await page.goto("/notifications");
    await expect(page.getByText(`Isolation Test ${testRunId}`)).toHaveCount(0);
    await expect(page.getByText("目前沒有任何通知")).toBeVisible();
  });

  // D4: notifyUsers-level failure isolation — one recipient's sender throws, the other
  // still succeeds, and the call itself never throws.
  test("notifyUsers isolates a single recipient's send failure from the others", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-isolation-${Date.now()}`,
    );
    const okEmail = `notify-ok-${testRunId}@${testEmailDomain}`;
    const failEmail = `notify-fail-${testRunId}@${testEmailDomain}`;
    createdEmails.push(okEmail, failEmail);

    const { userId: okUserId } = await createUserSession({ email: okEmail });
    const { userId: failUserId } = await createUserSession({ email: failEmail });

    const flakySender = async (notification: { userId: string }) => {
      if (notification.userId === failUserId) {
        throw new Error("simulated send failure");
      }
    };

    await expect(
      notifyUsers(
        "enrollment_confirmed",
        [
          { userId: okUserId, role: "self" },
          { userId: failUserId, role: "self" },
        ],
        { classSessionTitle: `Notify Isolation ${testRunId}` },
        flakySender,
      ),
    ).resolves.toBeUndefined();

    const okNotif = await prisma.notification.findFirst({
      where: { userId: okUserId, type: "enrollment_confirmed" },
    });
    const failNotif = await prisma.notification.findFirst({
      where: { userId: failUserId, type: "enrollment_confirmed" },
    });
    expect(okNotif?.status).toBe("sent");
    expect(failNotif?.status).toBe("failed");
  });

  // D4: trigger-level failure isolation — the entire resolver+notify step throws (a failure
  // that never even reaches notifyUsers's own internal try/catch), and the primary
  // enrollment mutation must still succeed. This is a genuinely different protection layer
  // from the notifyUsers-level test above: it proves the *trigger's own* outer try/catch,
  // not notifyUsers's per-recipient one.
  test("createEnrollmentForUser succeeds even when the entire notify step throws", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-trigger-isolation-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail, memberEmail);

    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const { teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId,
      status: "selected",
    });

    const startAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const endAt = new Date(startAt.getTime() + 1000 * 60 * 60);
    const validation = validateClassSessionCreate({
      title: `Class ${testRunId}`,
      description: null,
      serviceType: "Hatha Yoga",
      startAt: toLocalInputValue(startAt),
      endAt: toLocalInputValue(endAt),
      location: "測試教室",
      capacity: 5,
      isPublic: false,
    });
    if (!validation.valid) throw new Error("unexpected invalid class session input");
    const created = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
    );
    if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status: "open_for_enrollment" },
    });

    const { userId: memberUserId } = await createUserSession({ email: memberEmail });

    const throwingNotifyOverride = async () => {
      throw new Error("simulated total notify-step failure");
    };

    const enrollResult = await createEnrollmentForUser(
      memberUserId,
      created.classSessionId,
      { notes: null },
      undefined,
      throwingNotifyOverride,
    );

    expect(enrollResult.ok).toBe(true);
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { userId: memberUserId, classSessionId: created.classSessionId },
      select: { status: true },
    });
    expect(enrollment.status).toBe("confirmed");

    // notifyOverride was swapped out entirely, so no Notification row is expected —
    // this is the documented, intended behavior, not a gap.
    const notif = await prisma.notification.findFirst({
      where: { userId: memberUserId, type: "enrollment_confirmed" },
    });
    expect(notif).toBeNull();
  });

  // D5: recipient dedup — a duplicate userId across roles collapses to one row, keeping the
  // first occurrence's role (and therefore its copy), not the last.
  test("notifyUsers dedupes a recipient appearing under multiple roles, keeping the first role's copy", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-dedup-${Date.now()}`,
    );
    const email = `dedup-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { userId } = await createUserSession({ email, isAdmin: true });

    await notifyUsers(
      "teacher_application_submitted",
      [
        { userId, role: "self" },
        { userId, role: "admin" },
      ],
      { actorLabel: `Dedup Actor ${testRunId}` },
    );

    const rows = await prisma.notification.findMany({
      where: { userId, type: "teacher_application_submitted" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("老師申請已送出");
  });

  // D2/D3: listOwnNotifications only surfaces status="sent" rows — a failed row must never
  // appear to the user as if it had been delivered.
  test("listOwnNotifications (and the /notifications page) hide failed rows but show sent ones", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-filter-${Date.now()}`,
    );
    const email = `filter-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { userId, sessionToken } = await createUserSession({ email });

    const flakySender = async (notification: { title: string }) => {
      if (notification.title === "報名成功") {
        throw new Error("simulated failure");
      }
    };

    await notifyUsers(
      "enrollment_confirmed",
      [{ userId, role: "self" }],
      { classSessionTitle: `Filter Failed ${testRunId}` },
      flakySender,
    );
    await notifyUsers(
      "enrollment_cancelled",
      [{ userId, role: "self" }],
      { classSessionTitle: `Filter Sent ${testRunId}` },
    );

    const failedRow = await prisma.notification.findFirstOrThrow({
      where: { userId, type: "enrollment_confirmed" },
    });
    expect(failedRow.status).toBe("failed");

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/notifications");
    await expect(page.getByText(`Filter Sent ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Filter Failed ${testRunId}`)).toHaveCount(0);
  });
});

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
