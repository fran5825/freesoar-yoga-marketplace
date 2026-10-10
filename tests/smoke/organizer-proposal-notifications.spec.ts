import { expect, test } from "@playwright/test";

import { declineProposalCore, confirmProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/respond-core";
import { reviseProposalCore, withdrawProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/revise-core";
import { notifyProposalTransition } from "../../src/domain/organizer-class-proposal/notifications";
import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 12（spec 13.7）：合作邀請的站內通知與總覽待辦。
// - UI 旅程：送出 → 老師在總覽／通知直達單筆 → 確認 → 團主收到通知並在總覽看到可以開放報名。
// - 收件人依修改前後決定（換老師、等待確認中的修改、撤回、本人授課），同一步重試不重複、不同步驟各自發送。
const testEmailDomain = "proposal-notifications-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
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

async function createTeacher(id: string, label: string) {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({ email, displayName: `老師${label} ${id}`, status: "approved" });
  const user = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId }, select: { userId: true } });
  return { ...teacher, userId: user.userId };
}

async function setup(id: string) {
  const organizerEmail = `organizer-${id}@${testEmailDomain}`;
  createdEmails.push(organizerEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `團主 ${id}`,
    organizationName: `Notify Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
  const organizerUser = await prisma.organizerProfile.findUniqueOrThrow({
    where: { id: organizer.organizerProfileId },
    select: { userId: true },
  });
  return { organizer: { ...organizer, userId: organizerUser.userId }, teacherA: await createTeacher(id, "A"), teacherB: await createTeacher(id, "B") };
}

async function createProposal(
  organizer: { organizerProfileId: string; organizationId: string },
  teacherProfileId: string | null,
  title: string,
  times: { startAt: Date; endAt: Date },
  status: "draft" | "pending_confirmation" = "pending_confirmation",
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
      ...(status === "draft" ? { transitionSeq: 1 } : { submittedAt: new Date(), transitionSeq: 2 }),
    },
  });
}

function revisionOf(
  proposal: Awaited<ReturnType<typeof createProposal>>,
  changes: Partial<{ teacherProfileId: string | null; location: string; startAt: Date; endAt: Date }> = {},
) {
  return {
    title: proposal.title,
    description: proposal.description,
    serviceType: proposal.serviceType,
    serviceTypes: proposal.serviceTypes,
    startAt: changes.startAt ?? proposal.startAt,
    endAt: changes.endAt ?? proposal.endAt,
    location: changes.location ?? proposal.location,
    capacity: proposal.capacity,
    isPublic: proposal.isPublic,
    organizationId: proposal.organizationId,
    teacherProfileId: changes.teacherProfileId === undefined ? proposal.teacherProfileId : changes.teacherProfileId,
  };
}

async function notificationsFor(userId: string, proposalId: string) {
  return prisma.notification.findMany({
    where: { userId, eventKey: { startsWith: `class-proposal:${proposalId}:` } },
    orderBy: { createdAt: "asc" },
    select: { type: true, targetType: true, targetId: true, body: true, status: true },
  });
}

test.describe("organizer proposal notifications", () => {
  test("submit → teacher sees it on the dashboard and in notifications with a direct link → confirm → organizer is notified and can open", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "journey");
    const { organizer, teacherA } = await setup(id);
    const proposal = await createProposal(organizer, teacherA.teacherProfileId, `通知旅程 ${id}`, slot(40), "draft");

    const organizerContext = await browser.newContext();
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const organizerPage = await organizerContext.newPage();
    await organizerPage.goto(`/organizer/class-proposals/${proposal.id}/edit`);
    await organizerPage.getByRole("button", { name: "送出邀請" }).first().click();
    await organizerPage.getByRole("button", { name: "確認送出邀請" }).first().click();
    await expect(organizerPage).toHaveURL(new RegExp(`/organizer/class-proposals/${proposal.id}\\?flash=submitted$`));
    await expect(organizerPage.getByText("邀請已送出，老師確認後你就能開放報名。")).toBeVisible();

    expect(await notificationsFor(teacherA.userId, proposal.id)).toEqual([
      expect.objectContaining({ type: "class_proposal_invited", targetType: "teacher_class_proposal", targetId: proposal.id, status: "sent" }),
    ]);
    // 團主總覽：等待老師確認放在「等待對方回覆」，不算待你處理。
    await organizerPage.goto("/organizer/dashboard");
    await expect(organizerPage.getByRole("region", { name: "等待對方回覆" }).getByRole("link", { name: new RegExp(`通知旅程 ${id}`) })).toContainText("等待老師確認");

    const teacherContext = await browser.newContext();
    await addAuthSessionCookie(teacherContext, teacherA.sessionToken);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/teacher/dashboard");
    const todo = teacherPage.getByRole("region", { name: "待你處理" }).getByRole("link", { name: new RegExp(`通知旅程 ${id}`) });
    await expect(todo).toContainText("合作邀請待你確認");
    await expect(todo).toHaveAttribute("href", `/teacher/class-proposals/${proposal.id}`);
    await teacherPage.goto("/teacher/notifications");
    const notice = teacherPage.locator("article").filter({ hasText: "你收到一份合作邀請" }).filter({ hasText: `通知旅程 ${id}` });
    await notice.getByRole("link", { name: "查看這份合作邀請 →" }).click();
    await expect(teacherPage).toHaveURL(new RegExp(`/teacher/class-proposals/${proposal.id}$`));
    await teacherPage.getByRole("button", { name: "確認授課" }).click();
    await teacherPage.getByRole("button", { name: "確認授課" }).click();
    await expect(teacherPage.getByText(/你已確認授課/)).toBeVisible();
    await teacherPage.goto("/teacher/dashboard");
    await expect(teacherPage.getByRole("region", { name: "等待對方回覆" }).getByRole("link", { name: new RegExp(`通知旅程 ${id}`) })).toContainText("等待團主開放報名");
    await teacherContext.close();

    expect(await notificationsFor(organizer.userId, proposal.id)).toEqual([
      expect.objectContaining({ type: "class_proposal_confirmed", targetType: "organizer_class_proposal", targetId: proposal.id }),
    ]);
    await organizerPage.goto("/organizer/dashboard");
    const action = organizerPage.getByRole("region", { name: "待你處理" }).getByRole("link", { name: new RegExp(`通知旅程 ${id}`) });
    await expect(action).toContainText("老師已確認，可以開放報名");
    await organizerPage.goto("/organizer/notifications");
    await organizerPage.locator("article").filter({ hasText: "老師已確認授課" }).filter({ hasText: `通知旅程 ${id}` }).getByRole("link", { name: "查看這份合作邀請 →" }).click();
    await expect(organizerPage).toHaveURL(new RegExp(`/organizer/class-proposals/${proposal.id}$`));
    await organizerContext.close();
  });

  test("retrying the same transition does not duplicate; submit → decline → resubmit → decline each notify once", async ({}, testInfo) => {
    const id = runId(testInfo, "retry");
    const { organizer, teacherA } = await setup(id);
    const proposal = await createProposal(organizer, teacherA.teacherProfileId, `重試 ${id}`, slot(41));
    const submitted = (seq: number) => ({
      proposalId: proposal.id,
      transitionSeq: seq,
      before: { status: "draft" as const, teacherProfileId: teacherA.teacherProfileId, title: proposal.title },
      after: { status: "pending_confirmation" as const, teacherProfileId: teacherA.teacherProfileId, title: proposal.title },
    });

    // 送出（seq 2）重試兩次只有一則。
    await notifyProposalTransition("submitted", submitted(2));
    await notifyProposalTransition("submitted", submitted(2));
    const first = await declineProposalCore(teacherA.teacherProfileId, proposal.id, 1, "時間不行");
    if (!first.ok) throw new Error("decline failed");
    await notifyProposalTransition("declined", first.event, { reason: "時間不行" });
    await notifyProposalTransition("declined", first.event, { reason: "時間不行" });
    // 不修改直接重送（version 不變、transitionSeq 前進）。
    await prisma.organizerClassProposal.update({ where: { id: proposal.id }, data: { status: "pending_confirmation", transitionSeq: { increment: 1 } } });
    await notifyProposalTransition("submitted", submitted(first.event.transitionSeq + 1));
    const second = await declineProposalCore(teacherA.teacherProfileId, proposal.id, 1, "還是不行");
    if (!second.ok) throw new Error("second decline failed");
    await notifyProposalTransition("declined", second.event, { reason: "還是不行" });

    expect((await notificationsFor(teacherA.userId, proposal.id)).map((n) => n.type)).toEqual([
      "class_proposal_invited",
      "class_proposal_invited",
    ]);
    const organizerNotes = await notificationsFor(organizer.userId, proposal.id);
    expect(organizerNotes.map((n) => n.type)).toEqual(["class_proposal_declined", "class_proposal_declined"]);
    expect(organizerNotes[0].body).toContain("時間不行");
    expect(organizerNotes[1].body).toContain("還是不行");

    // 通知失敗（例如邀請已不存在）不會拋出例外。
    await expect(
      notifyProposalTransition("submitted", { ...submitted(99), proposalId: `missing-${id}` }),
    ).resolves.toBeUndefined();
  });

  test("revising a pending invitation notifies the same teacher each time; swapping teachers withdraws from A and invites B", async ({}, testInfo) => {
    const id = runId(testInfo, "revise");
    const { organizer, teacherA, teacherB } = await setup(id);
    const times = slot(42);

    // 同一位老師、等待確認中：改時間、再改地點 → 兩則「內容已更新」。
    const sameTeacher = await createProposal(organizer, teacherA.teacherProfileId, `改內容 ${id}`, times);
    const moved = slot(42, 2);
    const r1 = await reviseProposalCore(organizer.organizerProfileId, sameTeacher.id, 1, revisionOf(sameTeacher, moved));
    if (!r1.ok) throw new Error("revise 1 failed");
    await notifyProposalTransition("revised", r1.event);
    const r2 = await reviseProposalCore(organizer.organizerProfileId, sameTeacher.id, 2, revisionOf(sameTeacher, { ...moved, location: "新北市板橋區" }));
    if (!r2.ok) throw new Error("revise 2 failed");
    await notifyProposalTransition("revised", r2.event);
    await notifyProposalTransition("revised", r2.event);
    expect((await notificationsFor(teacherA.userId, sameTeacher.id)).map((n) => n.type)).toEqual([
      "class_proposal_revised",
      "class_proposal_revised",
    ]);

    // 等待確認中從 A 換成 B：A 收到已取消（沒有單筆連結，A 已讀不到），B 收到邀請。
    const pendingSwap = await createProposal(organizer, teacherA.teacherProfileId, `換老師 ${id}`, slot(43));
    const swap = await reviseProposalCore(organizer.organizerProfileId, pendingSwap.id, 1, revisionOf(pendingSwap, { teacherProfileId: teacherB.teacherProfileId }));
    if (!swap.ok) throw new Error("swap failed");
    await notifyProposalTransition("revised", swap.event);
    expect(await notificationsFor(teacherA.userId, pendingSwap.id)).toEqual([
      expect.objectContaining({ type: "class_proposal_withdrawn", targetType: null, targetId: null }),
    ]);
    expect(await notificationsFor(teacherB.userId, pendingSwap.id)).toEqual([
      expect.objectContaining({ type: "class_proposal_invited", targetType: "teacher_class_proposal", targetId: pendingSwap.id }),
    ]);

    // A 已確認後改成 B：A 收到已取消，B 要等團主重新送出才收到邀請。
    const confirmedSwap = await createProposal(organizer, teacherA.teacherProfileId, `確認後換老師 ${id}`, slot(44));
    expect(await confirmProposalCore(teacherA.teacherProfileId, teacherA.userId, confirmedSwap.id, 1)).toMatchObject({ ok: true });
    // 同時改課名：原老師的「已取消」只出現修改前的課名，看不到新草稿的內容。
    const afterConfirm = await reviseProposalCore(organizer.organizerProfileId, confirmedSwap.id, 1, {
      ...revisionOf(confirmedSwap, { teacherProfileId: teacherB.teacherProfileId }),
      title: `新草稿課名 ${id}`,
    });
    if (!afterConfirm.ok) throw new Error("confirmed swap failed");
    expect(afterConfirm.status).toBe("draft");
    await notifyProposalTransition("revised", afterConfirm.event);
    const aNotes = await notificationsFor(teacherA.userId, confirmedSwap.id);
    expect(aNotes.map((n) => n.type)).toEqual(["class_proposal_withdrawn"]);
    expect(aNotes[0].body).toContain(`確認後換老師 ${id}`);
    expect(aNotes[0].body).not.toContain(`新草稿課名 ${id}`);
    expect(await notificationsFor(teacherB.userId, confirmedSwap.id)).toEqual([]);
  });

  test("withdrawing notifies a teacher who saw the invitation; self-teaching never notifies yourself; others see nothing", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "withdraw");
    const { organizer, teacherA, teacherB } = await setup(id);

    const pending = await createProposal(organizer, teacherA.teacherProfileId, `撤回通知 ${id}`, slot(45));
    const withdrawn = await withdrawProposalCore(organizer.organizerProfileId, pending.id, 1, "場地取消");
    if (!withdrawn.ok) throw new Error("withdraw failed");
    await notifyProposalTransition("withdrawn", withdrawn.event, { reason: "場地取消" });
    const notes = await notificationsFor(teacherA.userId, pending.id);
    expect(notes).toEqual([expect.objectContaining({ type: "class_proposal_withdrawn", targetType: "teacher_class_proposal" })]);
    expect(notes[0].body).toContain("場地取消");

    // 草稿撤回（老師從沒看過）：不通知。
    const draft = await createProposal(organizer, teacherA.teacherProfileId, `草稿撤回 ${id}`, slot(45, 2), "draft");
    const draftWithdrawn = await withdrawProposalCore(organizer.organizerProfileId, draft.id, 1, "");
    if (!draftWithdrawn.ok) throw new Error("draft withdraw failed");
    await notifyProposalTransition("withdrawn", draftWithdrawn.event);
    expect(await notificationsFor(teacherA.userId, draft.id)).toEqual([]);

    // 本人授課：老師資料屬於團主本人，送出／撤回都不寄給自己。
    const selfTeacher = await prisma.teacherProfile.create({
      data: {
        userId: organizer.userId,
        displayName: `團主兼老師 ${id}`,
        bio: "bio",
        teachingStyle: "style",
        experienceYears: 3,
        specialties: ["Hatha Yoga"],
        serviceAreas: ["Taipei"],
        teachingFormats: ["Group class"],
        status: "approved",
      },
    });
    const selfProposal = await createProposal(organizer, selfTeacher.id, `本人授課 ${id}`, slot(46));
    await notifyProposalTransition("submitted", {
      proposalId: selfProposal.id,
      transitionSeq: 2,
      before: { status: "draft", teacherProfileId: selfTeacher.id, title: selfProposal.title },
      after: { status: "pending_confirmation", teacherProfileId: selfTeacher.id, title: selfProposal.title },
    });
    const selfWithdrawn = await withdrawProposalCore(organizer.organizerProfileId, selfProposal.id, 1, "");
    if (!selfWithdrawn.ok) throw new Error("self withdraw failed");
    await notifyProposalTransition("withdrawn", selfWithdrawn.event);
    expect(await notificationsFor(organizer.userId, selfProposal.id)).toEqual([]);

    // 其他老師：沒有收到任何通知，打開單筆網址也是 not-found。
    expect(await prisma.notification.count({ where: { userId: teacherB.userId, eventKey: { startsWith: "class-proposal:" } } })).toBe(0);
    const otherContext = await browser.newContext();
    await addAuthSessionCookie(otherContext, teacherB.sessionToken);
    const otherPage = await otherContext.newPage();
    expect((await otherPage.goto(`/teacher/class-proposals/${pending.id}`))?.status()).toBe(404);
    await otherContext.close();
  });

  test("a pending invitation whose start time has passed asks the organizer to change the time, and the teacher sees it as waiting", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "expired");
    const { organizer, teacherA } = await setup(id);
    const past = { startAt: new Date(Date.now() - 2 * HOUR), endAt: new Date(Date.now() - HOUR) };
    await createProposal(organizer, teacherA.teacherProfileId, `時間已過 ${id}`, past);
    // 已確認但時間已過：不能開放報名，老師看到的是等待團主修改，不是等待開放。
    const confirmedPast = await createProposal(organizer, teacherA.teacherProfileId, `確認後過期 ${id}`, {
      startAt: new Date(Date.now() - 4 * HOUR),
      endAt: new Date(Date.now() - 3 * HOUR),
    });
    await prisma.organizerClassProposal.update({
      where: { id: confirmedPast.id },
      data: { status: "confirmed", confirmedVersion: 1, confirmedAt: new Date(), confirmedByUserId: teacherA.userId },
    });

    const organizerContext = await browser.newContext();
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const organizerPage = await organizerContext.newPage();
    await organizerPage.goto("/organizer/dashboard");
    await expect(organizerPage.getByRole("region", { name: "待你處理" }).getByRole("link", { name: new RegExp(`時間已過 ${id}`) })).toContainText("開始時間已過，請修改時間");
    await organizerContext.close();

    const teacherContext = await browser.newContext();
    await addAuthSessionCookie(teacherContext, teacherA.sessionToken);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/teacher/dashboard");
    await expect(teacherPage.getByRole("region", { name: "等待對方回覆" }).getByRole("link", { name: new RegExp(`時間已過 ${id}`) })).toContainText("合作邀請的時間已過，等待團主修改");
    const confirmedPastItem = teacherPage.getByRole("region", { name: "等待對方回覆" }).getByRole("link", { name: new RegExp(`確認後過期 ${id}`) });
    await expect(confirmedPastItem).toContainText("合作邀請的時間已過，等待團主修改");
    await expect(confirmedPastItem).not.toContainText("等待團主開放報名");
    await teacherContext.close();

    // 通知連到的老師端課程頁：未登入時登入後回到同一堂課。
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto("/teacher/classes/some-class-id");
    await expect(anonymousPage).toHaveURL(`/sign-in?callbackUrl=${encodeURIComponent("/teacher/classes/some-class-id")}`);
    await anonymous.close();

    // 未確認的邀請不會出現在老師的課程列表。
    expect(await prisma.classSession.count({ where: { teacherProfileId: teacherA.teacherProfileId } })).toBe(0);
  });
});
