import { expect, test, type Browser } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { confirmProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/respond-core";
import {
  reviseProposalCore,
  withdrawProposalCore,
  type ProposalRevision,
} from "../../src/domain/organizer-class-proposal/__internal__/revise-core";
import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 07：修改、撤回與重新邀請。
const testEmailDomain = "proposal-revise-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.organizerClassProposal.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.classSession.deleteMany({
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

function slot(daysFromNow: number, startHourOffset = 0) {
  const base = Math.floor((Date.now() + daysFromNow * DAY) / HOUR) * HOUR + startHourOffset * HOUR;
  return { startAt: new Date(base), endAt: new Date(base + HOUR) };
}

async function newTeacher(id: string, label: string) {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({ email, displayName: `Teacher ${label} ${id}`, status: "approved" });
  const user = await prisma.teacherProfile.findUniqueOrThrow({
    where: { id: teacher.teacherProfileId },
    select: { userId: true },
  });
  return { ...teacher, userId: user.userId };
}

async function setup(id: string) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Organizer ${id}`,
    organizationName: `Revise Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const teacher = await newTeacher(id, "a");
  return { organizer, teacher };
}

async function createProposal(
  organizer: { organizerProfileId: string; organizationId: string },
  teacherProfileId: string,
  title: string,
  times: { startAt: Date; endAt: Date },
  status: "pending_confirmation" | "declined" | "confirmed" | "draft" = "pending_confirmation",
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
      status,
      submittedAt: status === "draft" ? null : new Date(),
      ...(status === "declined" ? { declineReason: "那天有事" } : {}),
    },
  });
}

function revisionOf(
  proposal: { organizationId: string; teacherProfileId: string | null; title: string | null; startAt: Date | null; endAt: Date | null },
  overrides: Partial<ProposalRevision> = {},
): ProposalRevision {
  return {
    organizationId: proposal.organizationId,
    teacherProfileId: proposal.teacherProfileId,
    title: proposal.title,
    description: null,
    serviceType: "伸展與身體保養",
    serviceTypes: ["伸展與身體保養"],
    startAt: proposal.startAt,
    endAt: proposal.endAt,
    location: "台北市信義區",
    capacity: 15,
    isPublic: false,
    ...overrides,
  };
}

async function organizerPage(browser: Browser, sessionToken: string) {
  const context = await browser.newContext();
  await addAuthSessionCookie(context, sessionToken);
  return { context, page: await context.newPage() };
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

test.describe("organizer class proposal revise smoke", () => {
  test("revising a pending invitation keeps it pending with a new version, so the teacher's old page cannot confirm", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "pending");
    const { organizer, teacher } = await setup(id);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `待確認修改 ${id}`, slot(40));

    const { context, page } = await organizerPage(browser, organizer.sessionToken);
    await page.goto(`/organizer/class-proposals/${proposal.id}`);
    await page.getByRole("link", { name: "修改內容" }).click();
    await expect(page.getByText(/老師正在確認這份邀請/)).toBeVisible();
    await page.getByLabel("地點").fill("台北市大安區新教室");
    await page.getByRole("button", { name: "儲存並更新邀請" }).first().click();
    await expect(page.getByText("已更新邀請內容，老師會看到最新的安排並重新確認。").first()).toBeVisible();

    // 改成不完整（清掉地點）：待確認中的邀請不能存成不完整。
    await page.getByLabel("地點").fill("");
    await expect(page.getByRole("button", { name: "儲存並更新邀請" }).first()).toBeDisabled();
    await context.close();

    const revised = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, version: true, location: true },
    });
    expect(revised).toEqual({ status: "pending_confirmation", version: 2, location: "台北市大安區新教室" });
    // 老師的舊頁面（version 1）不能確認新內容。
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1)).toEqual({
      ok: false,
      code: "proposal_version_stale",
    });
    // 伺服器端也擋不完整的修改。
    expect(
      await reviseProposalCore(organizer.organizerProfileId, proposal.id, 2, revisionOf(proposal, { location: null })),
    ).toMatchObject({ ok: false, code: "proposal_incomplete" });
  });

  test("revising a confirmed invitation returns it to draft, clears the confirmation and frees the slot", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "confirmed");
    const { organizer, teacher } = await setup(id);
    const times = slot(41);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `已確認修改 ${id}`, times);
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1)).toEqual({ ok: true });

    const { context, page } = await organizerPage(browser, organizer.sessionToken);
    await page.goto(`/organizer/class-proposals/${proposal.id}/edit`);
    await expect(page.getByText(/修改內容會讓老師的確認失效、釋放已保留的時段/)).toBeVisible();
    await page.getByLabel("課程名稱").fill(`已確認修改 ${id} v2`);
    await page.getByRole("button", { name: "儲存為草稿（確認失效）" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "送出邀請" }).first()).toBeVisible();
    await context.close();

    const draft = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, confirmedVersion: true, confirmedAt: true, confirmedByUserId: true, version: true },
    });
    expect(draft).toEqual({ status: "draft", confirmedVersion: null, confirmedAt: null, confirmedByUserId: null, version: 2 });

    // 時段已釋放：老師可以在同一時段開自己的課。
    const created = await createClassSessionForTeacher(teacher.teacherProfileId, {
      title: `釋放後的課 ${id}`,
      description: null,
      serviceType: "伸展與身體保養",
      ...times,
      location: "台北",
      capacity: 10,
      isPublic: false,
    });
    expect(created.ok).toBe(true);
  });

  test("a declined invitation can be revised and re-sent in one step, clearing the old reason", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "declined");
    const { organizer, teacher } = await setup(id);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `婉拒後重送 ${id}`, slot(42), "declined");

    const { context, page } = await organizerPage(browser, organizer.sessionToken);
    await page.goto(`/organizer/class-proposals/${proposal.id}`);
    await page.getByRole("link", { name: "修改並重新邀請" }).click();
    await expect(page.getByText(/原因：那天有事/)).toBeVisible();
    await page.getByLabel("地點").fill("改到下午的教室");
    await page.getByRole("button", { name: "修改並重新邀請" }).first().click();
    await page.getByRole("button", { name: "確認送出邀請" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/organizer/class-proposals/${proposal.id}\\?flash=submitted$`));
    await context.close();

    const resent = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, declineReason: true, location: true },
    });
    expect(resent).toEqual({ status: "pending_confirmation", declineReason: null, location: "改到下午的教室" });
  });

  test("withdrawing a confirmed invitation frees the slot, records the reason for the teacher, and cannot be undone", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "withdraw");
    const { organizer, teacher } = await setup(id);
    const times = slot(43);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `撤回 ${id}`, times);
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1)).toEqual({ ok: true });

    const { context, page } = await organizerPage(browser, organizer.sessionToken);
    await page.goto(`/organizer/class-proposals/${proposal.id}`);
    await page.getByRole("button", { name: "撤回邀請" }).click();
    await expect(page.getByText(/老師已確認的時段會釋放/)).toBeVisible();
    await page.getByLabel("撤回原因（選填）").fill("場地臨時無法使用");
    await page.getByRole("button", { name: "確認撤回" }).click();
    await expect(page.getByText(/你已撤回這份邀請（原因：場地臨時無法使用）/)).toBeVisible();
    // 撤回後不能再修改：編輯頁導回詳情。
    await page.goto(`/organizer/class-proposals/${proposal.id}/edit`);
    await expect(page).toHaveURL(new RegExp(`/organizer/class-proposals/${proposal.id}$`));
    await context.close();

    const teacherView = await organizerPage(browser, teacher.sessionToken);
    await teacherView.page.goto(`/teacher/class-proposals/${proposal.id}`);
    await expect(teacherView.page.getByText(/撤回原因：場地臨時無法使用/)).toBeVisible();
    await teacherView.context.close();

    // 撤回不能被改回其他狀態。
    expect(
      await reviseProposalCore(organizer.organizerProfileId, proposal.id, 1, revisionOf(proposal)),
    ).toEqual({ ok: false, code: "proposal_invalid_status" });
    expect(await withdrawProposalCore(organizer.organizerProfileId, proposal.id, 1, "")).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });

    // 時段已釋放：同時段另一份邀請可以被確認。
    const another = await createProposal(organizer, teacher.teacherProfileId, `撤回後的新邀請 ${id}`, times);
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, another.id, 1)).toEqual({ ok: true });
  });

  test("teacher swap, organization lock, converted guard and other organizers", async ({}, testInfo) => {
    const id = runId(testInfo, "rules");
    const { organizer, teacher } = await setup(id);
    const teacherB = await newTeacher(id, "b");
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `換老師 ${id}`, slot(44));

    // pending 中換老師：仍是 pending，改由新老師確認；舊老師看不到。
    const swapped = await reviseProposalCore(
      organizer.organizerProfileId,
      proposal.id,
      1,
      revisionOf(proposal, { teacherProfileId: teacherB.teacherProfileId }),
    );
    expect(swapped).toEqual({ ok: true, version: 2, status: "pending_confirmation" });
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 2)).toEqual({
      ok: false,
      code: "proposal_not_found",
    });

    // 換成未通過審核的老師：被拒。
    const suspendedEmail = `suspended-${id}@${testEmailDomain}`;
    createdEmails.push(suspendedEmail);
    const suspended = await createTeacherProfileWithSession({
      email: suspendedEmail,
      displayName: `Suspended ${id}`,
      status: "suspended",
    });
    expect(
      await reviseProposalCore(
        organizer.organizerProfileId,
        proposal.id,
        2,
        revisionOf(proposal, { teacherProfileId: suspended.teacherProfileId }),
      ),
    ).toEqual({ ok: false, code: "teacher_not_approved" });

    // 送出過的邀請不能換團體（即使已被婉拒、修改時會回到草稿）。
    const otherOrg = await prisma.organization.create({
      data: { name: `另一個團體 ${id}`, type: "community", ownerOrganizerProfileId: organizer.organizerProfileId },
    });
    const declined = await createProposal(organizer, teacher.teacherProfileId, `婉拒換團體 ${id}`, slot(44, 3), "declined");
    expect(
      await reviseProposalCore(organizer.organizerProfileId, declined.id, 1, revisionOf(declined, { organizationId: otherOrg.id })),
    ).toEqual({ ok: false, code: "organization_locked" });

    // 已開放報名（converted）不能修改或撤回。
    const converted = await createProposal(organizer, teacher.teacherProfileId, `已轉課 ${id}`, slot(44, 6), "confirmed");
    await prisma.organizerClassProposal.update({ where: { id: converted.id }, data: { status: "converted" } });
    expect(await reviseProposalCore(organizer.organizerProfileId, converted.id, 1, revisionOf(converted))).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });
    expect(await withdrawProposalCore(organizer.organizerProfileId, converted.id, 1, "")).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });

    // 其他團主：找不到。
    const otherEmail = `other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createOrganizerProfileWithOrganization({
      email: otherEmail,
      displayName: `Other ${id}`,
      organizationName: `Other Org ${id}`,
    });
    expect(await withdrawProposalCore(other.organizerProfileId, proposal.id, 2, "")).toEqual({
      ok: false,
      code: "proposal_not_found",
    });
  });

  test("revision holds the locks first: the waiting confirmation then sees a stale version", async ({}, testInfo) => {
    const id = runId(testInfo, "race-revise");
    const { organizer, teacher } = await setup(id);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `修改與確認 ${id}`, slot(45));

    const releaseRevise = createDeferred();
    let reviseAcquired = false;
    let confirmReachedLock = false;
    let confirmAcquired = false;

    const reviseCall = reviseProposalCore(
      organizer.organizerProfileId,
      proposal.id,
      1,
      revisionOf(proposal, { location: "競態中改的地點" }),
      {
        onLockAcquired: async () => {
          reviseAcquired = true;
          await releaseRevise.promise;
        },
      },
    );
    await waitUntil(() => reviseAcquired);

    const confirmCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1, {
      onBeforeLock: () => {
        confirmReachedLock = true;
      },
      onLockAcquired: () => {
        confirmAcquired = true;
      },
    });
    await waitUntil(() => confirmReachedLock);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(confirmAcquired).toBe(false);

    releaseRevise.resolve();
    const [reviseResult, confirmResult] = await Promise.all([reviseCall, confirmCall]);
    expect(reviseResult).toEqual({ ok: true, version: 2, status: "pending_confirmation" });
    expect(confirmResult).toEqual({ ok: false, code: "proposal_version_stale" });
  });

  test("a withdrawal and a confirmation at the same time never leave a confirmed withdrawn invitation", async ({}, testInfo) => {
    const id = runId(testInfo, "race-withdraw");
    const { organizer, teacher } = await setup(id);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `撤回與確認 ${id}`, slot(46));

    const releaseWithdraw = createDeferred();
    let withdrawAcquired = false;
    let confirmReachedLock = false;

    const withdrawCall = withdrawProposalCore(organizer.organizerProfileId, proposal.id, 1, "", {
      onLockAcquired: async () => {
        withdrawAcquired = true;
        await releaseWithdraw.promise;
      },
    });
    await waitUntil(() => withdrawAcquired);
    const confirmCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1, {
      onBeforeLock: () => {
        confirmReachedLock = true;
      },
    });
    await waitUntil(() => confirmReachedLock);
    releaseWithdraw.resolve();

    const [withdrawResult, confirmResult] = await Promise.all([withdrawCall, confirmCall]);
    expect(withdrawResult).toMatchObject({ ok: true, status: "withdrawn" });
    expect(confirmResult).toEqual({ ok: false, code: "proposal_invalid_status" });
    const final = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, confirmedAt: true },
    });
    expect(final).toEqual({ status: "withdrawn", confirmedAt: null });
  });
  test("confirmation holds the locks first: the waiting revision then succeeds, clearing the confirmation and freeing the slot", async ({}, testInfo) => {
    const id = runId(testInfo, "race-confirm-first");
    const { organizer, teacher } = await setup(id);
    const times = slot(47);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `確認先拿到鎖 ${id}`, times);

    const releaseConfirm = createDeferred();
    let confirmAcquired = false;
    let reviseReachedLock = false;
    let reviseAcquired = false;

    const confirmCall = confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, 1, {
      onLockAcquired: async () => {
        confirmAcquired = true;
        await releaseConfirm.promise;
      },
    });
    await waitUntil(() => confirmAcquired);
    const reviseCall = reviseProposalCore(
      organizer.organizerProfileId,
      proposal.id,
      1,
      revisionOf(proposal, { location: "確認後才改的地點" }),
      {
        onBeforeLock: () => {
          reviseReachedLock = true;
        },
        onLockAcquired: () => {
          reviseAcquired = true;
        },
      },
    );
    await waitUntil(() => reviseReachedLock);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(reviseAcquired).toBe(false);

    releaseConfirm.resolve();
    const [confirmResult, reviseResult] = await Promise.all([confirmCall, reviseCall]);
    // 確認不改 version，所以之後的修改仍以 version 1 成功；已確認的邀請修改後回到草稿。
    expect(confirmResult).toEqual({ ok: true });
    expect(reviseResult).toEqual({ ok: true, version: 2, status: "draft" });
    const final = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, confirmedAt: true, confirmedVersion: true, confirmedByUserId: true },
    });
    expect(final).toEqual({ status: "draft", confirmedAt: null, confirmedVersion: null, confirmedByUserId: null });
    // 時段已釋放。
    const created = await createClassSessionForTeacher(teacher.teacherProfileId, {
      title: `釋放後 ${id}`,
      description: null,
      serviceType: "伸展與身體保養",
      ...times,
      location: "台北",
      capacity: 10,
      isPublic: false,
    });
    expect(created.ok).toBe(true);
  });

  test("withdrawing a draft never exposes it to a teacher who did not receive this version", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "draft-privacy");
    const { organizer, teacher } = await setup(id);
    const teacherB = await newTeacher(id, "b");

    async function teacherStatus(sessionToken: string, proposalId: string) {
      const view = await organizerPage(browser, sessionToken);
      const response = await view.page.goto(`/teacher/class-proposals/${proposalId}`);
      const status = response?.status();
      await view.context.close();
      return status;
    }

    // 從未送出的草稿撤回：選過的老師讀不到。
    const neverSent = await createProposal(organizer, teacher.teacherProfileId, `從未送出 ${id}`, slot(48), "draft");
    expect(await withdrawProposalCore(organizer.organizerProfileId, neverSent.id, 1, "")).toMatchObject({ ok: true });
    expect(await teacherStatus(teacher.sessionToken, neverSent.id)).toBe(404);
    expect(
      (await prisma.organizerClassProposal.findUniqueOrThrow({ where: { id: neverSent.id } })).teacherProfileId,
    ).toBeNull();

    // A 已確認 → 修改並換成 B（回到草稿）→ 還沒邀請 B 就撤回：A、B 都讀不到。
    const swapped = await createProposal(organizer, teacher.teacherProfileId, `換人後撤回 ${id}`, slot(48, 3));
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, swapped.id, 1)).toEqual({ ok: true });
    expect(
      await reviseProposalCore(
        organizer.organizerProfileId,
        swapped.id,
        1,
        revisionOf(swapped, { teacherProfileId: teacherB.teacherProfileId }),
      ),
    ).toEqual({ ok: true, version: 2, status: "draft" });
    expect(await withdrawProposalCore(organizer.organizerProfileId, swapped.id, 2, "")).toMatchObject({ ok: true });
    expect(await teacherStatus(teacherB.sessionToken, swapped.id)).toBe(404);
    expect(await teacherStatus(teacher.sessionToken, swapped.id)).toBe(404);

    // 真正收到邀請（pending）的老師，撤回後仍看得到撤回原因（見撤回測試）；這裡再確認狀態碼。
    const sent = await createProposal(organizer, teacher.teacherProfileId, `已送出撤回 ${id}`, slot(48, 6));
    expect(await withdrawProposalCore(organizer.organizerProfileId, sent.id, 1, "改期")).toMatchObject({ ok: true });
    expect(await teacherStatus(teacher.sessionToken, sent.id)).toBe(200);
  });

  test("a declined invitation can be re-sent without changes: same version, reason cleared, and the teacher can confirm it", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "resend");
    const { organizer, teacher } = await setup(id);
    const proposal = await createProposal(organizer, teacher.teacherProfileId, `直接重送 ${id}`, slot(49), "declined");
    const before = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { version: true, transitionSeq: true },
    });

    const { context, page } = await organizerPage(browser, organizer.sessionToken);
    await page.goto(`/organizer/class-proposals/${proposal.id}`);
    await page.getByRole("button", { name: "不修改，直接重新邀請" }).click();
    await expect(page.getByText("等待老師確認").first()).toBeVisible();
    await context.close();

    const after = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, version: true, transitionSeq: true, declineReason: true },
    });
    expect(after).toEqual({
      status: "pending_confirmation",
      version: before.version,
      transitionSeq: before.transitionSeq + 1,
      declineReason: null,
    });
    expect(await confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposal.id, before.version)).toEqual({
      ok: true,
    });
  });
});
