import { expect, test } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { selfConfirmProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/respond-core";
import { reviseProposalCore } from "../../src/domain/organizer-class-proposal/__internal__/revise-core";
import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 08：approved 老師兼團主，在團主表單明確確認由自己授課。
const testEmailDomain = "organizer-self-teaching-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.organizerClassProposal.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
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

function taipeiLocal(daysFromNow: number, time: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + daysFromNow * DAY));
  return `${parts}T${time}`;
}

// 同一個帳號：approved 老師資料＋團主資料＋一個聯絡資料完整的團體。
async function setupTeacherOrganizer(id: string, status: "approved" | "suspended" = "approved") {
  const email = `dual-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  const teacher = await createTeacherProfileWithSession({ email, displayName: `Dual Teacher ${id}`, status });
  const user = await prisma.teacherProfile.findUniqueOrThrow({
    where: { id: teacher.teacherProfileId },
    select: { userId: true },
  });
  const organization = await prisma.organization.create({
    data: {
      name: `Dual Org ${id}`,
      type: "company",
      contactName: "聯絡人",
      contactEmail: `dual-contact-${id}@example.com`,
      contactPhone: "0900000000",
    },
  });
  const organizerProfile = await prisma.organizerProfile.create({
    data: { userId: user.userId, displayName: `Dual Organizer ${id}` },
  });
  await prisma.organization.update({
    where: { id: organization.id },
    data: { ownerOrganizerProfileId: organizerProfile.id },
  });
  return {
    sessionToken: teacher.sessionToken,
    userId: user.userId,
    teacherProfileId: teacher.teacherProfileId,
    organizerProfileId: organizerProfile.id,
    organizationId: organization.id,
  };
}

async function createDraft(
  dual: { organizerProfileId: string; organizationId: string },
  teacherProfileId: string,
  title: string,
  times: { startAt: Date; endAt: Date },
) {
  return prisma.organizerClassProposal.create({
    data: {
      organizerProfileId: dual.organizerProfileId,
      organizationId: dual.organizationId,
      teacherProfileId,
      title,
      serviceTypes: ["伸展與身體保養"],
      ...times,
      location: "台北市信義區",
      capacity: 12,
    },
  });
}

test.describe("organizer self teaching smoke", () => {
  test("a teacher-organizer picks themself and confirms teaching in one explicit step, without inviting themself", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "ui");
    const dual = await setupTeacherOrganizer(id);
    await addAuthSessionCookie(context, dual.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    await page.getByPlaceholder("輸入老師的顯示名稱").fill(`Dual Teacher ${id}`);
    await page.getByRole("button", { name: "搜尋老師" }).click();
    const results = page.getByRole("list", { name: "可邀請的老師" });
    await expect(results.getByText("你自己")).toBeVisible();
    await results.getByRole("button", { name: new RegExp(`Dual Teacher ${id}`) }).click();

    await page.getByLabel("課程名稱").fill(`本人授課 ${id}`);
    await page.getByText("伸展與身體保養", { exact: true }).click();
    await page.getByLabel("開始時間").fill(taipeiLocal(25, "10:00"));
    await page.getByLabel("結束時間").fill(taipeiLocal(25, "11:00"));
    await page.getByLabel("地點").fill("台北市大安區");
    await page.getByLabel("名額").fill("12");

    // 主按鈕改成本人授課；沒有寄邀請給自己的按鈕。
    await expect(page.getByRole("button", { name: "送出邀請" })).toHaveCount(0);
    await page.getByRole("button", { name: "由我授課並確認" }).first().click();
    await expect(page.getByText("確認由你自己授課").first()).toBeVisible();
    await page.getByRole("button", { name: "確認由我授課" }).first().click();

    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\?flash=self_confirmed$/);
    await expect(page.getByText("已確認由你自己授課，這個時段已保留給這堂課。")).toBeVisible();

    const proposal = await prisma.organizerClassProposal.findFirstOrThrow({
      where: { organizerProfileId: dual.organizerProfileId },
      select: { status: true, confirmedByUserId: true, confirmedVersion: true, submittedAt: true, teacherProfileId: true },
    });
    expect(proposal.status).toBe("confirmed");
    expect(proposal.confirmedByUserId).toBe(dual.userId);
    expect(proposal.teacherProfileId).toBe(dual.teacherProfileId);
    expect(proposal.confirmedVersion).not.toBeNull();
    expect(proposal.submittedAt).not.toBeNull();
  });

  test("self-confirm keeps every guard: approval, schedule conflicts, latest version, only one's own teacher profile, and no self-invitation", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "guards");
    const dual = await setupTeacherOrganizer(id);

    // 撞到自己既有的課。
    const busy = slot(26);
    await prisma.classSession.create({
      data: {
        teacherProfileId: dual.teacherProfileId,
        origin: "teacher_initiated",
        title: `自己既有的課 ${id}`,
        serviceType: "伸展與身體保養",
        serviceTypes: ["伸展與身體保養"],
        ...busy,
        location: "台北",
        capacity: 10,
      },
    });
    const clashing = await createDraft(dual, dual.teacherProfileId, `撞課 ${id}`, busy);
    expect(await selfConfirmProposalCore(dual.organizerProfileId, dual.userId, clashing.id, 1)).toEqual({
      ok: false,
      code: "schedule_conflict",
    });

    // 舊版本。
    const draft = await createDraft(dual, dual.teacherProfileId, `舊版本 ${id}`, slot(26, 3));
    expect(await selfConfirmProposalCore(dual.organizerProfileId, dual.userId, draft.id, 99)).toEqual({
      ok: false,
      code: "proposal_version_stale",
    });

    // 選的是別的老師：不能用本人授課。
    const otherEmail = `other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createTeacherProfileWithSession({ email: otherEmail, displayName: `Other ${id}`, status: "approved" });
    const forOther = await createDraft(dual, other.teacherProfileId, `別的老師 ${id}`, slot(26, 6));
    expect(await selfConfirmProposalCore(dual.organizerProfileId, dual.userId, forOther.id, 1)).toEqual({
      ok: false,
      code: "not_self_teacher",
    });

    // 不會寄邀請給自己：選自己時表單只提供「由我授課並確認」，沒有「送出邀請」。
    // （伺服器的 submitOwnProposal 另外拒絕寄給自己，UI 沒有入口能觸發，以程式為證據。）
    const selfInvite = await createDraft(dual, dual.teacherProfileId, `寄給自己 ${id}`, slot(26, 9));
    const context = await browser.newContext();
    await addAuthSessionCookie(context, dual.sessionToken);
    const page = await context.newPage();
    await page.goto(`/organizer/class-proposals/${selfInvite.id}/edit`);
    await expect(page.getByRole("button", { name: "由我授課並確認" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "送出邀請" })).toHaveCount(0);
    await context.close();

    // 本人授課成功後，重試得到「狀態不符」，不會重複確認。
    expect(await selfConfirmProposalCore(dual.organizerProfileId, dual.userId, draft.id, 1)).toMatchObject({ ok: true });
    expect(await selfConfirmProposalCore(dual.organizerProfileId, dual.userId, draft.id, 1)).toEqual({
      ok: false,
      code: "proposal_invalid_status",
    });

    // 本人授課後修改（票 07 規則）：回到草稿並釋放時段。
    const revised = await reviseProposalCore(dual.organizerProfileId, draft.id, 1, {
      organizationId: dual.organizationId,
      teacherProfileId: dual.teacherProfileId,
      title: `舊版本 ${id} 改`,
      description: null,
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
      ...slot(26, 3),
      location: "台北市信義區",
      capacity: 12,
      isPublic: false,
    });
    expect(revised).toMatchObject({ ok: true, version: 2, status: "draft" });
    const freed = await createClassSessionForTeacher(dual.teacherProfileId, {
      title: `釋放後 ${id}`,
      description: null,
      serviceType: "伸展與身體保養",
      ...slot(26, 3),
      location: "台北",
      capacity: 10,
      isPublic: false,
    });
    expect(freed.ok).toBe(true);
  });

  test("a teacher-organizer who is not approved cannot self-teach and does not appear in the teacher lookup", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "suspended");
    const dual = await setupTeacherOrganizer(id, "suspended");
    const draft = await createDraft(dual, dual.teacherProfileId, `未審核 ${id}`, slot(27));
    expect(await selfConfirmProposalCore(dual.organizerProfileId, dual.userId, draft.id, 1)).toEqual({
      ok: false,
      code: "teacher_not_approved",
    });

    await addAuthSessionCookie(context, dual.sessionToken);
    await page.goto("/organizer/class-proposals/new");
    await page.getByPlaceholder("輸入老師的顯示名稱").fill(`Dual Teacher ${id}`);
    await page.getByRole("button", { name: "搜尋老師" }).click();
    await expect(page.getByText("找不到符合的老師，可以換個名稱再試。")).toBeVisible();
  });
  test("switching a pending invitation to yourself returns it to draft, hides it from the old teacher, and lets you self-confirm", async ({
    browser,
  }, testInfo) => {
    const id = runId(testInfo, "pending-to-self");
    const dual = await setupTeacherOrganizer(id);
    const otherEmail = `other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createTeacherProfileWithSession({ email: otherEmail, displayName: `Other ${id}`, status: "approved" });
    const proposal = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: dual.organizerProfileId,
        organizationId: dual.organizationId,
        teacherProfileId: other.teacherProfileId,
        title: `改由我授課 ${id}`,
        serviceTypes: ["伸展與身體保養"],
        ...slot(28),
        location: "台北市信義區",
        capacity: 12,
        status: "pending_confirmation",
        submittedAt: new Date(),
      },
    });

    const context = await browser.newContext();
    await addAuthSessionCookie(context, dual.sessionToken);
    const page = await context.newPage();
    await page.goto(`/organizer/class-proposals/${proposal.id}/edit`);
    await page.getByRole("button", { name: "更換老師" }).click();
    await page.getByPlaceholder("輸入老師的顯示名稱").fill(`Dual Teacher ${id}`);
    await page.getByRole("button", { name: "搜尋老師" }).click();
    await page.getByRole("list", { name: "可邀請的老師" }).getByRole("button", { name: new RegExp(`Dual Teacher ${id}`) }).click();
    await page.getByRole("button", { name: "儲存並改由我授課" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();

    const reverted = await prisma.organizerClassProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, teacherProfileId: true },
    });
    expect(reverted).toEqual({ status: "draft", teacherProfileId: dual.teacherProfileId });

    // 原本的受邀老師看不到了；自己的老師頁也沒有「待你確認」（草稿不給老師看）。
    const otherContext = await browser.newContext();
    await addAuthSessionCookie(otherContext, other.sessionToken);
    const otherPage = await otherContext.newPage();
    expect((await otherPage.goto(`/teacher/class-proposals/${proposal.id}`))?.status()).toBe(404);
    await otherContext.close();
    const selfTeacherPage = await context.newPage();
    expect((await selfTeacherPage.goto(`/teacher/class-proposals/${proposal.id}`))?.status()).toBe(404);

    // 接著直接本人授課。
    await page.getByRole("button", { name: "由我授課並確認" }).first().click();
    await page.getByRole("button", { name: "確認由我授課" }).first().click();
    await expect(page.getByText("已確認由你自己授課，這個時段已保留給這堂課。")).toBeVisible();
    await context.close();
  });

  test("a schedule conflict on the first self-confirm from the new page keeps the draft and explains how to fix it", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "conflict-ui");
    const dual = await setupTeacherOrganizer(id);
    const start = taipeiLocal(29, "15:00");
    const end = taipeiLocal(29, "16:00");
    await prisma.classSession.create({
      data: {
        teacherProfileId: dual.teacherProfileId,
        origin: "teacher_initiated",
        title: `同時段的課 ${id}`,
        serviceType: "伸展與身體保養",
        serviceTypes: ["伸展與身體保養"],
        startAt: new Date(`${start}:00+08:00`),
        endAt: new Date(`${end}:00+08:00`),
        location: "台北",
        capacity: 10,
      },
    });
    await addAuthSessionCookie(context, dual.sessionToken);

    await page.goto("/organizer/class-proposals/new");
    await page.getByPlaceholder("輸入老師的顯示名稱").fill(`Dual Teacher ${id}`);
    await page.getByRole("button", { name: "搜尋老師" }).click();
    await page.getByRole("list", { name: "可邀請的老師" }).getByRole("button", { name: new RegExp(`Dual Teacher ${id}`) }).click();
    await page.getByLabel("課程名稱").fill(`撞課的本人授課 ${id}`);
    await page.getByText("伸展與身體保養", { exact: true }).click();
    await page.getByLabel("開始時間").fill(start);
    await page.getByLabel("結束時間").fill(end);
    await page.getByLabel("地點").fill("台北市大安區");
    await page.getByLabel("名額").fill("12");
    await page.getByRole("button", { name: "由我授課並確認" }).first().click();
    await page.getByRole("button", { name: "確認由我授課" }).first().click();

    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);
    await expect(page.getByText(/這個時段你已經有其他課程或已確認的合作，請調整時間/).first()).toBeVisible();
    await expect(page.getByLabel("課程名稱")).toHaveValue(`撞課的本人授課 ${id}`);
    const drafts = await prisma.organizerClassProposal.findMany({
      where: { organizerProfileId: dual.organizerProfileId },
      select: { status: true },
    });
    expect(drafts).toEqual([{ status: "draft" }]);
  });
});
