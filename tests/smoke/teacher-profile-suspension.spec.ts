import { expect, test } from "@playwright/test";

import {
  restoreSuspendedTeacherProfileForAdmin,
  suspendApprovedTeacherProfileForAdmin,
} from "../../src/domain/teacher-profile/__internal__/suspend-restore-core";
import { selectDemandResponseForOrganizer } from "../../src/domain/demand-response/__internal__/select-and-submit-core";
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

const testEmailDomain = "teacher-profile-suspension-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedTeacher(testRunId: string, suffix: string, status: "approved" | "draft" | "submitted" | "rejected" | "suspended" = "approved") {
  const email = `teacher-${suffix}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({
    email,
    displayName: `Teacher ${suffix} ${testRunId}`,
    status,
  });
}

test.describe("teacher profile suspension smoke", () => {
  // D1: source-status boundaries for suspend.
  test("D1: rejects suspending a draft/submitted/rejected teacher with an explicit error code", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspend-boundary-${Date.now()}`,
    );

    for (const status of ["draft", "submitted", "rejected"] as const) {
      const teacher = await seedTeacher(testRunId, status, status);
      const result = await suspendApprovedTeacherProfileForAdmin(
        teacher.teacherProfileId,
        "有效的暫停原因文字長度足夠十個字以上",
      );
      expect(result).toEqual({ ok: false, code: "teacher_profile_not_approved" });

      const row = await prisma.teacherProfile.findUniqueOrThrow({
        where: { id: teacher.teacherProfileId },
        select: { status: true },
      });
      expect(row.status).toBe(status);
    }
  });

  // D2: source-status boundaries for restore.
  test("D2: rejects restoring a draft/submitted/rejected/approved teacher with an explicit error code", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-restore-boundary-${Date.now()}`,
    );

    for (const status of ["draft", "submitted", "rejected", "approved"] as const) {
      const teacher = await seedTeacher(testRunId, status, status);
      const result = await restoreSuspendedTeacherProfileForAdmin(teacher.teacherProfileId);
      expect(result).toEqual({ ok: false, code: "teacher_profile_not_suspended" });

      const row = await prisma.teacherProfile.findUniqueOrThrow({
        where: { id: teacher.teacherProfileId },
        select: { status: true },
      });
      expect(row.status).toBe(status);
    }
  });

  // D1/D2: double-suspend and double-restore return explicit errors, not silent success.
  test("double-suspend and double-restore return explicit errors, not silent success", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-double-${Date.now()}`,
    );

    const suspendTarget = await seedTeacher(testRunId, "a", "approved");
    const first = await suspendApprovedTeacherProfileForAdmin(
      suspendTarget.teacherProfileId,
      "第一次暫停的原因文字內容足夠長度",
    );
    expect(first).toEqual({ ok: true });
    const second = await suspendApprovedTeacherProfileForAdmin(
      suspendTarget.teacherProfileId,
      "第二次暫停嘗試應該被擋下才對",
    );
    expect(second).toEqual({ ok: false, code: "teacher_profile_not_approved" });

    const restoreTarget = await seedTeacher(testRunId, "b", "suspended");
    const firstRestore = await restoreSuspendedTeacherProfileForAdmin(restoreTarget.teacherProfileId);
    expect(firstRestore).toEqual({ ok: true });
    const secondRestore = await restoreSuspendedTeacherProfileForAdmin(restoreTarget.teacherProfileId);
    expect(secondRestore).toEqual({ ok: false, code: "teacher_profile_not_suspended" });
  });

  test("not found returns an explicit error for both suspend and restore", async () => {
    const suspendResult = await suspendApprovedTeacherProfileForAdmin(
      "nonexistent-teacher-profile-id",
      "有效的暫停原因文字長度足夠十個字以上",
    );
    expect(suspendResult).toEqual({ ok: false, code: "teacher_profile_not_found" });

    const restoreResult = await restoreSuspendedTeacherProfileForAdmin("nonexistent-teacher-profile-id");
    expect(restoreResult).toEqual({ ok: false, code: "teacher_profile_not_found" });
  });

  // D1: suspend persists suspensionReason and advances updatedAt.
  // D2: restore clears suspensionReason and advances updatedAt.
  test("suspend persists the reason and advances updatedAt; restore clears the reason and advances updatedAt", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-persist-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId, "a", "approved");
    const before = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherProfileId },
      select: { updatedAt: true },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const suspendResult = await suspendApprovedTeacherProfileForAdmin(
      teacher.teacherProfileId,
      "品質與安全考量需要暫停這位老師的資格",
    );
    expect(suspendResult).toEqual({ ok: true });

    const afterSuspend = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherProfileId },
    });
    expect(afterSuspend.status).toBe("suspended");
    expect(afterSuspend.suspensionReason).toBe("品質與安全考量需要暫停這位老師的資格");
    expect(afterSuspend.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());

    await new Promise((resolve) => setTimeout(resolve, 20));

    const restoreResult = await restoreSuspendedTeacherProfileForAdmin(teacher.teacherProfileId);
    expect(restoreResult).toEqual({ ok: true });

    const afterRestore = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherProfileId },
    });
    expect(afterRestore.status).toBe("approved");
    expect(afterRestore.suspensionReason).toBeNull();
    expect(afterRestore.updatedAt.getTime()).toBeGreaterThan(afterSuspend.updatedAt.getTime());
  });

  // D4: notification correctness for both events.
  test("notifies the teacher(self) with correct content for both suspend and restore", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-notify-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId, "a", "approved");

    const suspendResult = await suspendApprovedTeacherProfileForAdmin(
      teacher.teacherProfileId,
      "通知內容驗證用的暫停原因文字",
    );
    expect(suspendResult).toEqual({ ok: true });

    const suspendNotif = await prisma.notification.findFirstOrThrow({
      where: { userId: teacher.userId, type: "teacher_profile_suspended" },
    });
    expect(suspendNotif.title).toBe("老師資格已暫停");
    expect(suspendNotif.body).toContain("通知內容驗證用的暫停原因文字");

    const restoreResult = await restoreSuspendedTeacherProfileForAdmin(teacher.teacherProfileId);
    expect(restoreResult).toEqual({ ok: true });

    const restoreNotif = await prisma.notification.findFirstOrThrow({
      where: { userId: teacher.userId, type: "teacher_profile_restored" },
    });
    expect(restoreNotif.title).toBe("老師資格已恢復");
  });

  // D5 修正版：決定性 staleness 測試——恢復呼叫在暫停呼叫的 notify check 之前完整跑完，
  // 斷言暫停呼叫的 notifyOverride 完全沒被呼叫，只留下一筆「已恢復」通知。
  test("D5: a stale suspend notification is suppressed when a concurrent restore completes first", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-staleness-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId, "a", "approved");

    let suspendNotifyCalled = false;
    let reachedNotifyCheck = false;
    const release = createDeferred<void>();

    const suspendCall = suspendApprovedTeacherProfileForAdmin(
      teacher.teacherProfileId,
      "會被恢復蓋掉的暫停原因文字內容",
      {
        onBeforeNotifyCheck: async () => {
          reachedNotifyCheck = true;
          await release.promise;
        },
      },
      async () => {
        suspendNotifyCalled = true;
      },
    );

    await waitUntil(() => reachedNotifyCheck);

    // Confirm suspend's mutation already committed before the concurrent restore runs.
    const midway = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherProfileId },
      select: { status: true },
    });
    expect(midway.status).toBe("suspended");

    const restoreResult = await restoreSuspendedTeacherProfileForAdmin(teacher.teacherProfileId);
    expect(restoreResult).toEqual({ ok: true });

    release.resolve();
    const suspendResult = await suspendCall;
    expect(suspendResult).toEqual({ ok: true });
    expect(suspendNotifyCalled).toBe(false);

    const notifs = await prisma.notification.findMany({
      where: {
        userId: teacher.userId,
        type: { in: ["teacher_profile_suspended", "teacher_profile_restored"] },
      },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("teacher_profile_restored");

    const finalRow = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherProfileId },
      select: { status: true },
    });
    expect(finalRow.status).toBe("approved");
  });

  // D7 修正版：暫停一位老師之後，Organizer 不能再選定他既有、還沒被選定的 submitted
  // response——這是這輪要修的既有缺口本身（見 select-and-submit-core.ts 的變更）。
  test("D7: selectDemandResponseForOrganizer blocks a suspended teacher's still-submitted response, without touching response_not_submitted/response_demand_already_matched", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-select-block-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
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
    const teacher = await seedTeacher(testRunId, "target", "approved");
    const response = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    const suspendResult = await suspendApprovedTeacherProfileForAdmin(
      teacher.teacherProfileId,
      "暫停後應該無法再被選定的原因文字",
    );
    expect(suspendResult).toEqual({ ok: true });

    const selectResult = await selectDemandResponseForOrganizer(organizerProfileId, response.id);
    expect(selectResult).toEqual({ ok: false, code: "response_teacher_not_approved" });

    const responseAfter = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: response.id },
      select: { status: true },
    });
    expect(responseAfter.status).toBe("submitted");

    // 確認既有的兩個分類分支沒有被新檢查影響：另一位 approved 老師的 response 仍可正常選定。
    const otherTeacher = await seedTeacher(testRunId, "other", "approved");
    const otherResponse = await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: otherTeacher.teacherProfileId,
    });
    const okResult = await selectDemandResponseForOrganizer(organizerProfileId, otherResponse.id);
    expect(okResult.ok).toBe(true);
  });

  // D6/D7: full UI E2E flow.
  test("lets an admin suspend and restore a teacher through the UI; the teacher dashboard reflects both transitions", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-ui-${Date.now()}`,
    );
    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    const teacher = await seedTeacher(testRunId, "a", "approved");

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");

    const approvedCard = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Teacher a ${testRunId}` }),
    });
    await expect(approvedCard).toBeVisible();
    await approvedCard.locator("summary").click();

    // D1: reason required — native required blocks empty submit, card stays in Approved.
    await approvedCard.getByRole("button", { name: "確認暫停" }).click();
    await expect(approvedCard).toBeVisible();

    const reason = "近期收到多筆課程品質相關反映，需要先暫停接受新需求。";
    await approvedCard.getByLabel("暫停原因").fill(reason);
    await approvedCard.getByRole("checkbox", { name: /我確認要暫停這位老師/ }).check();
    await approvedCard.getByRole("button", { name: "確認暫停" }).click();

    await expect(page.getByText("這位老師已經暫停。")).toBeVisible();

    const suspendedCard = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Teacher a ${testRunId}` }),
    });
    await expect(suspendedCard.getByText(reason)).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/dashboard");
    await expect(page.getByText("Suspended", { exact: true })).toBeVisible();
    await expect(page.getByText(reason)).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");
    const suspendedCardAgain = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Teacher a ${testRunId}` }),
    });
    await suspendedCardAgain.getByRole("checkbox", { name: "我確認要恢復這位老師。" }).check();
    await suspendedCardAgain.getByRole("button", { name: "Restore" }).click();

    await expect(page.getByText("這位老師已經恢復。")).toBeVisible();

    await context.clearCookies();
    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/dashboard");
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect(page.getByText(reason)).toBeHidden();
  });

  // D7 修正版：wrapper 層必須把新的 core 錯誤碼接到使用者看得到的文案，不能落到通用訊息。
  test("shows the organizer a specific error when selecting a suspended teacher's response through the UI", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-select-ui-${Date.now()}`,
    );
    const organizerEmail = `organizer-ui-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer UI ${testRunId}`,
        organizationName: `Org UI ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand UI ${testRunId}` }),
    });
    const teacher = await seedTeacher(testRunId, "ui", "approved");
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
    });

    const suspendResult = await suspendApprovedTeacherProfileForAdmin(
      teacher.teacherProfileId,
      "UI 測試用的暫停原因文字內容足夠長度",
    );
    expect(suspendResult).toEqual({ ok: true });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);
    await page
      .locator("li", { hasText: `Teacher ui ${testRunId}` })
      .getByText("選定這位老師…")
      .click();
    await page
      .locator("li", { hasText: `Teacher ui ${testRunId}` })
      .getByRole("checkbox", { name: "我確認要選定這位老師。" })
      .check();
    await page
      .locator("li", { hasText: `Teacher ui ${testRunId}` })
      .getByRole("button", { name: "確認選定" })
      .click();

    await expect(
      page.getByText("這位老師目前無法被選定，可能帳號已被暫停，請重新整理後確認。"),
    ).toBeVisible();
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
