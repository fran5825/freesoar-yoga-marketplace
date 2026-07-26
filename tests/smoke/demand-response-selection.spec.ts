import { expect, test } from "@playwright/test";

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

const testEmailDomain = "demand-response-selection-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("demand response selection smoke", () => {
  test("lets an organizer select a response through the UI; the rest auto-decline, the demand becomes matched, and the teacher side reflects it without any code change", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-select-ui-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail, organizerEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });
    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
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
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherB.teacherProfileId,
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);

    await expect(page.getByText(`Teacher A ${testRunId}`)).toBeVisible();
    await page
      .locator("li", { hasText: `Teacher A ${testRunId}` })
      .getByText("選定這位老師…")
      .click();
    await page
      .locator("li", { hasText: `Teacher A ${testRunId}` })
      .getByRole("checkbox", { name: "我確認要選定這位老師。" })
      .check();
    await page
      .locator("li", { hasText: `Teacher A ${testRunId}` })
      .getByRole("button", { name: "確認選定" })
      .click();

    await expect(page.getByText("已選定這位老師。")).toBeVisible();

    const respAAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: respA.id },
      select: { status: true },
    });
    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(respAAfter.status).toBe("selected");
    expect(demandAfter.status).toBe("matched");

    // 已 matched 的 demand，其餘卡片不再顯示 select 表單。
    await page.reload();
    await expect(page.getByText("選定這位老師…")).toBeHidden();

    // Teacher 端不需修改任何程式碼即可正確顯示 selected/declined（2.1 現況驗證）。
    await addAuthSessionCookie(context, teacherA.sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);
    await expect(page.getByText("已被選中", { exact: true })).toBeVisible();

    await addAuthSessionCookie(context, teacherB.sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);
    await expect(page.getByText("未獲選", { exact: true })).toBeVisible();
  });

  test("blocks a non-owning organizer from selecting a response on someone else's demand (IDOR)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-select-idor-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const organizerAEmail = `organizer-a-${testRunId}@${testEmailDomain}`;
    const organizerBEmail = `organizer-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerAEmail, organizerBEmail);

    const teacher = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerAEmail,
        displayName: `Organizer A ${testRunId}`,
        organizationName: `Org A ${testRunId}`,
      });
    const { organizerProfileId: organizerBProfileId } =
      await createOrganizerProfileWithOrganization({
        email: organizerBEmail,
        displayName: `Organizer B ${testRunId}`,
        organizationName: `Org B ${testRunId}`,
      });
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

    const result = await selectDemandResponseForOrganizer(
      organizerBProfileId,
      response.id,
    );

    expect(result).toEqual({ ok: false, code: "demand_response_not_found" });

    const responseAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: response.id },
      select: { status: true },
    });
    expect(responseAfter.status).toBe("submitted");
  });

  test("blocks re-selecting on a demand that already has a selected response", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-select-again-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail, organizerEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
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

    const first = await selectDemandResponseForOrganizer(
      organizerProfileId,
      respA.id,
    );
    expect(first.ok).toBe(true);

    const second = await selectDemandResponseForOrganizer(
      organizerProfileId,
      respB.id,
    );
    expect(second).toEqual({
      ok: false,
      code: "response_demand_already_matched",
    });
  });

  // D5 併發保護，第三版測試手法（plan §8 Slice 4）：光靠 Promise.all 只是「機率上很可能重疊」，
  // 不是保證，且無法排除「兩次呼叫其實沒有真正重疊、只是照順序各自跑完」這種偽陽性。改用
  // production 函式本身的 hooks.onBeforeLock／onLockAcquired 當同步點，確定性地證明第一個呼叫
  // 真的拿到鎖、第二個呼叫真的送出了同一句 FOR UPDATE 卻被擋住，鎖放開後才繼續——測的是
  // production 程式碼本身，不是另外複製一份等價查詢。
  test("select-vs-select: FOR UPDATE deterministically blocks the second call until the first commits, and exactly one succeeds", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-select-select-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail, organizerEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
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

    const releaseFirst = createDeferred<void>();
    let firstAcquired = false;
    let secondReachedLockStatement = false;
    let secondAcquired = false;

    // 第一個呼叫：真正的 selectDemandResponseForOrganizer，只是在拿到鎖後刻意暫停，
    // 直到測試明確放行——這就是在測 production 程式碼本身，不是複製一份查詢。
    const firstCall = selectDemandResponseForOrganizer(organizerProfileId, respA.id, {
      onLockAcquired: async () => {
        firstAcquired = true;
        await releaseFirst.promise;
      },
    });

    await waitUntil(() => firstAcquired); // 確定第一個呼叫已經真的持有鎖

    // 第二個呼叫：同樣是 production 程式碼，鎖住同一個 demand。
    const secondCall = selectDemandResponseForOrganizer(organizerProfileId, respB.id, {
      onBeforeLock: () => {
        secondReachedLockStatement = true;
      },
      onLockAcquired: () => {
        secondAcquired = true;
      },
    });

    await waitUntil(() => secondReachedLockStatement); // 先確定第二個呼叫真的送出了 FOR UPDATE 陳述式本身

    // 已經先證明它送出了同一句 FOR UPDATE，這裡測到的延遲只可能是被 Postgres
    // 的列鎖真正擋住，不會是「還在等 connection pool」之類的偽陽性。
    await sleep(300);
    expect(secondAcquired).toBe(false);

    releaseFirst.resolve();
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(secondAcquired).toBe(true); // 鎖釋放後第二個呼叫才真正繼續

    // 順序被本測試明確控制（第一個呼叫先拿到鎖並持有），因此贏家是確定性的，不是「兩者之一」。
    expect(firstResult.ok).toBe(true);
    expect(secondResult).toMatchObject({
      ok: false,
      code: "response_demand_already_matched",
    });

    const selectedCount = await prisma.demandResponse.count({
      where: { demandRequestId: demand.id, status: "selected" },
    });
    expect(selectedCount).toBe(1);

    const respBAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: respB.id },
      select: { status: true },
    });
    expect(respBAfter.status).toBe("declined");

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("matched");
  });

  test("submit-vs-select: FOR UPDATE deterministically blocks a concurrent submit until select commits, leaving no orphaned submitted response", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-submit-select-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail, organizerEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
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

    const releaseSelect = createDeferred<void>();
    let selectAcquired = false;
    let submitReachedLockStatement = false;
    let submitAcquired = false;

    // select 先拿到鎖並持有，證明 select 與 submit 真的共用同一把 demand-level 鎖
    // （不只是各自函式內部序列化）。
    const selectCall = selectDemandResponseForOrganizer(organizerProfileId, respA.id, {
      onLockAcquired: async () => {
        selectAcquired = true;
        await releaseSelect.promise;
      },
    });

    await waitUntil(() => selectAcquired);

    const submitCall = submitDemandResponseForTeacher(
      teacherB.teacherProfileId,
      demand.id,
      {
        message: `${testRunId} teacher B 併發送出的回應內容。`,
        proposedTimeSlots: ["平日晚上"],
        proposedPrice: null,
      },
      {
        onBeforeLock: () => {
          submitReachedLockStatement = true;
        },
        onLockAcquired: () => {
          submitAcquired = true;
        },
      },
    );

    await waitUntil(() => submitReachedLockStatement);

    await sleep(300);
    expect(submitAcquired).toBe(false);

    releaseSelect.resolve();
    await Promise.all([selectCall, submitCall]);
    expect(submitAcquired).toBe(true);

    // select 先拿到鎖並完成，demand 在 submit 真正插入前就已經是 matched，
    // 所以既有的 eligibility guard 自然擋下 submit，不需要修改那段判斷邏輯本身（見 D5）。
    const orphanSubmittedCount = await prisma.demandResponse.count({
      where: { demandRequestId: demand.id, status: "submitted" },
    });
    expect(orphanSubmittedCount).toBe(0);

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("matched");

    const selectedCount = await prisma.demandResponse.count({
      where: { demandRequestId: demand.id, status: "selected" },
    });
    expect(selectedCount).toBe(1);
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

async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> {
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
