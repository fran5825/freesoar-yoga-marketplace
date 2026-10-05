import { expect, test } from "@playwright/test";

import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import {
  confirmProposalCore,
  declineProposalCore,
} from "../../src/domain/organizer-class-proposal/__internal__/respond-core";
import { createDemandResponse, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 06：受邀老師確認／婉拒，以及確認後的共用排課保護。
const testEmailDomain = "proposal-respond-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.organizerClassProposal.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.demandResponse.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

// 每個測試用不同的日期，避免同一位老師的時段互相干擾。
function slot(daysFromNow: number, startHourOffset = 0, hours = 1) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR + startHourOffset * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + hours * HOUR) };
}

async function setup(id: string) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  const teacherEmail = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail, teacherEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Respond Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Respond Teacher ${id}`,
    status: "approved",
  });
  const teacherUser = await prisma.teacherProfile.findUniqueOrThrow({
    where: { id: teacher.teacherProfileId },
    select: { userId: true },
  });
  return { organizer, teacher: { ...teacher, userId: teacherUser.userId } };
}

async function createPendingProposal(
  organizer: { organizerProfileId: string; organizationId: string },
  teacherProfileId: string,
  title: string,
  times: { startAt: Date; endAt: Date },
) {
  return prisma.organizerClassProposal.create({
    data: {
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      teacherProfileId,
      title,
      serviceTypes: ["伸展與身體保養"],
      ...times,
      location: "台北市信義區",
      capacity: 15,
      status: "pending_confirmation",
      submittedAt: new Date(),
      transitionSeq: 2,
    },
  });
}

// N 天後的台灣日期（YYYY-MM-DD），與該日台灣時間 hh:mm 的 Date。
function taipeiDate(daysFromNow: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + daysFromNow * DAY));
}

function taipeiAt(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
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

test.describe("organizer class proposal respond smoke", () => {
  test("the invited teacher confirms on the page; confirmation metadata is stored and both sides see it", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "confirm-ui");
    const { organizer, teacher } = await setup(id);
    const proposal = await createPendingProposal(organizer, teacher.teacherProfileId, `確認課程 ${id}`, slot(30));

    const teacherContext = await browser.newContext();
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const page = await teacherContext.newPage();
    await page.goto(`/teacher/class-proposals/${proposal.id}`);
    await page.getByRole("button", { name: "確認授課" }).click();
    await expect(page.getByText("確認由你授課？")).toBeVisible();
    await page.getByRole("button", { name: "確認授課" }).click();
    await expect(page.getByText(/你已確認授課/)).toBeVisible();
    await teacherContext.close();

    const confirmed = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, confirmedVersion: true, confirmedAt: true, confirmedByUserId: true, transitionSeq: true },
    });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedVersion).toBe(1);
    expect(confirmed.confirmedAt).not.toBeNull();
    expect(confirmed.confirmedByUserId).toBe(teacher.userId);
    expect(confirmed.transitionSeq).toBe(3);

    const organizerContext = await browser.newContext();
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const organizerPage = await organizerContext.newPage();
    await organizerPage.goto(`/organizer/class-proposals/${proposal.id}`);
    await expect(organizerPage.getByText(/已確認授課，這個時段已保留給這堂課/)).toBeVisible();
    await organizerContext.close();
  });

  test("declining requires a reason, and the organizer sees it", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "decline-ui");
    const { organizer, teacher } = await setup(id);
    const proposal = await createPendingProposal(organizer, teacher.teacherProfileId, `婉拒課程 ${id}`, slot(31));

    const teacherContext = await browser.newContext();
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const page = await teacherContext.newPage();
    await page.goto(`/teacher/class-proposals/${proposal.id}`);
    await page.getByRole("button", { name: "婉拒並說明原因" }).click();
    await expect(page.getByRole("button", { name: "送出婉拒" })).toBeDisabled();
    await page.getByLabel("婉拒原因").fill("那天已經有其他安排，下週同時段可以。");
    await page.getByRole("button", { name: "送出婉拒" }).click();
    await expect(page.getByText(/你已婉拒這份邀請/)).toBeVisible();
    await teacherContext.close();

    // 伺服器端也要求原因（繞過按鈕的空白原因被擋下）。
    const blank = await createPendingProposal(organizer, teacher.teacherProfileId, `空白原因 ${id}`, slot(31, 3));
    expect(await declineProposalCore(teacher.teacherProfileId, blank.id, 1, "   ")).toEqual({
      ok: false,
      code: "decline_reason_invalid",
    });

    const organizerContext = await browser.newContext();
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const organizerPage = await organizerContext.newPage();
    await organizerPage.goto(`/organizer/class-proposals/${proposal.id}`);
    await expect(organizerPage.getByText(/那天已經有其他安排/)).toBeVisible();
    await organizerContext.close();

    const declined = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, declineReason: true },
    });
    expect(declined).toEqual({ status: "declined", declineReason: "那天已經有其他安排，下週同時段可以。" });
  });

  test("rejects a stale version shown on the page, a suspended teacher, a past start, another teacher, and a non-pending proposal", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "guards");
    const { organizer, teacher } = await setup(id);

    // 舊頁面：老師開著頁面時團主修改了內容（version 變了），確認被拒、狀態不變。
    const stale = await createPendingProposal(organizer, teacher.teacherProfileId, `舊版本 ${id}`, slot(32));
    const context = await browser.newContext();
    await addAuthSessionCookie(context, teacher.sessionToken);
    const page = await context.newPage();
    await page.goto(`/teacher/class-proposals/${stale.id}`);
    await prisma.organizerClassProposal.update({ where: { id: stale.id }, data: { version: 2 } });
    await page.getByRole("button", { name: "確認授課" }).click();
    await page.getByRole("button", { name: "確認授課" }).click();
    await expect(page.getByText("團主剛剛修改了這份邀請，請重新整理後確認最新內容。")).toBeVisible();
    await context.close();
    expect((await prisma.organizerClassProposal.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(
      "pending_confirmation",
    );

    // 過去的開始時間。
    const past = await createPendingProposal(organizer, teacher.teacherProfileId, `過去 ${id}`, {
      startAt: new Date(Date.now() - 2 * DAY),
      endAt: new Date(Date.now() - 2 * DAY + HOUR),
    });
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, past.id, 1)).toEqual({
      ok: false,
      code: "proposal_starts_in_past",
    });

    // 其他老師：找不到。
    const otherEmail = `other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createTeacherProfileWithSession({ email: otherEmail, displayName: `Other ${id}`, status: "approved" });
    const forOther = await createPendingProposal(organizer, teacher.teacherProfileId, `不是你的 ${id}`, slot(32, 3));
    expect(await confirmProposalCore(other.teacherProfileId, teacher.userId, forOther.id, 1)).toEqual({
      ok: false,
      code: "proposal_not_found",
    });

    // 老師被暫停：不能確認。
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, forOther.id, 1)).toEqual({
      ok: false,
      code: "teacher_not_approved",
    });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "approved" } });

    // 已確認的邀請不能再婉拒或再確認。
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, forOther.id, 1)).toMatchObject({ ok: true });
    expect(await declineProposalCore(teacher.teacherProfileId, forOther.id, 1, "改變主意")).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, forOther.id, 1)).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });
  });

  test("only confirmed proposals occupy the teacher's time: pending and declined do not, existing classes and confirmed proposals block", async ({}, testInfo) => {
    const id = runId(testInfo, "occupy");
    const { organizer, teacher } = await setup(id);
    const times = slot(33);

    // 同一時段有另一筆 pending 與一筆 declined：都不擋確認。
    await createPendingProposal(organizer, teacher.teacherProfileId, `另一筆待確認 ${id}`, times);
    const declined = await createPendingProposal(organizer, teacher.teacherProfileId, `已婉拒 ${id}`, times);
    await prisma.organizerClassProposal.update({
      where: { id: declined.id },
      data: { status: "declined", declineReason: "不行" },
    });
    const target = await createPendingProposal(organizer, teacher.teacherProfileId, `要確認的 ${id}`, times);
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, target.id, 1)).toMatchObject({ ok: true });

    // 已確認的邀請擋下同時段的團主媒合建課（共用排課檢查）。
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "matched",
    });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId, status: "selected" });
    const blocked = await createClassSessionForOrganizer(organizer.organizerProfileId, demand.id, {
      title: "同時段的媒合課",
      description: null,
      serviceType: "伸展與身體保養",
      startAt: times.startAt,
      endAt: times.endAt,
      location: "台北",
      capacity: 10,
      isPublic: false,
    });
    expect(blocked).toEqual({ ok: false, code: "teacher_schedule_conflict" });

    // 既有課程（含 draft）擋下同時段的確認。
    const laterTimes = slot(33, 4);
    await prisma.classSession.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        origin: "teacher_initiated",
        title: `老師自己的草稿課 ${id}`,
        serviceType: "伸展與身體保養",
        serviceTypes: ["伸展與身體保養"],
        ...laterTimes,
        location: "台北",
        capacity: 10,
      },
    });
    const clashing = await createPendingProposal(organizer, teacher.teacherProfileId, `撞到既有課 ${id}`, laterTimes);
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, clashing.id, 1)).toEqual({
      ok: false,
      code: "schedule_conflict",
    });
  });

  test("two overlapping proposals confirmed at the same time: the teacher lock serialises them and only one succeeds", async ({}, testInfo) => {
    const id = runId(testInfo, "race-proposals");
    const { organizer, teacher } = await setup(id);
    const times = slot(34);
    const first = await createPendingProposal(organizer, teacher.teacherProfileId, `同時確認 A ${id}`, times);
    const second = await createPendingProposal(organizer, teacher.teacherProfileId, `同時確認 B ${id}`, times);

    const releaseFirst = createDeferred();
    let firstAcquired = false;
    let secondReachedLock = false;
    let secondAcquired = false;

    const firstCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, first.id, 1, {
      onLockAcquired: async () => {
        firstAcquired = true;
        await releaseFirst.promise;
      },
    });
    await waitUntil(() => firstAcquired);

    const secondCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, second.id, 1, {
      onBeforeLock: () => {
        secondReachedLock = true;
      },
      onLockAcquired: () => {
        secondAcquired = true;
      },
    });
    await waitUntil(() => secondReachedLock);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(secondAcquired).toBe(false);

    releaseFirst.resolve();
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(firstResult).toMatchObject({ ok: true });
    expect(secondResult).toEqual({ ok: false, code: "schedule_conflict" });
    expect(
      await prisma.organizerClassProposal.count({
        where: { teacherProfileId: teacher.teacherProfileId, status: "confirmed" },
      }),
    ).toBe(1);
  });

  test("confirming and creating a matched class at the same time never double-books the teacher", async ({}, testInfo) => {
    const id = runId(testInfo, "race-create");
    const { organizer, teacher } = await setup(id);
    const times = slot(35);
    const proposal = await createPendingProposal(organizer, teacher.teacherProfileId, `確認與建課 ${id}`, times);
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "matched",
    });
    await createDemandResponse({ demandRequestId: demand.id, teacherProfileId: teacher.teacherProfileId, status: "selected" });

    const releaseConfirm = createDeferred();
    let confirmAcquired = false;
    let createReachedLock = false;
    let createAcquired = false;

    const confirmCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1, {
      onLockAcquired: async () => {
        confirmAcquired = true;
        await releaseConfirm.promise;
      },
    });
    await waitUntil(() => confirmAcquired);

    const createCall = createClassSessionForOrganizer(
      organizer.organizerProfileId,
      demand.id,
      {
        title: "同時建立的媒合課",
        description: null,
        serviceType: "伸展與身體保養",
        startAt: times.startAt,
        endAt: times.endAt,
        location: "台北",
        capacity: 10,
        isPublic: false,
      },
      {
        onBeforeLock: () => {
          createReachedLock = true;
        },
        onLockAcquired: () => {
          createAcquired = true;
        },
      },
    );
    await waitUntil(() => createReachedLock);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(createAcquired).toBe(false);

    releaseConfirm.resolve();
    const [confirmResult, createResult] = await Promise.all([confirmCall, createCall]);
    expect(confirmResult).toMatchObject({ ok: true });
    expect(createResult).toEqual({ ok: false, code: "teacher_schedule_conflict" });
    expect(await prisma.classSession.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(0);
  });
  test("if the proposal's time changes while confirm waits for the teacher lock, the new time is the one checked", async ({}, testInfo) => {
    const id = runId(testInfo, "snapshot");
    const { organizer, teacher } = await setup(id);
    const original = slot(36);
    const moved = slot(36, 5);
    // 新時段已經有老師自己的課。
    await prisma.classSession.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        origin: "teacher_initiated",
        title: `新時段已有的課 ${id}`,
        serviceType: "伸展與身體保養",
        serviceTypes: ["伸展與身體保養"],
        ...moved,
        location: "台北",
        capacity: 10,
      },
    });
    const proposal = await createPendingProposal(organizer, teacher.teacherProfileId, `快照 ${id}`, original);

    // 確認先讀到原時段、拿到老師鎖後暫停；這時邀請被改到新時段（version 2，模擬團主修改）。
    const release = createDeferred();
    let acquired = false;
    const confirmCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 2, {
      onLockAcquired: async () => {
        acquired = true;
        await release.promise;
      },
    });
    await waitUntil(() => acquired);
    await prisma.organizerClassProposal.update({
      where: { id: proposal.id },
      data: { ...moved, version: 2 },
    });
    release.resolve();

    expect(await confirmCall).toEqual({ ok: false, code: "schedule_conflict" });
    expect((await prisma.organizerClassProposal.findUniqueOrThrow({ where: { id: proposal.id } })).status).toBe(
      "pending_confirmation",
    );
  });

  test("a confirmed proposal blocks the teacher's own single class and recurring occurrences, and a recurring occurrence blocks a confirmation", async ({}, testInfo) => {
    const id = runId(testInfo, "teacher-paths");
    const { organizer, teacher } = await setup(id);
    const busyDate = taipeiDate(37);
    const freeDate = taipeiDate(44);
    const busy = { startAt: taipeiAt(busyDate, "19:00"), endAt: taipeiAt(busyDate, "20:00") };

    const confirmed = await createPendingProposal(organizer, teacher.teacherProfileId, `已確認 ${id}`, busy);
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, confirmed.id, 1)).toMatchObject({ ok: true });

    // 老師自己開單堂：撞到已確認的邀請被拒；不重疊的時段正常建立。
    const single = {
      title: `老師單堂 ${id}`,
      description: null,
      serviceType: "伸展與身體保養",
      location: "台北",
      capacity: 10,
      isPublic: false,
    };
    expect(await createClassSessionForTeacher(teacher.teacherProfileId, { ...single, ...busy })).toEqual({
      ok: false,
      code: "teacher_schedule_conflict",
    });
    const freeSingle = await createClassSessionForTeacher(teacher.teacherProfileId, {
      ...single,
      startAt: taipeiAt(busyDate, "21:00"),
      endAt: taipeiAt(busyDate, "22:00"),
    });
    expect(freeSingle.ok).toBe(true);

    // 系列生成：撞到已確認邀請的那一天被跳過，另一天正常建立。
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: `老師系列 ${id}`,
        serviceType: "伸展與身體保養",
        startTime: "19:00",
        endTime: "20:00",
        location: "台北",
        capacity: 10,
      },
    });
    const generated = await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, [busyDate, freeDate]);
    expect(generated.ok).toBe(true);
    if (!generated.ok) throw new Error("unexpected");
    expect(generated.createdClassSessionIds).toHaveLength(1);
    expect(generated.skipped).toEqual([{ date: busyDate, reason: "teacher_schedule_conflict" }]);

    // 反過來：系列已生成的那一場擋下同時段的邀請確認。
    const clashing = await createPendingProposal(organizer, teacher.teacherProfileId, `撞到系列 ${id}`, {
      startAt: taipeiAt(freeDate, "19:00"),
      endAt: taipeiAt(freeDate, "20:00"),
    });
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, clashing.id, 1)).toEqual({
      ok: false,
      code: "schedule_conflict",
    });
  });
});
