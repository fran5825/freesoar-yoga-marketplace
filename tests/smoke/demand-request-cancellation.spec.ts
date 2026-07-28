import { expect, test } from "@playwright/test";

import { cancelDemandRequestForOrganizer } from "../../src/domain/demand-request/__internal__/cancel-demand-request-core";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  selectDemandResponseForOrganizer,
  submitDemandResponseForTeacher,
} from "../../src/domain/demand-response/__internal__/select-and-submit-core";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "demand-request-cancellation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

const validClassSessionInput = {
  title: "測試課程",
  description: null,
  serviceType: "Hatha Yoga",
  startAt: "2026-09-01T14:00",
  endAt: "2026-09-01T15:00",
  location: "台北市信義區測試教室",
  capacity: 20,
  isPublic: false,
};

async function seedOrganizer(testRunId: string, suffix = "org") {
  const email = `organizer-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createOrganizerProfileWithOrganization({
    email,
    displayName: `Organizer ${suffix} ${testRunId}`,
    organizationName: `Org ${suffix} ${testRunId}`,
  });
}

async function seedTeacher(testRunId: string, suffix: string) {
  const email = `teacher-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({
    email,
    displayName: `Teacher ${suffix} ${testRunId}`,
    status: "approved",
  });
}

test.describe("demand request cancellation smoke", () => {
  // D11 #1: cancel vs submit race — submit wins the lock and its brand-new response
  // is still correctly cascaded to declined once cancel proceeds afterward.
  test("cancel-vs-submit: FOR UPDATE deterministically serializes them, and the response submitted during the race is still cascaded to declined", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-submit-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    const releaseSubmit = createDeferred<void>();
    let submitAcquired = false;
    let cancelReachedLockStatement = false;
    let cancelAcquired = false;

    const submitCall = submitDemandResponseForTeacher(
      teacher.teacherProfileId,
      demand.id,
      {
        message: `${testRunId} 提交的回應內容。`,
        proposedTimeSlots: ["平日晚上"],
        proposedPrice: null,
      },
      {
        onLockAcquired: async () => {
          submitAcquired = true;
          await releaseSubmit.promise;
        },
      },
    );

    await waitUntil(() => submitAcquired);

    const cancelCall = cancelDemandRequestForOrganizer(organizerProfileId, demand.id, {
      onBeforeLock: () => {
        cancelReachedLockStatement = true;
      },
      onLockAcquired: () => {
        cancelAcquired = true;
      },
    });

    await waitUntil(() => cancelReachedLockStatement);
    await sleep(300);
    expect(cancelAcquired).toBe(false);

    releaseSubmit.resolve();
    const [submitResult, cancelResult] = await Promise.all([submitCall, cancelCall]);
    expect(cancelAcquired).toBe(true);

    expect(submitResult.ok).toBe(true);
    expect(cancelResult).toEqual({ ok: true });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("cancelled");

    const responses = await prisma.demandResponse.findMany({
      where: { demandRequestId: demand.id },
      select: { status: true },
    });
    expect(responses).toHaveLength(1);
    expect(responses[0].status).toBe("declined");
  });

  // D11 #2 (order A): select wins the race and the demand becomes matched; cancel
  // afterward is still allowed (D2) and correctly cascades the newly-selected response.
  test("cancel-vs-select (select wins): the response selected during the race is still cascaded to declined when cancel proceeds afterward", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-select-a-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const response = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    const releaseSelect = createDeferred<void>();
    let selectAcquired = false;
    let cancelReachedLockStatement = false;
    let cancelAcquired = false;

    const selectCall = selectDemandResponseForOrganizer(organizerProfileId, response.id, {
      onLockAcquired: async () => {
        selectAcquired = true;
        await releaseSelect.promise;
      },
    });

    await waitUntil(() => selectAcquired);

    const cancelCall = cancelDemandRequestForOrganizer(organizerProfileId, demand.id, {
      onBeforeLock: () => {
        cancelReachedLockStatement = true;
      },
      onLockAcquired: () => {
        cancelAcquired = true;
      },
    });

    await waitUntil(() => cancelReachedLockStatement);
    await sleep(300);
    expect(cancelAcquired).toBe(false);

    releaseSelect.resolve();
    const [selectResult, cancelResult] = await Promise.all([selectCall, cancelCall]);
    expect(cancelAcquired).toBe(true);

    expect(selectResult.ok).toBe(true);
    expect(cancelResult).toEqual({ ok: true });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("cancelled");

    const responseAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: response.id },
      select: { status: true },
    });
    expect(responseAfter.status).toBe("declined");
  });

  // D11 #2 (order B): cancel wins the race first; select afterward naturally hits the
  // EXISTING response_not_submitted fallback (no new error code, no change to select's
  // own logic — codex round 2's correction, see plan D11 item 2).
  test("cancel-vs-select (cancel wins): select afterward correctly hits the existing response_not_submitted error, no orphaned selected response", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-select-b-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const response = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    const releaseCancel = createDeferred<void>();
    let cancelAcquired = false;
    let selectReachedLockStatement = false;
    let selectAcquired = false;

    const cancelCall = cancelDemandRequestForOrganizer(organizerProfileId, demand.id, {
      onLockAcquired: async () => {
        cancelAcquired = true;
        await releaseCancel.promise;
      },
    });

    await waitUntil(() => cancelAcquired);

    const selectCall = selectDemandResponseForOrganizer(organizerProfileId, response.id, {
      onBeforeLock: () => {
        selectReachedLockStatement = true;
      },
      onLockAcquired: () => {
        selectAcquired = true;
      },
    });

    await waitUntil(() => selectReachedLockStatement);
    await sleep(300);
    expect(selectAcquired).toBe(false);

    releaseCancel.resolve();
    const [cancelResult, selectResult] = await Promise.all([cancelCall, selectCall]);
    expect(selectAcquired).toBe(true);

    expect(cancelResult).toEqual({ ok: true });
    expect(selectResult).toEqual({ ok: false, code: "response_not_submitted" });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("cancelled");

    const selectedCount = await prisma.demandResponse.count({
      where: { demandRequestId: demand.id, status: "selected" },
    });
    expect(selectedCount).toBe(0);

    const responseAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: response.id },
      select: { status: true },
    });
    expect(responseAfter.status).toBe("declined");
  });

  // D11 #3 (order A): createClassSession wins the race and converts the demand;
  // cancel afterward correctly hits demand_request_not_cancellable — the highest-risk
  // interaction, since ClassSession.demandRequestId is onDelete: Restrict.
  test("cancel-vs-createClassSession (create wins): cancel afterward correctly fails with demand_request_not_cancellable, leaving the class session intact", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-create-a-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      status: "selected",
    });

    const validation = validateClassSessionCreate(validClassSessionInput);
    if (!validation.valid) throw new Error("unexpected invalid class session input");

    const releaseCreate = createDeferred<void>();
    let createAcquired = false;
    let cancelReachedLockStatement = false;
    let cancelAcquired = false;

    const createCall = createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
      {
        onLockAcquired: async () => {
          createAcquired = true;
          await releaseCreate.promise;
        },
      },
    );

    await waitUntil(() => createAcquired);

    const cancelCall = cancelDemandRequestForOrganizer(organizerProfileId, demand.id, {
      onBeforeLock: () => {
        cancelReachedLockStatement = true;
      },
      onLockAcquired: () => {
        cancelAcquired = true;
      },
    });

    await waitUntil(() => cancelReachedLockStatement);
    await sleep(300);
    expect(cancelAcquired).toBe(false);

    releaseCreate.resolve();
    const [createResult, cancelResult] = await Promise.all([createCall, cancelCall]);
    expect(cancelAcquired).toBe(true);

    expect(createResult.ok).toBe(true);
    expect(cancelResult).toEqual({ ok: false, code: "demand_request_not_cancellable" });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("converted_to_class");

    const classSessionCount = await prisma.classSession.count({
      where: { demandRequestId: demand.id },
    });
    expect(classSessionCount).toBe(1);
  });

  // D11 #3 (order B): cancel wins the race first; createClassSession afterward
  // correctly fails with demand_not_matched, no class session ever created against
  // a cancelled demand.
  test("cancel-vs-createClassSession (cancel wins): createClassSession afterward correctly fails with demand_not_matched, no class session created", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-create-b-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      status: "selected",
    });

    const validation = validateClassSessionCreate(validClassSessionInput);
    if (!validation.valid) throw new Error("unexpected invalid class session input");

    const releaseCancel = createDeferred<void>();
    let cancelAcquired = false;
    let createReachedLockStatement = false;
    let createAcquired = false;

    const cancelCall = cancelDemandRequestForOrganizer(organizerProfileId, demand.id, {
      onLockAcquired: async () => {
        cancelAcquired = true;
        await releaseCancel.promise;
      },
    });

    await waitUntil(() => cancelAcquired);

    const createCall = createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
      {
        onBeforeLock: () => {
          createReachedLockStatement = true;
        },
        onLockAcquired: () => {
          createAcquired = true;
        },
      },
    );

    await waitUntil(() => createReachedLockStatement);
    await sleep(300);
    expect(createAcquired).toBe(false);

    releaseCancel.resolve();
    const [cancelResult, createResult] = await Promise.all([cancelCall, createCall]);
    expect(createAcquired).toBe(true);

    expect(cancelResult).toEqual({ ok: true });
    expect(createResult).toEqual({ ok: false, code: "demand_not_matched" });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("cancelled");

    const classSessionCount = await prisma.classSession.count({
      where: { demandRequestId: demand.id },
    });
    expect(classSessionCount).toBe(0);
  });

  // D11 #4: cascade cancellation from published with multiple submitted responses.
  test("cancelling a published demand cascades all submitted responses to declined, without touching an unrelated demand", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cascade-published-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacherA = await seedTeacher(testRunId, "a");
    const teacherB = await seedTeacher(testRunId, "b");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const respA = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherA.teacherProfileId,
    });
    const respB = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherB.teacherProfileId,
    });

    const otherDemand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Other Demand ${testRunId}` }),
    });
    const otherTeacher = await seedTeacher(testRunId, "other");
    const otherResp = await createDemandResponse({
      demandRequestId: otherDemand.id,
      teacherProfileId: otherTeacher.teacherProfileId,
    });

    const result = await cancelDemandRequestForOrganizer(organizerProfileId, demand.id);
    expect(result).toEqual({ ok: true });

    const responses = await prisma.demandResponse.findMany({
      where: { id: { in: [respA.id, respB.id] } },
    });
    expect(responses).toHaveLength(2);
    expect(responses.every((r) => r.status === "declined")).toBe(true);

    const otherRespAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: otherResp.id },
      select: { status: true },
    });
    expect(otherRespAfter.status).toBe("submitted");

    const otherDemandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: otherDemand.id },
      select: { status: true },
    });
    expect(otherDemandAfter.status).toBe("published");
  });

  // D11 #5: cascade cancellation from matched (1 selected + others already declined).
  test("cancelling a matched demand cascades the selected response to declined, leaving already-declined responses untouched", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-cascade-matched-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacherA = await seedTeacher(testRunId, "a");
    const teacherB = await seedTeacher(testRunId, "b");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const selectedResp = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherA.teacherProfileId,
      status: "selected",
    });
    const declinedResp = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherB.teacherProfileId,
      status: "declined",
    });

    const result = await cancelDemandRequestForOrganizer(organizerProfileId, demand.id);
    expect(result).toEqual({ ok: true });

    const selectedRespAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: selectedResp.id },
      select: { status: true, updatedAt: true },
    });
    expect(selectedRespAfter.status).toBe("declined");

    const declinedRespAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: declinedResp.id },
      select: { status: true },
    });
    expect(declinedRespAfter.status).toBe("declined");
  });

  // D11 #6: D1 state boundary — converted_to_class and rejected cannot be cancelled.
  test("D1: rejects cancelling a converted_to_class or rejected demand with an explicit error code", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-boundary-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");

    const matchedDemand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Converted Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: matchedDemand.id,
      teacherProfileId: teacher.teacherProfileId,
      status: "selected",
    });
    const validation = validateClassSessionCreate(validClassSessionInput);
    if (!validation.valid) throw new Error("unexpected invalid class session input");
    const created = await createClassSessionForOrganizer(
      organizerProfileId,
      matchedDemand.id,
      validation.normalized,
    );
    if (!created.ok) throw new Error("unexpected create failure in test fixture");

    const convertedResult = await cancelDemandRequestForOrganizer(
      organizerProfileId,
      matchedDemand.id,
    );
    expect(convertedResult).toEqual({ ok: false, code: "demand_request_not_cancellable" });

    const convertedDemandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: matchedDemand.id },
      select: { status: true },
    });
    expect(convertedDemandAfter.status).toBe("converted_to_class");

    const rejectedDemand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "rejected",
      data: completeDemandRequestData({ title: `Rejected Demand ${testRunId}` }),
    });

    const rejectedResult = await cancelDemandRequestForOrganizer(
      organizerProfileId,
      rejectedDemand.id,
    );
    expect(rejectedResult).toEqual({ ok: false, code: "demand_request_not_cancellable" });

    const rejectedDemandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: rejectedDemand.id },
      select: { status: true },
    });
    expect(rejectedDemandAfter.status).toBe("rejected");
  });

  // D11 #7: notification correctness — self + each affected_responder, and no
  // affected_responder notifications when cancelling a demand with no responses.
  test("notifies organizer(self) and each affected teacher(affected_responder); a draft demand with no responses only notifies the organizer", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-${Date.now()}`,
    );
    const { organizerProfileId, organizationId, userId: organizerUserId } =
      await seedOrganizer(testRunId);
    const teacherA = await seedTeacher(testRunId, "a");
    const teacherB = await seedTeacher(testRunId, "b");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherA.teacherProfileId,
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherB.teacherProfileId,
    });

    const result = await cancelDemandRequestForOrganizer(organizerProfileId, demand.id);
    expect(result).toEqual({ ok: true });

    const notifs = await prisma.notification.findMany({
      where: {
        type: "demand_request_cancelled",
        userId: { in: [organizerUserId, teacherA.userId, teacherB.userId] },
      },
    });

    const orgNotif = notifs.find((n) => n.userId === organizerUserId);
    expect(orgNotif?.title).toBe("需求已取消");
    expect(orgNotif?.body).toContain(`Demand ${testRunId}`);

    const teacherANotif = notifs.find((n) => n.userId === teacherA.userId);
    expect(teacherANotif?.title).toBe("需求已取消");
    expect(teacherANotif?.body).toContain(`Demand ${testRunId}`);

    const teacherBNotif = notifs.find((n) => n.userId === teacherB.userId);
    expect(teacherBNotif).toBeDefined();

    expect(notifs).toHaveLength(3);

    // draft demand，沒有任何 response，只有 organizer 收到通知，不會有任何
    // affected_responder 記錄產生。
    const draftOrganizer = await seedOrganizer(testRunId, "draft");
    const draftDemand = await createDemandRequest({
      organizerProfileId: draftOrganizer.organizerProfileId,
      organizationId: draftOrganizer.organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: `Draft Demand ${testRunId}` }),
    });

    const draftResult = await cancelDemandRequestForOrganizer(
      draftOrganizer.organizerProfileId,
      draftDemand.id,
    );
    expect(draftResult).toEqual({ ok: true });

    const draftNotifs = await prisma.notification.findMany({
      where: { type: "demand_request_cancelled", userId: draftOrganizer.userId },
    });
    expect(draftNotifs).toHaveLength(1);
    expect(draftNotifs[0].title).toBe("需求已取消");
  });

  // D11 #8: notification failure isolation — a synchronously-throwing notifyOverride
  // must not affect the already-committed DB mutation or the returned result.
  test("notification failure is isolated: cancellation still succeeds and cascades correctly even if the notify call throws", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-fail-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const response = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    const throwingNotify = async () => {
      throw new Error("simulated notification failure");
    };

    const result = await cancelDemandRequestForOrganizer(
      organizerProfileId,
      demand.id,
      undefined,
      throwingNotify,
    );
    expect(result).toEqual({ ok: true });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("cancelled");

    const responseAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: response.id },
      select: { status: true },
    });
    expect(responseAfter.status).toBe("declined");
  });

  // D11 #9: teacher-facing copy fix — a cascaded-declined response shows the
  // cancellation copy, not the old "someone else was chosen" copy.
  test("a teacher whose response was cascaded to declined sees the corrected demand-cancellation copy through the UI", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-teacher-copy-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    const result = await cancelDemandRequestForOrganizer(organizerProfileId, demand.id);
    expect(result).toEqual({ ok: true });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);
    await expect(page.getByText("需求已取消", { exact: true })).toBeVisible();
    await expect(page.getByText("團主已取消這則需求，感謝你的回應。")).toBeVisible();
    await expect(page.getByText("團主這次選擇了其他老師")).toBeHidden();
  });

  // D11 #10: IDOR.
  test("blocks a non-owning organizer from cancelling someone else's demand (IDOR)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    const other = await seedOrganizer(testRunId, "other");

    const result = await cancelDemandRequestForOrganizer(
      other.organizerProfileId,
      demand.id,
    );
    expect(result).toEqual({ ok: false, code: "demand_request_not_found" });

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("published");
  });

  // D11 #11: double-cancel.
  test("cancelling an already-cancelled demand returns an explicit error, not silent success", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-double-${Date.now()}`,
    );
    const { organizerProfileId, organizationId } = await seedOrganizer(testRunId);
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    const first = await cancelDemandRequestForOrganizer(organizerProfileId, demand.id);
    expect(first).toEqual({ ok: true });

    const second = await cancelDemandRequestForOrganizer(organizerProfileId, demand.id);
    expect(second).toEqual({ ok: false, code: "demand_request_already_cancelled" });
  });

  // D11 #12: full UI E2E flow.
  test("lets an organizer cancel a demand through the UI; the affected teacher sees the corrected copy", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-ui-${Date.now()}`,
    );
    const { organizerProfileId, organizationId, sessionToken } = await seedOrganizer(testRunId);
    const teacher = await seedTeacher(testRunId, "a");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);
    await page.getByText("取消需求…").click();
    await page
      .getByRole("checkbox", {
        name: "我確認要取消這則需求，且已提交或已選定的老師回應也會一併取消。",
      })
      .check();
    await page.getByRole("button", { name: "確認取消需求" }).click();
    await expect(page.getByText("需求已取消。")).toBeVisible();
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);
    await expect(page.getByText("需求已取消", { exact: true })).toBeVisible();
    await expect(page.getByText("團主已取消這則需求，感謝你的回應。")).toBeVisible();
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitUntil timed out");
    }

    await sleep(10);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
