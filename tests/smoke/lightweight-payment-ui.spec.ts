import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { markPaidCore } from "../../src/domain/enrollment/__internal__/payment-core";
import { waitForHydrated } from "./_helpers/hydration";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// lightweight-payment-v0：畫面層。金錢不經過飛索；這裡驗證「誰在什麼時間點看得到什麼」。
const fixtures = createTermFixtures("lightweight-payment-ui-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;
const extraEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({ where: { organizerProfile: { user: { email: { in: extraEmails } } } } });
  await cleanupOrganizerDemandFixtures(extraEmails);
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const ACCOUNT = "（012）台北富邦 1234-5678-9012 王小明";
const CONTACT = "Line ID yoga_amy";
const RULES = "請於開課前 3 天內完成轉帳。開課前 48 小時取消可全額退費。";
const PRICE = "單堂 600 元";

async function seedPayingClass(label: string, testInfo: Parameters<typeof runId>[0]) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  await prisma.teacherProfile.update({
    where: { id: teacher.teacherProfileId },
    data: { paymentAccountInfo: ACCOUNT, paymentRulesText: RULES, contactInfo: CONTACT },
  });
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, capacity: 5, title: `付款畫面 ${id}` });
  await prisma.classSession.update({ where: { id: sessions[0].id }, data: { priceNote: PRICE } });

  return { id, teacher, series, sessions };
}

test.describe("teacher payment settings page", () => {
  test("saves rules, account and contact; example sentences can be inserted", async ({ page, context }, testInfo) => {
    const id = runId(testInfo, "settings");
    const teacher = await seedTeacher(id);
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/profile/payment");
    await expect(page.getByRole("heading", { name: "老師資料" })).toBeVisible();
    await expect(page.getByRole("link", { name: "收款與聯絡" })).toHaveAttribute("aria-current", "page");
    const rules = page.getByLabel("繳費與取消規則（選填）");
    await waitForHydrated(rules);

    await page.getByRole("button", { name: "請於開課前 3 天內完成轉帳。" }).click();
    await expect(rules).toHaveValue("請於開課前 3 天內完成轉帳。");
    await page.getByRole("button", { name: "轉帳後請填寫帳號後五碼，方便我對帳。" }).click();
    await expect(rules).toHaveValue("請於開課前 3 天內完成轉帳。\n轉帳後請填寫帳號後五碼，方便我對帳。");
    await page.getByLabel("收款帳號（選填）").fill(ACCOUNT);
    await page.getByLabel("聯絡方式（選填）").fill(CONTACT);
    await page.getByRole("button", { name: "儲存" }).click();

    await expect(page.getByText("收款與聯絡資料已儲存。")).toBeVisible();
    expect(await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId } })).toMatchObject({
      paymentAccountInfo: ACCOUNT,
      contactInfo: CONTACT,
      paymentRulesText: "請於開課前 3 天內完成轉帳。\n轉帳後請填寫帳號後五碼，方便我對帳。",
    });
  });

  test("an unapproved teacher sees an explanation instead of the form", async ({ page, context }, testInfo) => {
    const id = runId(testInfo, "settings-unapproved");
    const teacher = await seedTeacher(id);
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "submitted" } });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/profile/payment");
    await expect(page.getByRole("heading", { name: "通過老師審核後就能設定" })).toBeVisible();
    await expect(page.getByLabel("收款帳號（選填）")).toHaveCount(0);
  });
});

test.describe("before enrolling: price and rules are visible, account and contact are not", () => {
  test("a visitor sees the price and rules on the single class page, but never the account or contact", async ({ page }, testInfo) => {
    const { sessions } = await seedPayingClass("visitor-single", testInfo);

    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("heading", { name: "價格" })).toBeVisible();
    await expect(page.getByText(PRICE)).toBeVisible();
    await expect(page.getByRole("heading", { name: "繳費與取消規則" })).toBeVisible();
    await expect(page.getByText(RULES)).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("1234-5678-9012");
    expect(html).not.toContain("yoga_amy");
  });

  test("a class with no price and no rules shows neither section (有填才顯示)", async ({ page }, testInfo) => {
    const { sessions } = await seedPayingClass("visitor-empty", testInfo);

    // 第二場沒填價格；老師的規則是有填的，所以只確認價格那一塊不出現
    await page.goto(`/classes/${sessions[1].id}`);
    await expect(page.getByRole("heading", { name: "價格" })).toHaveCount(0);
  });

  test("the series page and the term page show the same price and rules sections and no private fields", async ({ page }, testInfo) => {
    const { series, sessions } = await seedPayingClass("visitor-series", testInfo);
    await prisma.classSession.updateMany({ where: { recurringClassSeriesId: series.id }, data: { priceNote: PRICE } });

    await page.goto(`/classes/series/${series.id}`);
    await expect(page.getByRole("heading", { name: "價格" })).toBeVisible();
    await expect(page.getByText(RULES)).toBeVisible();
    expect(await page.content()).not.toContain("1234-5678-9012");

    const id = runId(testInfo, "visitor-term");
    const teacher = await seedTeacher(id);
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { paymentAccountInfo: ACCOUNT, paymentRulesText: RULES, contactInfo: CONTACT } });
    const term = await seedTerm(teacher.teacherProfileId, { count: 3, isPublic: true, title: `期班畫面 ${id}` });
    await prisma.recurringClassSeries.update({ where: { id: term.series.id }, data: { priceNote: "整期 2400 元" } });
    await page.goto(`/classes/terms/${term.series.id}`);
    await expect(page.getByText("整期 2400 元")).toBeVisible();
    await expect(page.getByText(RULES)).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("1234-5678-9012");
    expect(html).not.toContain("yoga_amy");
    expect(sessions.length).toBeGreaterThan(0);
  });
});

test.describe("member: payment block on 我的報名", () => {
  test("shows the snapshot, saves a transfer note, and locks once the teacher marks it paid", async ({ page, context }, testInfo) => {
    const { teacher, sessions } = await seedPayingClass("member", testInfo);
    const member = await seedMember(runId(testInfo, "member-ui"), "a");
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");
    // 老師報名後才改帳號：學員看到的必須是報名當下的快照
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { paymentAccountInfo: "報名後才改的新帳號 999" } });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/member/enrollments");
    const block = page.locator(`#enrollment-${created.enrollmentId}`);
    await expect(block.getByRole("heading", { name: "付款方式" })).toBeVisible();
    await expect(block.getByText("付款：待付款")).toBeVisible();
    await expect(block.getByText(PRICE)).toBeVisible();
    await expect(block.getByText(ACCOUNT)).toBeVisible();
    await expect(block.getByText(CONTACT)).toBeVisible();
    await expect(block.getByText(RULES)).toBeVisible();
    await expect(block.getByText("999")).toHaveCount(0);
    await expect(block.getByText("付款由你與老師直接完成，飛索目前不經手款項。")).toBeVisible();

    const noteInput = block.getByLabel("轉帳後五碼或備註（選填）");
    await waitForHydrated(noteInput);
    await noteInput.fill("帳號後五碼 12345");
    await block.getByRole("button", { name: "儲存備註" }).click();
    await expect(page.getByText("已儲存轉帳備註。")).toBeVisible();
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: created.enrollmentId } })).transferNote).toBe("帳號後五碼 12345");

    expect(await markPaidCore({ userId: teacher.userId, role: "teacher" }, { classSession: { teacherProfileId: teacher.teacherProfileId } }, created.enrollmentId, null)).toEqual({ ok: true });
    await page.goto("/member/enrollments");
    await expect(block.getByText("付款：已收款")).toBeVisible();
    await expect(block.getByRole("button", { name: "儲存備註" })).toHaveCount(0);
    await expect(block.getByText("帳號後五碼 12345")).toBeVisible();
  });

  test("a whole-term member sees one payment block on the term card and one note applies to every active row", async ({ page, context }, testInfo) => {
    const id = runId(testInfo, "member-term");
    const teacher = await seedTeacher(id);
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { paymentAccountInfo: ACCOUNT } });
    const term = await seedTerm(teacher.teacherProfileId, { count: 3, title: `整期付款 ${id}` });
    await prisma.recurringClassSeries.update({ where: { id: term.series.id }, data: { priceNote: "整期 2400 元" } });
    const member = await seedMember(id, "a");
    const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
    if (!joined.ok) throw new Error("fixture");
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/member/enrollments");
    const card = page.locator(`#term-${joined.seriesEnrollmentId}`);
    await expect(card.getByRole("heading", { name: "付款方式" })).toHaveCount(1);
    await expect(card.getByText("整期 2400 元")).toBeVisible();
    const noteInput = card.getByLabel("轉帳後五碼或備註（選填）");
    await waitForHydrated(noteInput);
    await noteInput.fill("整期後五碼 54321");
    await card.getByRole("button", { name: "儲存備註" }).click();
    await expect(page.getByText("已儲存轉帳備註。")).toBeVisible();

    const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId } });
    expect(rows).toHaveLength(3);
    expect(rows.every((entry) => entry.transferNote === "整期後五碼 54321")).toBe(true);
  });
});

test.describe("teacher: mark paid and refunded from the roster", () => {
  test("the teacher marks paid with a note, then refunded with a reason; the member sees the reason", async ({ page, context }, testInfo) => {
    const { teacher, sessions } = await seedPayingClass("teacher-roster", testInfo);
    const member = await seedMember(runId(testInfo, "teacher-roster-member"), "a");
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");
    await prisma.enrollment.update({ where: { id: created.enrollmentId }, data: { transferNote: "後五碼 24680" } });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto(`/teacher/classes/${sessions[0].id}`);
    await expect(page.getByText("付款：待付款")).toBeVisible();
    await expect(page.getByText("後五碼 24680")).toBeVisible();
    const openPaid = page.getByRole("button", { name: /標記 .* 為已收款/ });
    await waitForHydrated(openPaid);
    await openPaid.click();
    await page.getByLabel("收款備註（選填）").fill("已收到，備註王小明");
    await page.getByRole("button", { name: "標記為已收款" }).click();

    await expect(page.getByText("已標記為已收款。")).toBeVisible();
    await expect(page.getByText("付款：已收款")).toBeVisible();
    await expect(page.getByText("已收到，備註王小明")).toBeVisible();
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { id: created.enrollmentId } })).toMatchObject({
      paymentStatus: "paid",
      paymentConfirmedByRole: "teacher",
      paymentNote: "已收到，備註王小明",
    });

    const openRefund = page.getByRole("button", { name: /標記 .* 為已退款/ });
    await waitForHydrated(openRefund);
    await openRefund.click();
    await page.getByLabel("退款說明（選填，學員看得到）").fill("課程異動，全額退費");
    await page.getByRole("button", { name: "標記為已退款" }).click();
    await expect(page.getByText("已標記為已退款。")).toBeVisible();
    await expect(page.getByText("付款：已退款")).toBeVisible();

    const memberContext = await context.browser()!.newContext({ baseURL: testInfo.project.use.baseURL });
    await addAuthSessionCookie(memberContext, member.sessionToken);
    const memberPage = await memberContext.newPage();
    await memberPage.goto("/member/enrollments");
    await expect(memberPage.getByText("付款：已退款")).toBeVisible();
    await expect(memberPage.getByText("課程異動，全額退費")).toBeVisible();
    await memberContext.close();
  });

  test("a paid enrollment that was cancelled stays on the roster so the teacher can still mark the refund", async ({ page, context }, testInfo) => {
    const { teacher, sessions } = await seedPayingClass("teacher-cancelled-paid", testInfo);
    const member = await seedMember(runId(testInfo, "teacher-cancelled-paid-member"), "a");
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");
    expect(await markPaidCore({ userId: teacher.userId, role: "teacher" }, { classSession: { teacherProfileId: teacher.teacherProfileId } }, created.enrollmentId, null)).toEqual({ ok: true });
    await prisma.enrollment.update({ where: { id: created.enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto(`/teacher/classes/${sessions[0].id}`);
    await expect(page.getByRole("heading", { name: /已取消但有付款紀錄/ })).toBeVisible();
    await expect(page.getByText("報名已取消", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /標記 .* 為已退款/ })).toBeVisible();
    // 已取消的報名不算在「已報名」人數裡
    await expect(page.getByText("已報名 0 /")).toBeVisible();
  });
});

test.describe("admin: can mark any enrollment", () => {
  test("the admin marks paid from the class page and the record shows the admin role", async ({ page, context }, testInfo) => {
    const { sessions } = await seedPayingClass("admin", testInfo);
    const member = await seedMember(runId(testInfo, "admin-member"), "a");
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");
    const adminEmail = `admin-${runId(testInfo, "admin-user")}@lightweight-payment-ui-smoke.local`;
    extraEmails.push(adminEmail);
    const admin = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, admin.sessionToken);

    await page.goto(`/admin/classes/${sessions[0].id}`);
    const rowLocator = page.locator(`#enrollment-${created.enrollmentId}`);
    await expect(rowLocator.getByText("付款：待付款")).toBeVisible();
    const open = rowLocator.getByRole("button", { name: "標記已收款" });
    await waitForHydrated(open);
    await open.click();
    await page.getByRole("button", { name: "確認標記為已收款" }).click();

    await expect(page.locator(`#enrollment-${created.enrollmentId}`).getByText("付款：已收款")).toBeVisible();
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { id: created.enrollmentId } })).toMatchObject({
      paymentStatus: "paid",
      paymentConfirmedByRole: "admin",
    });
  });
});

test.describe("organizer: read-only payment status, no private fields", () => {
  test("the organizer sees payment status only; notes, account, contact and transfer note never reach the page; no mark buttons", async ({ page, context }, testInfo) => {
    const id = runId(testInfo, "organizer");
    const teacher = await seedTeacher(id);
    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { paymentAccountInfo: ACCOUNT, paymentRulesText: RULES, contactInfo: CONTACT },
    });
    const organizerEmail = `organizer-${id}@lightweight-payment-ui-smoke.local`;
    extraEmails.push(organizerEmail);
    const organizer = await createOrganizerProfileWithOrganization({ email: organizerEmail, displayName: `Org ${id}`, organizationName: `Org ${id}` });
    const start = new Date(Date.now() + 3 * 86_400_000);
    const classSession = await prisma.classSession.create({
      data: {
        origin: "organizer_direct",
        teacherProfileId: teacher.teacherProfileId,
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        title: `團主付款 ${id}`,
        serviceType: "放鬆紓壓",
        serviceTypes: ["放鬆紓壓"],
        startAt: start,
        endAt: new Date(start.getTime() + 3_600_000),
        location: "教室",
        capacity: 5,
        status: "open_for_enrollment",
        isPublic: false,
      },
    });
    const paidMember = await seedMember(id, "paid");
    const cancelledMember = await seedMember(id, "cancelled");
    const paid = await createEnrollmentForUser(paidMember.id, classSession.id, { notes: null });
    const cancelled = await createEnrollmentForUser(cancelledMember.id, classSession.id, { notes: null });
    if (!paid.ok || !cancelled.ok) throw new Error("fixture");
    const actor = { userId: teacher.userId, role: "teacher" as const };
    const scope = { classSession: { teacherProfileId: teacher.teacherProfileId } };
    expect(await markPaidCore(actor, scope, paid.enrollmentId, "老師的內部備註 SECRET-NOTE")).toEqual({ ok: true });
    expect(await markPaidCore(actor, scope, cancelled.enrollmentId, null)).toEqual({ ok: true });
    await prisma.enrollment.updateMany({ where: { id: paid.enrollmentId }, data: { transferNote: "學員備註 SECRET-TRANSFER" } });
    await prisma.enrollment.update({ where: { id: cancelled.enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/classes/${classSession.id}`);
    await expect(page.getByText("付款：已收款（老師記錄，唯讀）").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /已取消但有付款紀錄/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /標記/ })).toHaveCount(0);
    const html = await page.content();
    for (const secret of ["SECRET-NOTE", "SECRET-TRANSFER", "1234-5678-9012", "yoga_amy"]) {
      expect(html).not.toContain(secret);
    }
  });
});
