// lightweight-payment-v0（付款計畫 P2、P3、P6、P7）：手動記錄付款狀態的 service（auth 外層）。
//
// 金錢完全不經過飛索：學員直接轉帳給授課老師，老師（或 Admin）在站內把報名標記為「已收款」或「已退款」。
// 這個檔案只負責「判斷你是誰、能動哪些報名」，真正的原子狀態轉換與事件紀錄在
// __internal__/payment-core.ts（測試也直接呼叫那裡）。

import type { PaymentActorRole } from "@prisma/client";

import { requireAdmin, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  markFail,
  markPaidCore,
  markRefundedCore,
  markSeriesCore,
  saveTermTransferNoteCore,
  saveTransferNoteCore,
  transferFail,
  type Actor,
  type MarkPaymentResult,
  type SaveTransferNoteResult,
} from "./__internal__/payment-core";
import { PAYMENT_NOTE_MAX_LENGTH } from "./payment-limits";

export type { MarkPaymentErrorCode, MarkPaymentResult, SaveTransferNoteResult } from "./__internal__/payment-core";

function normalizeNote(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\r\n?/g, "\n").trim();

  return trimmed ? trimmed : null;
}

function checkedNote(value: string | null | undefined): { ok: true; note: string | null } | { ok: false } {
  const note = normalizeNote(value);

  if (note && note.length > PAYMENT_NOTE_MAX_LENGTH) {
    return { ok: false };
  }

  return { ok: true, note };
}

const noteTooLong = (): MarkPaymentResult => ({
  ok: false,
  code: "note_too_long",
  message: `備註不可超過 ${PAYMENT_NOTE_MAX_LENGTH} 個字。`,
});

async function resolveTeacherActor(): Promise<
  { ok: true; actor: Actor; teacherProfileId: string } | { ok: false; result: MarkPaymentResult }
> {
  try {
    const currentUser = await requireUser();
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return { ok: false, result: markFail("teacher_profile_required") };
    }

    return {
      ok: true,
      actor: { userId: currentUser.id, role: "teacher" as PaymentActorRole },
      teacherProfileId: teacherProfile.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return { ok: false, result: markFail("authentication_required") };
    }

    throw error;
  }
}

async function resolveAdminActor(): Promise<
  { ok: true; actor: Actor } | { ok: false; result: MarkPaymentResult }
> {
  try {
    const currentUser = await requireAdmin();

    return { ok: true, actor: { userId: currentUser.id, role: "admin" as PaymentActorRole } };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Authentication required" || error.message === "Admin access required")
    ) {
      return { ok: false, result: markFail("admin_permission_required") };
    }

    throw error;
  }
}

// 授課老師：只能操作自己班級（classSession.teacherProfileId）底下的報名。
// 查看與標記自己既有班級的付款不要求老師目前是 approved（與老師查看自己既有課程的慣例一致）。
export async function markEnrollmentPaidForTeacher(
  enrollmentId: string,
  note?: string | null,
): Promise<MarkPaymentResult> {
  const teacher = await resolveTeacherActor();

  if (!teacher.ok) {
    return teacher.result;
  }

  const checked = checkedNote(note);

  return checked.ok
    ? markPaidCore(teacher.actor, { classSession: { teacherProfileId: teacher.teacherProfileId } }, enrollmentId, checked.note)
    : noteTooLong();
}

export async function markEnrollmentRefundedForTeacher(
  enrollmentId: string,
  reason?: string | null,
): Promise<MarkPaymentResult> {
  const teacher = await resolveTeacherActor();

  if (!teacher.ok) {
    return teacher.result;
  }

  const checked = checkedNote(reason);

  return checked.ok
    ? markRefundedCore(teacher.actor, { classSession: { teacherProfileId: teacher.teacherProfileId } }, enrollmentId, checked.note)
    : noteTooLong();
}

export async function markSeriesEnrollmentPaidForTeacher(
  seriesEnrollmentId: string,
  note?: string | null,
): Promise<MarkPaymentResult> {
  const teacher = await resolveTeacherActor();

  if (!teacher.ok) {
    return teacher.result;
  }

  const checked = checkedNote(note);

  return checked.ok
    ? markSeriesCore("paid", teacher.actor, { classSession: { teacherProfileId: teacher.teacherProfileId } }, seriesEnrollmentId, checked.note)
    : noteTooLong();
}

export async function markSeriesEnrollmentRefundedForTeacher(
  seriesEnrollmentId: string,
  reason?: string | null,
): Promise<MarkPaymentResult> {
  const teacher = await resolveTeacherActor();

  if (!teacher.ok) {
    return teacher.result;
  }

  const checked = checkedNote(reason);

  return checked.ok
    ? markSeriesCore("refunded", teacher.actor, { classSession: { teacherProfileId: teacher.teacherProfileId } }, seriesEnrollmentId, checked.note)
    : noteTooLong();
}

// Admin：可跨老師操作，作為支援與糾紛協調。
export async function markEnrollmentPaidForAdmin(
  enrollmentId: string,
  note?: string | null,
): Promise<MarkPaymentResult> {
  const admin = await resolveAdminActor();

  if (!admin.ok) {
    return admin.result;
  }

  const checked = checkedNote(note);

  return checked.ok ? markPaidCore(admin.actor, {}, enrollmentId, checked.note) : noteTooLong();
}

export async function markEnrollmentRefundedForAdmin(
  enrollmentId: string,
  reason?: string | null,
): Promise<MarkPaymentResult> {
  const admin = await resolveAdminActor();

  if (!admin.ok) {
    return admin.result;
  }

  const checked = checkedNote(reason);

  return checked.ok ? markRefundedCore(admin.actor, {}, enrollmentId, checked.note) : noteTooLong();
}

export async function markSeriesEnrollmentPaidForAdmin(
  seriesEnrollmentId: string,
  note?: string | null,
): Promise<MarkPaymentResult> {
  const admin = await resolveAdminActor();

  if (!admin.ok) {
    return admin.result;
  }

  const checked = checkedNote(note);

  return checked.ok ? markSeriesCore("paid", admin.actor, {}, seriesEnrollmentId, checked.note) : noteTooLong();
}

export async function markSeriesEnrollmentRefundedForAdmin(
  seriesEnrollmentId: string,
  reason?: string | null,
): Promise<MarkPaymentResult> {
  const admin = await resolveAdminActor();

  if (!admin.ok) {
    return admin.result;
  }

  const checked = checkedNote(reason);

  return checked.ok ? markSeriesCore("refunded", admin.actor, {}, seriesEnrollmentId, checked.note) : noteTooLong();
}

async function resolveMemberUserId(): Promise<{ ok: true; userId: string } | { ok: false; result: SaveTransferNoteResult }> {
  try {
    return { ok: true, userId: (await requireUser()).id };
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return { ok: false, result: transferFail("authentication_required") };
    }

    throw error;
  }
}

// 學員轉帳後五碼或備註（付款計畫 P6）：只有該筆報名的學員本人可寫。
export async function saveOwnTransferNote(
  enrollmentId: string,
  note: string | null | undefined,
): Promise<SaveTransferNoteResult> {
  const member = await resolveMemberUserId();

  return member.ok ? saveTransferNoteCore(member.userId, enrollmentId, note) : member.result;
}

// 整期學員的轉帳備註：套用到這個整期報名底下仍有效且尚未付款的每一堂（學員只需填一次）。
export async function saveOwnTermTransferNote(
  seriesEnrollmentId: string,
  note: string | null | undefined,
): Promise<SaveTransferNoteResult> {
  const member = await resolveMemberUserId();

  return member.ok ? saveTermTransferNoteCore(member.userId, seriesEnrollmentId, note) : member.result;
}
