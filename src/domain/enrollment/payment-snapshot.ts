// lightweight-payment-v0（付款計畫第 0 節與 §6）：報名建立當下的「付款相關快照」。
//
// 學員在「我的報名」看到的收款帳號、繳費規則、聯絡方式與價格，一律是報名當下複製的版本，不是老師現在的資料；
// 老師之後修改只影響之後的新報名。這個檔案只負責「組出快照」與「重新報名時處理付款欄位」，不做任何權限判斷，
// 呼叫端（各條報名建立路徑）必須在自己的 transaction 內呼叫。

import type { Prisma } from "@prisma/client";

export type EnrollmentPaymentSnapshot = {
  paymentAccountInfoSnapshot: string | null;
  paymentRulesSnapshot: string | null;
  contactInfoSnapshot: string | null;
  priceNoteSnapshot: string | null;
};

export const EMPTY_PAYMENT_SNAPSHOT: EnrollmentPaymentSnapshot = {
  paymentAccountInfoSnapshot: null,
  paymentRulesSnapshot: null,
  contactInfoSnapshot: null,
  priceNoteSnapshot: null,
};

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

// 單堂與持續開課：priceNote 取該場；期班（kind = term）取系列 priceNote（呼叫端決定傳哪一個）。
// 團主媒合的課程沒有 priceNote 時，沿用已選定老師回應的 proposedPrice（付款計畫 P5）。
export async function buildEnrollmentPaymentSnapshot(
  tx: Prisma.TransactionClient,
  input: { teacherProfileId: string; priceNote: string | null; demandRequestId?: string | null },
): Promise<EnrollmentPaymentSnapshot> {
  const teacher = await tx.teacherProfile.findUnique({
    where: { id: input.teacherProfileId },
    select: { paymentAccountInfo: true, paymentRulesText: true, contactInfo: true },
  });

  let priceNote = normalize(input.priceNote);

  if (!priceNote && input.demandRequestId) {
    const selected = await tx.demandResponse.findFirst({
      where: { demandRequestId: input.demandRequestId, teacherProfileId: input.teacherProfileId, status: "selected" },
      select: { proposedPrice: true },
    });

    priceNote = normalize(selected?.proposedPrice);
  }

  return {
    paymentAccountInfoSnapshot: normalize(teacher?.paymentAccountInfo),
    paymentRulesSnapshot: normalize(teacher?.paymentRulesText),
    contactInfoSnapshot: normalize(teacher?.contactInfo),
    priceNoteSnapshot: priceNote,
  };
}

// 補課：沿用該整期報名「建立當下」的快照（付款計畫 §6）。來源固定為同一整期報名底下
// seriesEnrollmentSource = term_created 的列中 createdAt、id 升冪的第一筆；沒有 term_created 的列
// （整期建立時所有場次都已有單堂報名被併入）時，改取同一整期報名底下最早的一列。找不到就回空快照。
export async function readTermPaymentSnapshot(
  tx: Prisma.TransactionClient,
  seriesEnrollmentId: string,
): Promise<EnrollmentPaymentSnapshot> {
  const select = {
    paymentAccountInfoSnapshot: true,
    paymentRulesSnapshot: true,
    contactInfoSnapshot: true,
    priceNoteSnapshot: true,
  } as const;
  const orderBy = [{ createdAt: "asc" as const }, { id: "asc" as const }];

  const created = await tx.enrollment.findFirst({
    where: { seriesEnrollmentId, seriesEnrollmentSource: "term_created" },
    orderBy,
    select,
  });

  if (created) {
    return created;
  }

  const earliest = await tx.enrollment.findFirst({ where: { seriesEnrollmentId }, orderBy, select });

  return earliest ?? EMPTY_PAYMENT_SNAPSHOT;
}

// 重新報名（取消後回到有效）與取消請假恢復時的付款處理（付款計畫 §2）：
// - unpaid／paid：保留付款狀態、稽核欄位與既有快照，不做任何事；
// - refunded：款項已退回，視為新的一筆交易。狀態機只允許 unpaid → paid → refunded，所以這裡是唯一的
//   refunded → unpaid 入口（內部流程，沒有手動入口）：先把前一輪完整內容寫進 reset_on_re_enrollment 事件的
//   previousRound，再清除「目前這一輪」的付款欄位與 transferNote，並換成新的快照。
// 必須在「報名已改回有效狀態」之後、同一個 transaction 內呼叫（該列已被更新鎖住，讀到的是一致的內容）。
export async function applyReEnrollmentPaymentRule(
  tx: Prisma.TransactionClient,
  input: { enrollmentId: string; actorUserId: string; freshSnapshot: EnrollmentPaymentSnapshot },
): Promise<{ reset: boolean }> {
  const current = await tx.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: {
      paymentStatus: true,
      paymentAccountInfoSnapshot: true,
      paymentRulesSnapshot: true,
      contactInfoSnapshot: true,
      priceNoteSnapshot: true,
      transferNote: true,
      paymentNote: true,
      paymentConfirmedAt: true,
      paymentConfirmedByUserId: true,
      paymentConfirmedByRole: true,
      paymentRefundedAt: true,
      paymentRefundedByUserId: true,
      paymentRefundedByRole: true,
      paymentRefundReason: true,
    },
  });

  if (!current || current.paymentStatus !== "refunded") {
    return { reset: false };
  }

  const cleared = await tx.enrollment.updateMany({
    where: { id: input.enrollmentId, paymentStatus: "refunded" },
    data: {
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
      ...input.freshSnapshot,
    },
  });

  if (cleared.count !== 1) {
    return { reset: false };
  }

  await tx.enrollmentPaymentEvent.create({
    data: {
      enrollmentId: input.enrollmentId,
      type: "reset_on_re_enrollment",
      actorUserId: input.actorUserId,
      actorRole: null,
      previousRound: {
        paymentStatus: current.paymentStatus,
        paymentAccountInfoSnapshot: current.paymentAccountInfoSnapshot,
        paymentRulesSnapshot: current.paymentRulesSnapshot,
        contactInfoSnapshot: current.contactInfoSnapshot,
        priceNoteSnapshot: current.priceNoteSnapshot,
        transferNote: current.transferNote,
        paymentNote: current.paymentNote,
        paymentConfirmedAt: current.paymentConfirmedAt?.toISOString() ?? null,
        paymentConfirmedByUserId: current.paymentConfirmedByUserId,
        paymentConfirmedByRole: current.paymentConfirmedByRole,
        paymentRefundedAt: current.paymentRefundedAt?.toISOString() ?? null,
        paymentRefundedByUserId: current.paymentRefundedByUserId,
        paymentRefundedByRole: current.paymentRefundedByRole,
        paymentRefundReason: current.paymentRefundReason,
      },
    },
  });

  return { reset: true };
}
