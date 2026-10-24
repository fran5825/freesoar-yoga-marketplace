import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { NotificationType } from "@prisma/client";

import { cancelEnrollmentForAdminCore } from "../../src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core";
import { formatTaipeiShortDatetime } from "../../src/domain/class-session/timezone";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { withdrawSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/withdraw-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-first-run 票 04：有人報名「報名送出即成立」的單堂課、學員自己取消時，老師收到站內通知。
// 學員收到的通知與連結完全不變；同一系列同一天合併後（ADR 0008）老師的那則連到老師系列頁。
// 票 05：整期報名、退出整期，老師各收到一則，直達老師系列頁（target teacher_class_series）。
const fixtures = createTermFixtures("teacher-enrollment-notifications-smoke.local");
const { runId, seedTeacher, seedMember, seedContinuous, seedTerm } = fixtures;

const ENROLLMENT_TYPES: NotificationType[] = ["enrollment_confirmed", "enrollment_pending_review", "enrollment_cancelled"];

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

// 不屬於任何系列、已開放報名的單堂課（老師自己開的）。
async function seedSingleClass(teacherProfileId: string, title: string, options: { requiresApproval?: boolean } = {}) {
  const startAt = new Date(Date.now() + 20 * 86_400_000);

  return prisma.classSession.create({
    data: {
      teacherProfileId,
      origin: "teacher_initiated",
      title,
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt,
      endAt: new Date(startAt.getTime() + 3_600_000),
      location: "台北市單堂教室",
      capacity: 5,
      isPublic: true,
      requiresApproval: options.requiresApproval ?? false,
      status: "open_for_enrollment",
    },
  });
}

async function openNotifications(context: BrowserContext, page: Page, sessionToken: string, path = "/notifications") {
  await context.clearCookies();
  await addAuthSessionCookie(context, sessionToken);
  await page.goto(path);
}

function card(page: Page, title: string, text: string) {
  return page.getByRole("article").filter({ hasText: title }).filter({ hasText: text });
}

test("single class: the teacher is told about a new enrollment and a member's own cancellation; the member's notices stay the same", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "single");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const classTitle = `單堂通知 ${id}`;
  const session = await seedSingleClass(teacher.teacherProfileId, classTitle);

  const enrolled = await createEnrollmentForUser(member.id, session.id, { notes: null });
  if (!enrolled.ok) throw new Error("fixture");

  await openNotifications(context, page, teacher.sessionToken, "/teacher/notifications");
  const teacherCard = card(page, classTitle, "有新的報名");
  await expect(teacherCard).toHaveCount(1);
  await expect(teacherCard).toContainText(`「${classTitle}」有新的報名。`);
  await expect(teacherCard.getByRole("link", { name: /查看這堂課/ })).toHaveAttribute("href", `/teacher/classes/${session.id}`);

  // 學員本人的通知照舊：文案與「前往我的報名」都不變。
  await openNotifications(context, page, member.sessionToken);
  const memberCard = card(page, classTitle, "報名成功");
  await expect(memberCard).toContainText(`你已經成功報名「${classTitle}」。`);
  await expect(memberCard.getByRole("link", { name: /前往我的報名/ })).toHaveAttribute("href", "/member/enrollments");

  // 學員自己取消：老師收到站內通知，連到那堂課。
  await page.goto(`/classes/${session.id}`);
  await page.getByText("取消報名…").click();
  await page.getByLabel("我確認要取消這則報名。").check();
  await page.getByRole("button", { name: "確認取消" }).click();
  await expect(page.getByText("報名已取消。")).toBeVisible();

  await page.goto("/notifications");
  await expect(card(page, classTitle, "報名已取消")).toContainText(`「${classTitle}」的報名已經取消。`);

  await openNotifications(context, page, teacher.sessionToken, "/teacher/notifications");
  const cancelCard = card(page, classTitle, "有學員取消報名");
  await expect(cancelCard).toHaveCount(1);
  await expect(cancelCard.getByRole("link", { name: /查看這堂課/ })).toHaveAttribute("href", `/teacher/classes/${session.id}`);

  // 老師的通知只發站內，不寄 email。
  expect(await prisma.notification.count({ where: { userId: teacher.userId, channel: "email", type: { in: ["enrollment_confirmed", "enrollment_cancelled"] } } })).toBe(0);
});

test("the teacher gets no extra notice for classes that need confirmation, or when an admin cancels", async ({}, testInfo) => {
  const id = runId(testInfo, "quiet");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const reviewed = await seedSingleClass(teacher.teacherProfileId, `需確認 ${id}`, { requiresApproval: true });
  const direct = await seedSingleClass(teacher.teacherProfileId, `管理員取消 ${id}`);

  const pending = await createEnrollmentForUser(member.id, reviewed.id, { notes: null });
  const confirmed = await createEnrollmentForUser(member.id, direct.id, { notes: null });
  if (!pending.ok || !confirmed.ok) throw new Error("fixture");
  expect((await cancelEnrollmentForAdminCore(confirmed.enrollmentId)).ok).toBe(true);

  // 只看報名相關類型：平行測試公開需求時，所有已通過的老師都會收到 demand_request_available（票 06）。
  const teacherNotices = await prisma.notification.findMany({ where: { userId: teacher.userId, channel: "in_app", type: { in: ENROLLMENT_TYPES } } });
  // 需確認的課只有既有的「有新的報名待確認」；管理員取消不通知老師；報名即成立的那一堂有一則「有新的報名」。
  expect(teacherNotices.map((n) => n.type).sort()).toEqual(["enrollment_confirmed", "enrollment_pending_review"]);
  expect(teacherNotices.find((n) => n.type === "enrollment_confirmed")?.targetId).toBe(direct.id);
});

test("same series, same day: the teacher's notices fold into one that opens the teacher series page; a lone one opens the class", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "fold");
  const teacher = await seedTeacher(id);
  const memberA = await seedMember(id, "a");
  const memberB = await seedMember(id, "b");
  const folded = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `合併系列 ${id}` });
  const lone = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `單則系列 ${id}`, dayOfWeek: 5 });

  for (const enrollment of [
    await createEnrollmentForUser(memberA.id, folded.sessions[0].id, { notes: null }),
    await createEnrollmentForUser(memberB.id, folded.sessions[1].id, { notes: null }),
    await createEnrollmentForUser(memberA.id, lone.sessions[1].id, { notes: null }),
  ]) {
    if (!enrollment.ok) throw new Error("fixture");
  }

  await openNotifications(context, page, teacher.sessionToken, "/teacher/notifications");
  const foldedCard = card(page, `合併系列 ${id}`, "有新的報名");
  await expect(foldedCard).toHaveCount(1);
  await expect(foldedCard).toContainText("同一系列共 2 則");
  await expect(foldedCard.getByRole("link", { name: /前往系列頁/ })).toHaveAttribute("href", `/teacher/classes/series/${folded.series.id}`);

  const loneCard = card(page, `單則系列 ${id}`, "有新的報名");
  await expect(loneCard).toHaveCount(1);
  await expect(loneCard.getByRole("link", { name: /查看這堂課/ })).toHaveAttribute("href", `/teacher/classes/${lone.sessions[1].id}`);
});

test("a teacher who also enrolls as a member keeps the member destinations", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "dual");
  const hostTeacher = await seedTeacher(`${id}-host`);
  const dualTeacher = await seedTeacher(`${id}-dual`);
  const series = await seedContinuous(hostTeacher.teacherProfileId, { count: 2, title: `雙身分系列 ${id}` });
  const single = await seedSingleClass(hostTeacher.teacherProfileId, `雙身分單堂 ${id}`);

  for (const enrollment of [
    await createEnrollmentForUser(dualTeacher.userId, series.sessions[0].id, { notes: null }),
    await createEnrollmentForUser(dualTeacher.userId, series.sessions[1].id, { notes: null }),
    await createEnrollmentForUser(dualTeacher.userId, single.id, { notes: null }),
  ]) {
    if (!enrollment.ok) throw new Error("fixture");
  }

  for (const path of ["/notifications", "/teacher/notifications"]) {
    await openNotifications(context, page, dualTeacher.sessionToken, path);
    const seriesCard = card(page, `雙身分系列 ${id}`, "報名成功");
    await expect(seriesCard).toContainText("同一系列共 2 則");
    await expect(seriesCard.getByRole("link", { name: /前往課程頁/ })).toHaveAttribute("href", `/classes/series/${series.series.id}`);
    const singleCard = card(page, `雙身分單堂 ${id}`, "報名成功");
    await expect(singleCard.getByRole("link", { name: /前往我的報名/ })).toHaveAttribute("href", "/member/enrollments");
    // 以學員身分報名，不會收到給老師的「有新的報名」。
    await expect(page.getByRole("article").filter({ hasText: "有新的報名" })).toHaveCount(0);
  }
});

test("term: one teacher notice per term enrollment and one when a member withdraws, both opening the teacher series page; member notices unchanged", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "term");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const title = `整期通知 ${id}`;
  const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, title, isPublic: true });

  const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null });
  if (!joined.ok) throw new Error("fixture");

  const teacherConfirmed = await prisma.notification.findMany({ where: { userId: teacher.userId, channel: "in_app", type: "enrollment_confirmed" } });
  expect(teacherConfirmed).toHaveLength(1);
  expect(teacherConfirmed[0]).toMatchObject({ targetType: "teacher_class_series", targetId: series.id, recurringClassSeriesId: series.id });

  expect((await withdrawSeriesEnrollmentForUser(member.id, joined.seriesEnrollmentId)).ok).toBe(true);

  await openNotifications(context, page, teacher.sessionToken, "/teacher/notifications");
  const joinedCard = card(page, title, "有新的報名");
  await expect(joinedCard).toHaveCount(1);
  await expect(joinedCard).toContainText(`「${title}（整期 3 堂）」有新的報名。`);
  await expect(joinedCard.getByRole("link", { name: /前往系列頁/ })).toHaveAttribute("href", `/teacher/classes/series/${series.id}`);
  const withdrawnCard = card(page, title, "有學員退出整期");
  await expect(withdrawnCard).toHaveCount(1);
  await expect(withdrawnCard.getByRole("link", { name: /前往系列頁/ })).toHaveAttribute("href", `/teacher/classes/series/${series.id}`);
  await withdrawnCard.getByRole("link", { name: /前往系列頁/ }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}$`));

  // 學員本人的兩則照舊：期班文案、連到期班頁。
  await openNotifications(context, page, member.sessionToken);
  const memberJoined = card(page, title, "報名成功");
  await expect(memberJoined).toContainText(`你已經成功報名「${title}（整期 3 堂）」。`);
  await expect(memberJoined.getByRole("link", { name: /前往期班頁/ })).toHaveAttribute("href", `/classes/terms/${series.id}`);
  const memberWithdrawn = card(page, title, "報名已取消");
  await expect(memberWithdrawn).toContainText(`「${title}（整期 3 堂）」的報名已經取消。`);
  await expect(memberWithdrawn.getByRole("link", { name: /前往期班頁/ })).toHaveAttribute("href", `/classes/terms/${series.id}`);
  await expect(page.getByRole("article").filter({ hasText: "有學員退出整期" })).toHaveCount(0);

  // 學員不能借老師的通知連結進到老師系列頁。
  const response = await page.goto(`/teacher/classes/series/${series.id}`);
  expect(response?.status()).toBe(404);
});

test("term that needs confirmation keeps only the existing pending notice for the teacher", async ({}, testInfo) => {
  const id = runId(testInfo, "term-pending");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { series } = await seedTerm(teacher.teacherProfileId, { count: 2, requiresApproval: true, title: `整期待確認 ${id}` });

  const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null });
  if (!joined.ok || joined.status !== "pending") throw new Error("fixture");

  const types = (await prisma.notification.findMany({ where: { userId: teacher.userId, channel: "in_app", type: { in: ENROLLMENT_TYPES } } })).map((n) => n.type);
  expect(types).toEqual(["enrollment_pending_review"]);
});

test("a term member taking leave for one class tells the teacher with its own copy and date, linking to that class; the member notice stays the same", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "leave");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const title = `請假通知 ${id}`;
  const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 2, title, isPublic: true });
  const joined = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null });
  if (!joined.ok) throw new Error("fixture");

  await openNotifications(context, page, member.sessionToken, `/classes/${sessions[0].id}`);
  const highlights = page.getByRole("region", { name: "課程重點" });
  await highlights.getByText("請假", { exact: true }).click();
  await highlights.getByLabel("我確認這一堂要請假。").check();
  await highlights.getByRole("button", { name: "確認請假" }).click();
  await expect(page.getByText("已請假這一堂，整期的其他堂照常。")).toBeVisible();

  await page.goto("/notifications");
  await expect(card(page, title, "報名已取消")).toContainText(`「${title}」的報名已經取消。`);
  await expect(page.getByRole("article").filter({ hasText: "有學員請假" })).toHaveCount(0);

  await openNotifications(context, page, teacher.sessionToken, "/teacher/notifications");
  const leaveCard = card(page, title, "有學員請假");
  await expect(leaveCard).toHaveCount(1);
  await expect(leaveCard).toContainText(`「${title}」${formatTaipeiShortDatetime(sessions[0].startAt)} 這一堂有一位學員請假`);
  await expect(leaveCard.getByRole("link", { name: /查看這堂課/ })).toHaveAttribute("href", `/teacher/classes/${sessions[0].id}`);
  expect(await prisma.notification.count({ where: { userId: teacher.userId, channel: "email", type: "enrollment_cancelled" } })).toBe(0);
});

// 票 10 review：老師收到的 enrollment_cancelled 有三種說法（退出整期、請假、取消報名）。同一系列同一天，
// 標題不同的通知不合併；只有標題相同的（兩則退出整期）才合成一則。
test("same series, same day: two term withdrawals fold together but a leave stays its own item", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "mixed");
  const teacher = await seedTeacher(id);
  const memberA = await seedMember(id, "a");
  const memberB = await seedMember(id, "b");
  const memberC = await seedMember(id, "c");
  const title = `混合通知 ${id}`;
  const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 2, title, isPublic: true, capacity: 5 });

  const joinedA = await createSeriesEnrollmentForUser(memberA.id, series.id, { notes: null });
  const joinedB = await createSeriesEnrollmentForUser(memberB.id, series.id, { notes: null });
  const joinedC = await createSeriesEnrollmentForUser(memberC.id, series.id, { notes: null });
  if (!joinedA.ok || !joinedB.ok || !joinedC.ok) throw new Error("fixture");

  expect((await withdrawSeriesEnrollmentForUser(memberA.id, joinedA.seriesEnrollmentId)).ok).toBe(true);
  expect((await withdrawSeriesEnrollmentForUser(memberB.id, joinedB.seriesEnrollmentId)).ok).toBe(true);

  // 最新的一則是請假：改版前會把三則合成一則「有學員請假」。
  await openNotifications(context, page, memberC.sessionToken, `/classes/${sessions[0].id}`);
  const highlights = page.getByRole("region", { name: "課程重點" });
  await highlights.getByText("請假", { exact: true }).click();
  await highlights.getByLabel("我確認這一堂要請假。").check();
  await highlights.getByRole("button", { name: "確認請假" }).click();
  await expect(page.getByText("已請假這一堂，整期的其他堂照常。")).toBeVisible();

  await openNotifications(context, page, teacher.sessionToken, "/teacher/notifications");
  const withdrawnCard = card(page, title, "有學員退出整期");
  await expect(withdrawnCard).toHaveCount(1);
  await expect(withdrawnCard).toContainText("同一系列共 2 則");
  const leaveCard = card(page, title, "有學員請假");
  await expect(leaveCard).toHaveCount(1);
  await expect(leaveCard).not.toContainText("同一系列共");
  await expect(leaveCard.getByRole("link", { name: /查看這堂課/ })).toHaveAttribute("href", `/teacher/classes/${sessions[0].id}`);
});
