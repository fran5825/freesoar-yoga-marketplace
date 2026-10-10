import { expect, test } from "@playwright/test";

import { addMakeupSessionForTeacher } from "../../src/domain/class-session/__internal__/add-makeup-session-core";
import { getClassSessionDetailForTeacherUser } from "../../src/domain/class-session/__internal__/class-session-detail-core-for-teacher";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { restoreLeaveForUser } from "../../src/domain/enrollment/__internal__/restore-leave-core";
import {
  markPaidCore,
  markRefundedCore,
  markSeriesCore,
  saveTransferNoteCore,
  type Actor,
  type Scope,
} from "../../src/domain/enrollment/__internal__/payment-core";
import { futureDateTime, futureWeekdayDateString } from "./_helpers/future-dates";
import { prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// lightweight-payment-v0（付款計畫 §9 測試矩陣）：domain 層。金錢不經過飛索，這裡只驗證記錄、快照、權限與併發。
const fixtures = createTermFixtures("lightweight-payment-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

type Teacher = Awaited<ReturnType<typeof seedTeacher>>;

const teacherActor = (teacher: Teacher): Actor => ({ userId: teacher.userId, role: "teacher" });
const teacherScope = (teacher: Teacher): Scope => ({ classSession: { teacherProfileId: teacher.teacherProfileId } });
const adminActor: Actor = { userId: "admin-user-for-test", role: "admin" };

const row = (id: string) => prisma.enrollment.findUniqueOrThrow({ where: { id } });
const events = (enrollmentId: string) =>
  prisma.enrollmentPaymentEvent.findMany({ where: { enrollmentId }, orderBy: { createdAt: "asc" } });

async function setTeacherPayment(
  teacher: Teacher,
  data: { paymentAccountInfo?: string | null; paymentRulesText?: string | null; contactInfo?: string | null },
) {
  await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data });
}

async function seedSingle(label: string, testInfo: Parameters<typeof runId>[0], options: { priceNote?: string | null } = {}) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, capacity: 5, title: `付款 ${id}` });
  if (options.priceNote !== undefined) {
    await prisma.classSession.update({ where: { id: sessions[0].id }, data: { priceNote: options.priceNote } });
  }
  const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
  if (!created.ok) throw new Error("fixture");

  return { id, teacher, member, sessions, enrollmentId: created.enrollmentId };
}

const joinTerm = async (memberId: string, seriesId: string) => {
  const joined = await createSeriesEnrollmentForUser(memberId, seriesId, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");

  return joined.seriesEnrollmentId;
};

test.describe("price note validation", () => {
  test("priceNote is optional, trimmed, and limited to 200 characters", () => {
    const base = {
      title: "課",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: futureDateTime(10, "10:00"),
      endAt: futureDateTime(10, "11:00"),
      location: "教室",
      capacity: 5,
    };
    const ok = validateClassSessionCreate({ ...base, priceNote: "  單堂 600 元  " }, { requireYogaStyles: true });
    expect(ok.valid && ok.normalized.priceNote).toBe("單堂 600 元");
    const empty = validateClassSessionCreate({ ...base, priceNote: "   " }, { requireYogaStyles: true });
    expect(empty.valid && empty.normalized.priceNote).toBeNull();
    const tooLong = validateClassSessionCreate({ ...base, priceNote: "字".repeat(201) }, { requireYogaStyles: true });
    expect(tooLong.valid).toBe(false);
    expect(!tooLong.valid && tooLong.errors.some((error) => error.field === "priceNote" && error.code === "price_note_too_long")).toBe(true);
  });
});

test.describe("snapshots at enrollment creation", () => {
  test("a single enrollment copies the teacher's payment info and the class price; later edits do not change it, new enrollments see the new values", async ({}, testInfo) => {
    const { id, teacher, sessions, enrollmentId } = await seedSingle("single-snap", testInfo);
    // 先設定資料、再讓第二位學員報名，才看得到「新舊兩份」
    const first = await seedMember(id, "first");
    await prisma.classSession.update({ where: { id: sessions[1].id }, data: { priceNote: "單堂 600 元" } });
    await setTeacherPayment(teacher, { paymentAccountInfo: "舊帳號 111", paymentRulesText: "舊規則", contactInfo: "line:old" });
    const created = await createEnrollmentForUser(first.id, sessions[1].id, { notes: null });
    if (!created.ok) throw new Error("fixture");

    expect(await row(created.enrollmentId)).toMatchObject({
      paymentStatus: "unpaid",
      paymentAccountInfoSnapshot: "舊帳號 111",
      paymentRulesSnapshot: "舊規則",
      contactInfoSnapshot: "line:old",
      priceNoteSnapshot: "單堂 600 元",
    });
    // 報名建立時老師還沒填任何資料：快照是 null，不是空字串
    expect(await row(enrollmentId)).toMatchObject({
      paymentAccountInfoSnapshot: null,
      paymentRulesSnapshot: null,
      contactInfoSnapshot: null,
      priceNoteSnapshot: null,
    });

    await setTeacherPayment(teacher, { paymentAccountInfo: "新帳號 222", paymentRulesText: "新規則", contactInfo: "line:new" });
    await prisma.classSession.update({ where: { id: sessions[1].id }, data: { priceNote: "單堂 700 元" } });
    const second = await seedMember(id, "second");
    const secondCreated = await createEnrollmentForUser(second.id, sessions[1].id, { notes: null });
    if (!secondCreated.ok) throw new Error("fixture");

    expect(await row(created.enrollmentId)).toMatchObject({ paymentAccountInfoSnapshot: "舊帳號 111", priceNoteSnapshot: "單堂 600 元" });
    expect(await row(secondCreated.enrollmentId)).toMatchObject({
      paymentAccountInfoSnapshot: "新帳號 222",
      paymentRulesSnapshot: "新規則",
      contactInfoSnapshot: "line:new",
      priceNoteSnapshot: "單堂 700 元",
    });
  });

  test("whole-term enrollment writes the series price and teacher snapshot on every new row; a merged single keeps its older snapshot; makeup rows reuse the term's snapshot", async ({}, testInfo) => {
    const id = runId(testInfo, "term-snap");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3, mode: "term_and_single", title: `期班快照 ${id}` });
    await prisma.recurringClassSeries.update({ where: { id: series.id }, data: { priceNote: "整期 2400 元" } });
    await prisma.classSession.update({ where: { id: sessions[0].id }, data: { priceNote: "單堂 300 元" } });
    await setTeacherPayment(teacher, { paymentAccountInfo: "舊帳號", paymentRulesText: "舊規則", contactInfo: "舊聯絡" });
    const single = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!single.ok) throw new Error("fixture");

    await setTeacherPayment(teacher, { paymentAccountInfo: "新帳號", paymentRulesText: "新規則", contactInfo: "新聯絡" });
    const seriesEnrollmentId = await joinTerm(member.id, series.id);
    const rows = await prisma.enrollment.findMany({
      where: { seriesEnrollmentId },
      orderBy: { classSession: { startAt: "asc" } },
    });
    expect(rows).toHaveLength(3);

    const merged = rows.find((entry) => entry.seriesEnrollmentSource === "merged_single");
    expect(merged?.id).toBe(single.enrollmentId);
    expect(merged).toMatchObject({ paymentAccountInfoSnapshot: "舊帳號", priceNoteSnapshot: "單堂 300 元" });
    for (const created of rows.filter((entry) => entry.seriesEnrollmentSource === "term_created")) {
      expect(created).toMatchObject({
        paymentAccountInfoSnapshot: "新帳號",
        paymentRulesSnapshot: "新規則",
        contactInfoSnapshot: "新聯絡",
        priceNoteSnapshot: "整期 2400 元",
      });
    }

    // 補課：沿用整期建立當下的快照（第一筆 term_created），老師之後再改資料也不影響
    await setTeacherPayment(teacher, { paymentAccountInfo: "更新的帳號" });
    const makeup = await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, futureWeekdayDateString(200, 4));
    expect(makeup.ok).toBe(true);
    const makeupRow = await prisma.enrollment.findFirstOrThrow({ where: { classSessionId: makeup.ok ? makeup.classSessionId : "", userId: member.id } });
    expect(makeupRow).toMatchObject({
      paymentAccountInfoSnapshot: "新帳號",
      paymentRulesSnapshot: "新規則",
      contactInfoSnapshot: "新聯絡",
      priceNoteSnapshot: "整期 2400 元",
    });
  });

  test("makeup falls back to the earliest row when every row of the term enrollment was merged from a single", async ({}, testInfo) => {
    const id = runId(testInfo, "term-merged-only");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 1, mode: "term_and_single", title: `全併入 ${id}` });
    await setTeacherPayment(teacher, { paymentAccountInfo: "併入時的帳號" });
    const single = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!single.ok) throw new Error("fixture");
    await setTeacherPayment(teacher, { paymentAccountInfo: "之後的帳號" });
    await joinTerm(member.id, series.id);
    expect((await row(single.enrollmentId)).seriesEnrollmentSource).toBe("merged_single");

    const makeup = await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, futureWeekdayDateString(200, 4));
    const makeupRow = await prisma.enrollment.findFirstOrThrow({ where: { classSessionId: makeup.ok ? makeup.classSessionId : "", userId: member.id } });
    expect(makeupRow.paymentAccountInfoSnapshot).toBe("併入時的帳號");
  });
});

test.describe("payment status transitions", () => {
  test("unpaid → paid → refunded, each with an audit event; no manual way back; role is taken from the entry point", async ({}, testInfo) => {
    const { teacher, enrollmentId } = await seedSingle("transitions", testInfo);
    const actor = teacherActor(teacher);
    const scope = teacherScope(teacher);

    expect(await markPaidCore(actor, scope, enrollmentId, "已收到，備註王小明")).toEqual({ ok: true });
    expect(await row(enrollmentId)).toMatchObject({
      paymentStatus: "paid",
      paymentNote: "已收到，備註王小明",
      paymentConfirmedByUserId: teacher.userId,
      paymentConfirmedByRole: "teacher",
    });
    expect((await row(enrollmentId)).paymentConfirmedAt).not.toBeNull();

    // 重複標記與跳躍轉換都被擋下，且不改資料
    expect(await markPaidCore(actor, scope, enrollmentId, null)).toMatchObject({ ok: false, code: "payment_state_changed" });
    expect(await markRefundedCore(actor, scope, enrollmentId, "課程異動")).toEqual({ ok: true });
    expect(await row(enrollmentId)).toMatchObject({
      paymentStatus: "refunded",
      paymentRefundReason: "課程異動",
      paymentRefundedByUserId: teacher.userId,
      paymentRefundedByRole: "teacher",
    });
    expect(await markPaidCore(actor, scope, enrollmentId, null)).toMatchObject({ ok: false, code: "payment_state_changed" });
    expect(await markRefundedCore(actor, scope, enrollmentId, null)).toMatchObject({ ok: false, code: "payment_state_changed" });

    expect((await events(enrollmentId)).map((event) => [event.type, event.actorRole])).toEqual([
      ["marked_paid", "teacher"],
      ["marked_refunded", "teacher"],
    ]);
  });

  test("unpaid cannot be refunded; a cancelled enrollment cannot be marked paid but a paid-then-cancelled one can be refunded", async ({}, testInfo) => {
    const { teacher, enrollmentId } = await seedSingle("cancelled", testInfo);
    const actor = teacherActor(teacher);
    const scope = teacherScope(teacher);

    expect(await markRefundedCore(actor, scope, enrollmentId, null)).toMatchObject({ ok: false, code: "payment_state_changed" });
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    expect(await markPaidCore(actor, scope, enrollmentId, null)).toMatchObject({ ok: false, code: "enrollment_cancelled" });
    expect((await row(enrollmentId)).paymentStatus).toBe("unpaid");

    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "confirmed", cancelledBy: null } });
    expect(await markPaidCore(actor, scope, enrollmentId, null)).toEqual({ ok: true });
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    expect(await markRefundedCore(actor, scope, enrollmentId, "學員取消")).toEqual({ ok: true });
    expect((await row(enrollmentId)).paymentStatus).toBe("refunded");
  });

  test("a teacher can only mark enrollments of her own classes; the admin scope reaches any class and records the admin role", async ({}, testInfo) => {
    const { teacher, enrollmentId } = await seedSingle("ownership", testInfo);
    const otherTeacher = await seedTeacher(runId(testInfo, "ownership-other"));

    expect(await markPaidCore(teacherActor(otherTeacher), teacherScope(otherTeacher), enrollmentId, null)).toMatchObject({
      ok: false,
      code: "enrollment_not_found",
    });
    expect((await row(enrollmentId)).paymentStatus).toBe("unpaid");
    expect(await events(enrollmentId)).toHaveLength(0);

    expect(await markPaidCore(adminActor, {}, enrollmentId, null)).toEqual({ ok: true });
    expect(await row(enrollmentId)).toMatchObject({ paymentStatus: "paid", paymentConfirmedByRole: "admin" });
    expect(teacher.userId).not.toBe(adminActor.userId);
  });

  test("two operators marking the same enrollment at once: exactly one wins, one event, no silent overwrite", async ({}, testInfo) => {
    const { teacher, enrollmentId } = await seedSingle("race", testInfo);

    const results = await Promise.all([
      markPaidCore(teacherActor(teacher), teacherScope(teacher), enrollmentId, "老師"),
      markPaidCore(adminActor, {}, enrollmentId, "管理員"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([expect.objectContaining({ code: "payment_state_changed" })]);
    const final = await row(enrollmentId);
    const winnerIsTeacher = results[0].ok;
    expect(final).toMatchObject({
      paymentStatus: "paid",
      paymentConfirmedByRole: winnerIsTeacher ? "teacher" : "admin",
      paymentNote: winnerIsTeacher ? "老師" : "管理員",
    });
    expect(await events(enrollmentId)).toHaveLength(1);
  });

  test("marking a whole term marks every active row, skips leave rows, and records one event per row; refund follows the same way", async ({}, testInfo) => {
    const id = runId(testInfo, "series-mark");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, mode: "term_and_single" });
    const seriesEnrollmentId = await joinTerm(member.id, series.id);
    const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });
    await prisma.enrollment.update({ where: { id: rows[0].id }, data: { status: "cancelled", cancelledBy: "member" } });

    expect(await markSeriesCore("paid", teacherActor(teacher), teacherScope(teacher), seriesEnrollmentId, "整期已收")).toEqual({ ok: true });
    expect((await row(rows[0].id)).paymentStatus).toBe("unpaid");
    expect((await row(rows[1].id)).paymentStatus).toBe("paid");
    expect((await row(rows[2].id)).paymentStatus).toBe("paid");
    expect(await prisma.enrollmentPaymentEvent.count({ where: { enrollmentId: { in: rows.map((entry) => entry.id) } } })).toBe(2);
    // 沒有可標記的場次時，回傳明確錯誤而不是靜默成功
    expect(await markSeriesCore("paid", teacherActor(teacher), teacherScope(teacher), seriesEnrollmentId, null)).toMatchObject({ ok: false, code: "payment_state_changed" });
    expect(await markSeriesCore("refunded", teacherActor(teacher), teacherScope(teacher), seriesEnrollmentId, "整期退費")).toEqual({ ok: true });
    expect((await row(rows[1].id)).paymentStatus).toBe("refunded");
    const other = await seedTeacher(runId(testInfo, "series-mark-other"));
    expect(await markSeriesCore("paid", teacherActor(other), teacherScope(other), seriesEnrollmentId, null)).toMatchObject({ ok: false, code: "enrollment_not_found" });
  });
});

test.describe("transfer note (student-written)", () => {
  test("only the owner can write it; it is trimmed, single-line and limited to 100 characters; clearing works", async ({}, testInfo) => {
    const { id, member, enrollmentId } = await seedSingle("note", testInfo);
    const stranger = await seedMember(id, "stranger");

    expect(await saveTransferNoteCore(member.id, enrollmentId, "  後五碼\n12345  ")).toEqual({ ok: true });
    expect((await row(enrollmentId)).transferNote).toBe("後五碼 12345");
    expect(await saveTransferNoteCore(member.id, enrollmentId, "字".repeat(101))).toMatchObject({ ok: false, code: "transfer_note_too_long" });
    expect((await row(enrollmentId)).transferNote).toBe("後五碼 12345");
    expect(await saveTransferNoteCore(stranger.id, enrollmentId, "偷改")).toMatchObject({ ok: false, code: "enrollment_not_found" });
    expect((await row(enrollmentId)).transferNote).toBe("後五碼 12345");
    expect(await saveTransferNoteCore(member.id, enrollmentId, "")).toEqual({ ok: true });
    expect((await row(enrollmentId)).transferNote).toBeNull();
    // 純文字：含 HTML 的字串原樣存成文字，不做任何轉換
    expect(await saveTransferNoteCore(member.id, enrollmentId, "<script>alert(1)</script>")).toEqual({ ok: true });
    expect((await row(enrollmentId)).transferNote).toBe("<script>alert(1)</script>");
  });

  test("once the teacher marks it paid (or the enrollment is cancelled), the note can no longer be changed", async ({}, testInfo) => {
    const { teacher, member, enrollmentId } = await seedSingle("note-locked", testInfo);
    expect(await saveTransferNoteCore(member.id, enrollmentId, "12345")).toEqual({ ok: true });
    expect(await markPaidCore(teacherActor(teacher), teacherScope(teacher), enrollmentId, null)).toEqual({ ok: true });

    expect(await saveTransferNoteCore(member.id, enrollmentId, "改掉")).toMatchObject({ ok: false, code: "payment_state_changed" });
    expect((await row(enrollmentId)).transferNote).toBe("12345");

    const second = await seedSingle("note-cancelled", testInfo);
    await prisma.enrollment.update({ where: { id: second.enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    expect(await saveTransferNoteCore(second.member.id, second.enrollmentId, "x")).toMatchObject({ ok: false, code: "payment_state_changed" });
  });

  test("a note written at the same moment the teacher marks paid never overwrites a paid enrollment", async ({}, testInfo) => {
    const { teacher, member, enrollmentId } = await seedSingle("note-race", testInfo);

    const [marked, saved] = await Promise.all([
      markPaidCore(teacherActor(teacher), teacherScope(teacher), enrollmentId, null),
      saveTransferNoteCore(member.id, enrollmentId, "同時送出"),
    ]);

    expect(marked).toEqual({ ok: true });
    const final = await row(enrollmentId);
    expect(final.paymentStatus).toBe("paid");
    // 備註只可能在「標記已收款之前」寫入；標記之後寫入必須失敗
    expect(final.transferNote).toBe(saved.ok ? "同時送出" : null);
    if (!saved.ok) {
      expect(saved.code).toBe("payment_state_changed");
    }
  });
});

test.describe("re-enrollment keeps or resets payment fields", () => {
  test("unpaid and paid enrollments keep their payment state and snapshot after cancel + re-enroll", async ({}, testInfo) => {
    const { teacher, member, sessions, enrollmentId } = await seedSingle("reenroll-keep", testInfo);
    await setTeacherPayment(teacher, { paymentAccountInfo: "報名後才填的帳號" });

    // unpaid：保留既有快照（那時老師還沒填，所以是 null），不重抓
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    expect((await createEnrollmentForUser(member.id, sessions[0].id, { notes: null })).ok).toBe(true);
    expect(await row(enrollmentId)).toMatchObject({ paymentStatus: "unpaid", paymentAccountInfoSnapshot: null });

    // paid：付款狀態、稽核欄位與快照都保留，沒有 reset 事件
    expect(await markPaidCore(teacherActor(teacher), teacherScope(teacher), enrollmentId, "已收")).toEqual({ ok: true });
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "cancelled", cancelledBy: "member" } });
    expect((await createEnrollmentForUser(member.id, sessions[0].id, { notes: null })).ok).toBe(true);
    expect(await row(enrollmentId)).toMatchObject({ paymentStatus: "paid", paymentNote: "已收", paymentAccountInfoSnapshot: null });
    expect((await events(enrollmentId)).map((event) => event.type)).toEqual(["marked_paid"]);
  });

  test("a refunded enrollment is reset on re-enrollment: current-round fields cleared, fresh snapshot, history kept in the event, and it can be marked paid again", async ({}, testInfo) => {
    const { teacher, member, sessions, enrollmentId } = await seedSingle("reenroll-reset", testInfo, { priceNote: "單堂 600 元" });
    await setTeacherPayment(teacher, { paymentAccountInfo: "A 帳號", paymentRulesText: "A 規則", contactInfo: "line:A" });
    // 讓這位學員用「A」快照重新建立一次報名：取消、刪掉、再報名
    await prisma.enrollment.delete({ where: { id: enrollmentId } });
    const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
    if (!created.ok) throw new Error("fixture");
    const id = created.enrollmentId;
    expect(await saveTransferNoteCore(member.id, id, "12345")).toEqual({ ok: true });
    expect(await markPaidCore(teacherActor(teacher), teacherScope(teacher), id, "已收")).toEqual({ ok: true });
    expect(await markRefundedCore(teacherActor(teacher), teacherScope(teacher), id, "學員取消")).toEqual({ ok: true });
    await prisma.enrollment.update({ where: { id }, data: { status: "cancelled", cancelledBy: "member" } });

    await setTeacherPayment(teacher, { paymentAccountInfo: "B 帳號", paymentRulesText: "B 規則", contactInfo: "line:B" });
    await prisma.classSession.update({ where: { id: sessions[0].id }, data: { priceNote: "單堂 650 元" } });
    expect((await createEnrollmentForUser(member.id, sessions[0].id, { notes: null })).ok).toBe(true);

    expect(await row(id)).toMatchObject({
      status: "confirmed",
      paymentStatus: "unpaid",
      transferNote: null,
      paymentNote: null,
      paymentConfirmedAt: null,
      paymentConfirmedByUserId: null,
      paymentConfirmedByRole: null,
      paymentRefundedAt: null,
      paymentRefundedByUserId: null,
      paymentRefundedByRole: null,
      paymentRefundReason: null,
      paymentAccountInfoSnapshot: "B 帳號",
      paymentRulesSnapshot: "B 規則",
      contactInfoSnapshot: "line:B",
      priceNoteSnapshot: "單堂 650 元",
    });
    const history = await events(id);
    expect(history.map((event) => event.type)).toEqual(["marked_paid", "marked_refunded", "reset_on_re_enrollment"]);
    expect(history[2].previousRound).toMatchObject({
      paymentStatus: "refunded",
      paymentAccountInfoSnapshot: "A 帳號",
      paymentRulesSnapshot: "A 規則",
      contactInfoSnapshot: "line:A",
      priceNoteSnapshot: "單堂 600 元",
      transferNote: "12345",
      paymentNote: "已收",
      paymentRefundReason: "學員取消",
    });

    // 新的一輪可以再標記已收款
    expect(await markPaidCore(teacherActor(teacher), teacherScope(teacher), id, null)).toEqual({ ok: true });
    expect((await events(id)).map((event) => event.type)).toEqual(["marked_paid", "marked_refunded", "reset_on_re_enrollment", "marked_paid"]);
  });

  test("restoring a leave follows the same rule: refunded is reset, paid is kept", async ({}, testInfo) => {
    const id = runId(testInfo, "restore");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    await setTeacherPayment(teacher, { paymentAccountInfo: "整期舊帳號" });
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, mode: "term_and_single" });
    await prisma.recurringClassSeries.update({ where: { id: series.id }, data: { priceNote: "整期 2400 元" } });
    const seriesEnrollmentId = await joinTerm(member.id, series.id);
    const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });
    expect(await markSeriesCore("paid", teacherActor(teacher), teacherScope(teacher), seriesEnrollmentId, null)).toEqual({ ok: true });
    expect(await markRefundedCore(teacherActor(teacher), teacherScope(teacher), rows[0].id, "請假退費")).toEqual({ ok: true });
    await setTeacherPayment(teacher, { paymentAccountInfo: "整期新帳號" });

    // rows[0]：refunded → 請假 → 取消請假：重設
    await prisma.enrollment.update({ where: { id: rows[0].id }, data: { status: "cancelled", cancelledBy: "member" } });
    expect(await restoreLeaveForUser(member.id, rows[0].id)).toEqual({ ok: true, status: "confirmed" });
    expect(await row(rows[0].id)).toMatchObject({ paymentStatus: "unpaid", paymentAccountInfoSnapshot: "整期新帳號", priceNoteSnapshot: "整期 2400 元" });
    expect((await events(rows[0].id)).map((event) => event.type)).toEqual(["marked_paid", "marked_refunded", "reset_on_re_enrollment"]);

    // rows[1]：paid → 請假 → 取消請假：保留
    await prisma.enrollment.update({ where: { id: rows[1].id }, data: { status: "cancelled", cancelledBy: "member" } });
    expect(await restoreLeaveForUser(member.id, rows[1].id)).toEqual({ ok: true, status: "confirmed" });
    expect(await row(rows[1].id)).toMatchObject({ paymentStatus: "paid", paymentAccountInfoSnapshot: "整期舊帳號" });
  });
});

test.describe("teacher roster query", () => {
  test("includes pending, confirmed, and cancelled-with-payment enrollments; excludes cancelled-unpaid; carries payment fields", async ({}, testInfo) => {
    const id = runId(testInfo, "roster");
    const teacher = await seedTeacher(id);
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1, capacity: 10, title: `名單 ${id}` });
    const classSessionId = sessions[0].id;
    const labels = ["pending", "confirmed", "cancelled-paid", "cancelled-refunded", "cancelled-unpaid"] as const;
    const users: Record<string, string> = {};

    for (const label of labels) {
      const member = await seedMember(id, label);
      users[label] = member.id;
      await prisma.enrollment.create({
        data: {
          classSessionId,
          userId: member.id,
          status: label === "pending" ? "pending" : label === "confirmed" ? "confirmed" : "cancelled",
          cancelledBy: label.startsWith("cancelled") ? "member" : null,
          paymentStatus: label === "cancelled-paid" ? "paid" : label === "cancelled-refunded" ? "refunded" : "unpaid",
          consentedAt: new Date(),
          transferNote: label === "confirmed" ? "12345" : null,
        },
      });
    }

    const detail = await getClassSessionDetailForTeacherUser(teacher.userId, classSessionId);
    const byUser = new Map((detail?.enrollments ?? []).map((entry) => [entry.status + ":" + entry.paymentStatus, entry]));

    expect(detail?.enrollments).toHaveLength(4);
    expect(byUser.has("pending:unpaid")).toBe(true);
    expect(byUser.get("confirmed:unpaid")?.transferNote).toBe("12345");
    expect(byUser.has("cancelled:paid")).toBe(true);
    expect(byUser.has("cancelled:refunded")).toBe(true);
    expect(users["cancelled-unpaid"]).toBeTruthy();
    expect(detail?.enrollments.some((entry) => entry.status === "cancelled" && entry.paymentStatus === "unpaid")).toBe(false);
  });
});
