// __internal__：不是通用 API。給 payment-service.ts（auth 外層）與 Playwright 測試直接呼叫，
// 比照 enrollment/__internal__ 其他 core：這裡不做任何身分判斷，呼叫端必須已經完成權限檢查，並自己決定 scope
// （老師只能操作自己班級）。刻意不 import 任何登入相關模組，測試才能直接載入。
//
// lightweight-payment-v0（付款計畫 P2、P3、P6、P7）：手動記錄付款狀態。金錢完全不經過飛索，
// 這裡只做「原子狀態轉換 + 事件紀錄」，不碰金流、不發通知、不改 EnrollmentStatus。
//
// 狀態只允許 unpaid → paid → refunded。每一次轉換都是「帶舊狀態條件的 updateMany，count === 1 才算成功」，
// 並在同一個 transaction 內新增一筆 EnrollmentPaymentEvent；兩個合法操作者幾乎同時操作時，只有一個成功，
// 另一個收到「狀態已被其他操作改變」，不會悄悄覆寫稽核欄位。
// refunded → unpaid 只存在於重新報名的內部流程（payment-snapshot.ts），這裡沒有手動入口。

import type { PaymentActorRole, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { TRANSFER_NOTE_MAX_LENGTH } from "../payment-limits";

export type MarkPaymentErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "admin_permission_required"
  | "enrollment_not_found"
  | "enrollment_cancelled"
  | "note_too_long"
  | "payment_state_changed"
  | "mark_failed";

export type MarkPaymentResult =
  | { ok: true }
  | { ok: false; code: MarkPaymentErrorCode; message: string };

export const markPaymentMessages: Record<MarkPaymentErrorCode, string> = {
  authentication_required: "請先登入。",
  teacher_profile_required: "找不到你的老師資料。",
  admin_permission_required: "需要 Admin 權限才能操作。",
  enrollment_not_found: "找不到這筆報名紀錄，或你沒有權限操作。",
  enrollment_cancelled: "這筆報名已取消，無法標記為已收款。",
  note_too_long: "備註太長了，請縮短後再試。",
  payment_state_changed: "付款狀態已被其他操作更新，請重新整理後再確認。",
  mark_failed: "暫時無法更新付款狀態，請稍後再試。",
};

export function markFail(code: MarkPaymentErrorCode): MarkPaymentResult {
  return { ok: false, code, message: markPaymentMessages[code] };
}

export type Actor = { userId: string; role: PaymentActorRole };

export type Scope = { classSession?: { teacherProfileId: string } };

export async function markPaidCore(
  actor: Actor,
  scope: Scope,
  enrollmentId: string,
  note: string | null,
): Promise<MarkPaymentResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<MarkPaymentResult> => {
      const updated = await tx.enrollment.updateMany({
        where: {
          id: enrollmentId,
          ...scope,
          paymentStatus: "unpaid",
          // 已取消的報名不能標記為已收款（只有曾經付款才會進入退款流程）。
          status: { not: "cancelled" },
        },
        data: {
          paymentStatus: "paid",
          paymentNote: note,
          paymentConfirmedAt: new Date(),
          paymentConfirmedByUserId: actor.userId,
          paymentConfirmedByRole: actor.role,
        },
      });

      if (updated.count !== 1) {
        return classifyFailure(tx, enrollmentId, scope, "paid");
      }

      await tx.enrollmentPaymentEvent.create({
        data: { enrollmentId, type: "marked_paid", actorUserId: actor.userId, actorRole: actor.role, note },
      });

      return { ok: true };
    });
  } catch (error) {
    console.error("[payment] mark paid failed", error);

    return markFail("mark_failed");
  }
}

export async function markRefundedCore(
  actor: Actor,
  scope: Scope,
  enrollmentId: string,
  reason: string | null,
): Promise<MarkPaymentResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<MarkPaymentResult> => {
      const updated = await tx.enrollment.updateMany({
        where: { id: enrollmentId, ...scope, paymentStatus: "paid" },
        data: {
          paymentStatus: "refunded",
          paymentRefundReason: reason,
          paymentRefundedAt: new Date(),
          paymentRefundedByUserId: actor.userId,
          paymentRefundedByRole: actor.role,
        },
      });

      if (updated.count !== 1) {
        return classifyFailure(tx, enrollmentId, scope, "refunded");
      }

      await tx.enrollmentPaymentEvent.create({
        data: { enrollmentId, type: "marked_refunded", actorUserId: actor.userId, actorRole: actor.role, note: reason },
      });

      return { ok: true };
    });
  } catch (error) {
    console.error("[payment] mark refunded failed", error);

    return markFail("mark_failed");
  }
}

// 更新沒有成功時，區分「找不到或不是你的」「已取消」與「狀態已被改變」。
async function classifyFailure(
  tx: Prisma.TransactionClient,
  enrollmentId: string,
  scope: Scope,
  target: "paid" | "refunded",
): Promise<MarkPaymentResult> {
  const existing = await tx.enrollment.findFirst({
    where: { id: enrollmentId, ...scope },
    select: { status: true },
  });

  if (!existing) {
    return markFail("enrollment_not_found");
  }

  if (target === "paid" && existing.status === "cancelled") {
    return markFail("enrollment_cancelled");
  }

  return markFail("payment_state_changed");
}

// 整期報名（期班）：每一堂都是各自的 Enrollment，但學員通常是整期一次轉帳。
// 這裡的整期版本只是「對同一個整期報名底下、符合條件的每一堂各做一次單堂的原子轉換」：
// 一個 transaction 內逐筆 compare-and-set，每筆各寫一個事件；已取消（請假）的堂數不標記已收款，
// 已經是目標狀態或狀態不符的堂數略過。若沒有任何一筆成功，回傳明確錯誤。
export async function markSeriesCore(
  kind: "paid" | "refunded",
  actor: Actor,
  scope: Scope,
  seriesEnrollmentId: string,
  note: string | null,
): Promise<MarkPaymentResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<MarkPaymentResult> => {
      const rows = await tx.enrollment.findMany({
        where: {
          seriesEnrollmentId,
          ...scope,
          paymentStatus: kind === "paid" ? "unpaid" : "paid",
          ...(kind === "paid" ? { status: { not: "cancelled" as const } } : {}),
        },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      let changed = 0;

      for (const row of rows) {
        const data =
          kind === "paid"
            ? {
                paymentStatus: "paid" as const,
                paymentNote: note,
                paymentConfirmedAt: new Date(),
                paymentConfirmedByUserId: actor.userId,
                paymentConfirmedByRole: actor.role,
              }
            : {
                paymentStatus: "refunded" as const,
                paymentRefundReason: note,
                paymentRefundedAt: new Date(),
                paymentRefundedByUserId: actor.userId,
                paymentRefundedByRole: actor.role,
              };
        const updated = await tx.enrollment.updateMany({
          where: {
            id: row.id,
            paymentStatus: kind === "paid" ? "unpaid" : "paid",
            ...(kind === "paid" ? { status: { not: "cancelled" as const } } : {}),
          },
          data,
        });

        if (updated.count === 1) {
          changed += 1;
          await tx.enrollmentPaymentEvent.create({
            data: {
              enrollmentId: row.id,
              type: kind === "paid" ? "marked_paid" : "marked_refunded",
              actorUserId: actor.userId,
              actorRole: actor.role,
              note,
            },
          });
        }
      }

      if (changed > 0) {
        return { ok: true };
      }

      const exists = await tx.enrollment.findFirst({ where: { seriesEnrollmentId, ...scope }, select: { id: true } });

      return exists ? markFail("payment_state_changed") : markFail("enrollment_not_found");
    });
  } catch (error) {
    console.error("[payment] mark series failed", error);

    return markFail("mark_failed");
  }
}

// ---- 學員轉帳後五碼或備註（付款計畫 P6）----

export type SaveTransferNoteErrorCode =
  | "authentication_required"
  | "enrollment_not_found"
  | "transfer_note_too_long"
  | "payment_state_changed"
  | "save_failed";

export type SaveTransferNoteResult =
  | { ok: true }
  | { ok: false; code: SaveTransferNoteErrorCode; message: string };

const transferNoteMessages: Record<SaveTransferNoteErrorCode, string> = {
  authentication_required: "請先登入。",
  enrollment_not_found: "找不到這筆報名紀錄，或你沒有權限操作。",
  transfer_note_too_long: `轉帳備註不可超過 ${TRANSFER_NOTE_MAX_LENGTH} 個字。`,
  payment_state_changed: "付款狀態已更新，無法再修改。",
  save_failed: "暫時無法儲存，請稍後再試。",
};

export function transferFail(code: SaveTransferNoteErrorCode): SaveTransferNoteResult {
  return { ok: false, code, message: transferNoteMessages[code] };
}

// 單行備註：換行與連續空白一律收成一個空白，再 trim。回傳 null 代表超過長度上限。
function normalizeTransferNote(note: string | null | undefined): string | null | "too_long" {
  const normalized = (note ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length > TRANSFER_NOTE_MAX_LENGTH) {
    return "too_long";
  }

  return normalized.length > 0 ? normalized : null;
}

// 只有該筆報名的學員本人可寫；寫入是「帶條件的原子更新」：報名仍有效（pending／confirmed）且付款狀態仍是 unpaid
// 才會成功。老師標記已收款的同時學員送出修改，只有先到的那一個生效，不會覆寫。
// 填寫備註不改變 paymentStatus 或 EnrollmentStatus；空字串代表清除。
export async function saveTransferNoteCore(
  userId: string,
  enrollmentId: string,
  note: string | null | undefined,
): Promise<SaveTransferNoteResult> {
  const normalized = normalizeTransferNote(note);

  if (normalized === "too_long") {
    return transferFail("transfer_note_too_long");
  }

  try {
    const updated = await prisma.enrollment.updateMany({
      where: { id: enrollmentId, userId, status: { in: ["pending", "confirmed"] }, paymentStatus: "unpaid" },
      data: { transferNote: normalized },
    });

    if (updated.count === 1) {
      return { ok: true };
    }

    const own = await prisma.enrollment.findFirst({ where: { id: enrollmentId, userId }, select: { id: true } });

    return own ? transferFail("payment_state_changed") : transferFail("enrollment_not_found");
  } catch (error) {
    console.error("[payment] save transfer note failed", error);

    return transferFail("save_failed");
  }
}

// 整期學員的轉帳備註：套用到這個整期報名底下仍有效且尚未付款的每一堂（學員只需填一次）。
export async function saveTermTransferNoteCore(
  userId: string,
  seriesEnrollmentId: string,
  note: string | null | undefined,
): Promise<SaveTransferNoteResult> {
  const normalized = normalizeTransferNote(note);

  if (normalized === "too_long") {
    return transferFail("transfer_note_too_long");
  }

  try {
    const updated = await prisma.enrollment.updateMany({
      where: { seriesEnrollmentId, userId, status: { in: ["pending", "confirmed"] }, paymentStatus: "unpaid" },
      data: { transferNote: normalized },
    });

    if (updated.count >= 1) {
      return { ok: true };
    }

    const own = await prisma.enrollment.findFirst({ where: { seriesEnrollmentId, userId }, select: { id: true } });

    return own ? transferFail("payment_state_changed") : transferFail("enrollment_not_found");
  } catch (error) {
    console.error("[payment] save term transfer note failed", error);

    return transferFail("save_failed");
  }
}
