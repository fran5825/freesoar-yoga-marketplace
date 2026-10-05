import { expect, test } from "@playwright/test";

import {
  cancelClassSessionForAdmin,
  cancelClassSessionForOrganizer,
} from "../../src/domain/class-session/__internal__/cancel-class-session-core";
import { completeClassSessionForTeacher } from "../../src/domain/class-session/__internal__/complete-class-session-core-for-teacher";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { openDirectClassFromProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/open-direct-class-core";
import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  createDemandRequest,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 09：老師確認後，團主一次完成直接開團與開放報名（organizer_direct）。
const testEmailDomain = "organizer-direct-class-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  // 邀請指向課程（Restrict），先刪邀請，再刪課程與通知。
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: emails } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

function slot(daysFromNow: number, startHourOffset = 0) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR + startHourOffset * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + HOUR) };
}

async function setup(id: string) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  const teacherEmail = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Direct Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Direct Teacher ${id}`,
    status: "approved",
  });
  const teacherUser = await prisma.teacherProfile.findUniqueOrThrow({
    where: { id: teacher.teacherProfileId },
    select: { userId: true },
  });
  return { organizer, teacher: { ...teacher, userId: teacherUser.userId } };
}

// 已確認的邀請（直接寫入，模擬票 05／06 的流程已完成）。
async function createConfirmedProposal(
  organizer: { organizerProfileId: string; organizationId: string },
  teacher: { teacherProfileId: string; userId: string },
  title: string,
  times: { startAt: Date; endAt: Date },
  extra: { isPublic?: boolean } = {},
) {
  return prisma.organizerClassProposal.create({
    data: {
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      teacherProfileId: teacher.teacherProfileId,
      title,
      description: "直接開團的課程說明。",
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      ...times,
      location: "台北市信義區松仁路 100 號",
      capacity: 18,
      isPublic: extra.isPublic ?? false,
      status: "confirmed",
      submittedAt: new Date(),
      confirmedVersion: 1,
      confirmedAt: new Date(),
      confirmedByUserId: teacher.userId,
      transitionSeq: 3,
    },
  });
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitUntil timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test.describe("organizer direct class smoke", () => {
  test("opening enrollment from a confirmed proposal creates one open organizer_direct class and lands on it", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "open-ui");
    const { organizer, teacher } = await setup(id);
    const proposal = await createConfirmedProposal(organizer, teacher, `直接開團 ${id}`, slot(50));
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/class-proposals/${proposal.id}`);
    await page.getByRole("button", { name: "開放報名" }).click();
    await expect(page.getByText("確認開放報名？")).toBeVisible();
    await page.getByRole("button", { name: "確認開放報名" }).click();

    await expect(page).toHaveURL(/\/organizer\/classes\/[^/?]+\?flash=opened$/);
    await expect(page.getByText("已開放報名，現在可以把課程連結分享給團員。")).toBeVisible();

    const converted = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, classSessionId: true, transitionSeq: true },
    });
    expect(converted.status).toBe("converted");
    expect(converted.transitionSeq).toBe(4);
    const classSession = await prisma.classSession.findUniqueOrThrow({
      where: { id: converted.classSessionId as string },
    });
    expect(classSession).toMatchObject({
      origin: "organizer_direct",
      status: "open_for_enrollment",
      requiresApproval: false,
      isPublic: false,
      demandRequestId: null,
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      teacherProfileId: teacher.teacherProfileId,
      title: `直接開團 ${id}`,
      capacity: 18,
    });
    // 老師收到「課程已成立」。
    expect(
      await prisma.notification.count({ where: { userId: teacher.userId, type: "class_session_created" } }),
    ).toBe(1);
  });

  test("retries and concurrent opens converge on the same single class", async ({}, testInfo) => {
    const id = runId(testInfo, "idempotent");
    const { organizer, teacher } = await setup(id);
    const proposal = await createConfirmedProposal(organizer, teacher, `重試 ${id}`, slot(51));

    const release = createDeferred();
    let firstAcquired = false;
    let secondReachedLock = false;
    const first = openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1, {
      onLockAcquired: async () => {
        firstAcquired = true;
        await release.promise;
      },
    });
    await waitUntil(() => firstAcquired);
    const second = openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1, {
      onBeforeLock: () => {
        secondReachedLock = true;
      },
    });
    await waitUntil(() => secondReachedLock);
    release.resolve();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult).toEqual(firstResult);

    // 之後再按一次也是同一堂。
    expect(await openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1)).toEqual(firstResult);
    expect(await prisma.classSession.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(1);
  });

  test("a failure after creating the class rolls everything back and keeps the confirmed reservation", async ({}, testInfo) => {
    const id = runId(testInfo, "rollback");
    const { organizer, teacher } = await setup(id);
    const proposal = await createConfirmedProposal(organizer, teacher, `回滾 ${id}`, slot(52));

    const failed = await openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1, {
      onClassSessionCreated: () => {
        throw new Error("simulated failure after class insert");
      },
    });
    expect(failed).toEqual({ ok: false, code: "open_failed" });
    expect(await prisma.classSession.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(0);
    const still = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, classSessionId: true },
    });
    expect(still).toEqual({ status: "confirmed", classSessionId: null });

    // 之後重新開放成功。
    const retried = await openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1);
    expect(retried.ok).toBe(true);
  });

  test("guards: not confirmed, stale confirmation, suspended teacher, conflicting class, other organizer", async ({}, testInfo) => {
    const id = runId(testInfo, "guards");
    const { organizer, teacher } = await setup(id);

    const pending = await createConfirmedProposal(organizer, teacher, `待確認 ${id}`, slot(53));
    await prisma.organizerClassProposal.update({ where: { id: pending.id }, data: { status: "pending_confirmation" } });
    expect(await openDirectClassFromProposalCore(organizer.organizerProfileId, pending.id, 1)).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });

    // 老師確認的版本與目前版本不同：不能開放。
    const stale = await createConfirmedProposal(organizer, teacher, `版本不同 ${id}`, slot(53, 3));
    await prisma.organizerClassProposal.update({ where: { id: stale.id }, data: { version: 2 } });
    expect(await openDirectClassFromProposalCore(organizer.organizerProfileId, stale.id, 2)).toEqual({
      ok: false,
      code: "proposal_version_stale",
    });

    // 其他團主：找不到。
    const otherEmail = `other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createOrganizerProfileWithOrganization({
      email: otherEmail,
      displayName: `Other ${id}`,
      organizationName: `Other Org ${id}`,
    });
    const target = await createConfirmedProposal(organizer, teacher, `目標 ${id}`, slot(53, 6));
    expect(await openDirectClassFromProposalCore(other.organizerProfileId, target.id, 1)).toEqual({
      ok: false,
      code: "proposal_not_found",
    });

    // 確認之後才出現（繞過檢查寫入）的同時段課程：開放時撞課被擋，不留下課程。
    const clashTimes = slot(53, 9);
    const clashing = await createConfirmedProposal(organizer, teacher, `撞課 ${id}`, clashTimes);
    await prisma.classSession.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        origin: "teacher_initiated",
        title: `後來的課 ${id}`,
        serviceType: "伸展與身體保養",
        serviceTypes: ["伸展與身體保養"],
        ...clashTimes,
        location: "台北",
        capacity: 10,
      },
    });
    expect(await openDirectClassFromProposalCore(organizer.organizerProfileId, clashing.id, 1)).toEqual({
      ok: false,
      code: "schedule_conflict",
    });

    // 老師被暫停：不能開放新報名。
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    expect(await openDirectClassFromProposalCore(organizer.organizerProfileId, target.id, 1)).toEqual({
      ok: false,
      code: "teacher_not_approved",
    });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "approved" } });
    expect(
      await prisma.classSession.count({
        where: { teacherProfileId: teacher.teacherProfileId, origin: "organizer_direct" },
      }),
    ).toBe(0);
  });

  test("the public setting carries over: a public direct class appears in the public list, an unlisted one does not", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "public");
    const { organizer, teacher } = await setup(id);
    const publicProposal = await createConfirmedProposal(organizer, teacher, `公開直接開團 ${id}`, slot(54), {
      isPublic: true,
    });
    const unlistedProposal = await createConfirmedProposal(organizer, teacher, `僅連結直接開團 ${id}`, slot(54, 3));
    const publicResult = await openDirectClassFromProposalCore(organizer.organizerProfileId, publicProposal.id, 1);
    const unlistedResult = await openDirectClassFromProposalCore(organizer.organizerProfileId, unlistedProposal.id, 1);
    expect(publicResult.ok && unlistedResult.ok).toBe(true);

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await page.goto("/classes");
    await expect(page.getByText(`公開直接開團 ${id}`)).toBeVisible();
    await expect(page.getByText(`僅連結直接開團 ${id}`)).toHaveCount(0);
    await visitor.close();
  });

  test("the database enforces origin invariants and teacher-side completion only applies to teacher-initiated classes", async ({}, testInfo) => {
    const id = runId(testInfo, "invariants");
    const { organizer, teacher } = await setup(id);

    // organizer_direct 不能帶需求、teacher_initiated 不能帶團主：資料庫直接拒絕。
    await expect(
      prisma.classSession.create({
        data: {
          teacherProfileId: teacher.teacherProfileId,
          origin: "teacher_initiated",
          organizerProfileId: organizer.organizerProfileId,
          organizationId: organizer.organizationId,
          title: `不合法 ${id}`,
          ...slot(55),
          location: "台北",
          capacity: 10,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.classSession.create({
        data: {
          teacherProfileId: teacher.teacherProfileId,
          origin: "organizer_direct",
          title: `不合法 2 ${id}`,
          ...slot(55, 3),
          location: "台北",
          capacity: 10,
        },
      }),
    ).rejects.toThrow();

    // 已結束、開放中的團主直接開團課程：授課老師不能用老師端完成它（由團主管理）。
    const ended = await prisma.classSession.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        origin: "organizer_direct",
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        status: "open_for_enrollment",
        title: `已結束的直接開團 ${id}`,
        startAt: new Date(Date.now() - 3 * HOUR),
        endAt: new Date(Date.now() - 2 * HOUR),
        location: "台北",
        capacity: 10,
      },
    });
    expect(await completeClassSessionForTeacher(teacher.teacherProfileId, ended.id)).toEqual({
      ok: false,
      code: "class_session_not_found",
    });
    // 團主媒合的課也一樣（spec 13.6：老師端只管理自己開的課）。
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "converted_to_class",
    });
    const endedMatched = await prisma.classSession.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        origin: "organizer_matched",
        demandRequestId: demand.id,
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        status: "open_for_enrollment",
        title: `已結束的媒合課 ${id}`,
        startAt: new Date(Date.now() - 3 * HOUR),
        endAt: new Date(Date.now() - 2 * HOUR),
        location: "台北",
        capacity: 10,
      },
    });
    expect(await completeClassSessionForTeacher(teacher.teacherProfileId, endedMatched.id)).toEqual({
      ok: false,
      code: "class_session_not_found",
    });
    // 自己開的課仍可完成。
    const endedOwn = await prisma.classSession.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        origin: "teacher_initiated",
        status: "open_for_enrollment",
        title: `已結束的自己的課 ${id}`,
        startAt: new Date(Date.now() - 5 * HOUR),
        endAt: new Date(Date.now() - 4 * HOUR),
        location: "台北",
        capacity: 10,
      },
    });
    expect(await completeClassSessionForTeacher(teacher.teacherProfileId, endedOwn.id)).toEqual({ ok: true });
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: ended.id } })).status).toBe(
      "open_for_enrollment",
    );
  });
  test("opening excludes only this proposal's own reservation: another confirmed proposal at the same time still blocks it", async ({}, testInfo) => {
    const id = runId(testInfo, "own-exclusion");
    const { organizer, teacher } = await setup(id);
    const times = slot(56);
    // 兩份同時段的已確認邀請（繞過確認檢查寫入，模擬資料異常）。
    const first = await createConfirmedProposal(organizer, teacher, `第一份 ${id}`, times);
    const second = await createConfirmedProposal(organizer, teacher, `第二份 ${id}`, times);
    expect(await openDirectClassFromProposalCore(organizer.organizerProfileId, first.id, 1)).toEqual({
      ok: false,
      code: "schedule_conflict",
    });
    expect(await prisma.classSession.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(0);

    // 撤掉另一份之後，只剩自己的預留：可以開放。
    await prisma.organizerClassProposal.update({ where: { id: second.id }, data: { status: "withdrawn" } });
    const opened = await openDirectClassFromProposalCore(organizer.organizerProfileId, first.id, 1);
    expect(opened.ok).toBe(true);
  });

  test("members can enrol in a direct class, and organizer or admin cancellation cascades to enrolments", async ({}, testInfo) => {
    const id = runId(testInfo, "enrol-cancel");
    const { organizer, teacher } = await setup(id);
    const memberEmail = `member-${id}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const member = await createUserSession({ email: memberEmail });

    const byOrganizer = await createConfirmedProposal(organizer, teacher, `團主取消 ${id}`, slot(57));
    const openedA = await openDirectClassFromProposalCore(organizer.organizerProfileId, byOrganizer.id, 1);
    if (!openedA.ok) throw new Error("open failed");
    const enrolA = await createEnrollmentForUser(member.userId, openedA.classSessionId, { notes: null });
    expect(enrolA).toMatchObject({ ok: true });
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: member.userId, classSessionId: openedA.classSessionId } }))
        .status,
    ).toBe("confirmed");
    expect(await cancelClassSessionForOrganizer(organizer.organizerProfileId, openedA.classSessionId)).toMatchObject({ ok: true });
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: member.userId, classSessionId: openedA.classSessionId } }))
        .status,
    ).toBe("cancelled");

    const byAdmin = await createConfirmedProposal(organizer, teacher, `管理員取消 ${id}`, slot(57, 3));
    const openedB = await openDirectClassFromProposalCore(organizer.organizerProfileId, byAdmin.id, 1);
    if (!openedB.ok) throw new Error("open failed");
    expect(await createEnrollmentForUser(member.userId, openedB.classSessionId, { notes: null })).toMatchObject({ ok: true });
    expect(await cancelClassSessionForAdmin(openedB.classSessionId)).toMatchObject({ ok: true });
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { userId: member.userId, classSessionId: openedB.classSessionId } }))
        .status,
    ).toBe("cancelled");
  });

  test("organizer and admin class pages label the direct origin", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "labels");
    const { organizer, teacher } = await setup(id);
    const proposal = await createConfirmedProposal(organizer, teacher, `來源標籤 ${id}`, slot(58));
    const opened = await openDirectClassFromProposalCore(organizer.organizerProfileId, proposal.id, 1);
    if (!opened.ok) throw new Error("open failed");

    const organizerContext = await browser.newContext();
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const organizerPage = await organizerContext.newPage();
    await organizerPage.goto("/organizer/classes");
    const card = organizerPage.locator("article").filter({ hasText: `來源標籤 ${id}` });
    await expect(card).toContainText("直接邀請合作老師");
    await organizerPage.goto(`/organizer/classes/${opened.classSessionId}`);
    await expect(organizerPage.getByText("直接邀請合作老師").first()).toBeVisible();
    await organizerContext.close();

    const adminEmail = `admin-${id}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const admin = await createUserSession({ email: adminEmail, isAdmin: true });
    const adminContext = await browser.newContext();
    await addAuthSessionCookie(adminContext, admin.sessionToken);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`/admin/classes/${opened.classSessionId}`);
    await expect(adminPage.getByText("團主直接開團").first()).toBeVisible();
    await adminContext.close();
  });
});
