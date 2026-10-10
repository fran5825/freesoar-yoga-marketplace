// lightweight-payment-v0（付款計畫 P4）：老師自己填寫的收款帳號、繳費規則與聯絡方式。
//
// 刻意獨立於 teacher-profile/service.ts 的「個人資料」流程：這三個欄位是私人的收款資訊，修改不應該
// 觸發任何審核或影響老師申請狀態，也不出現在個人資料頁、老師列表或任何公開頁。
// - paymentRulesText：報名前就顯示在課程頁（不是敏感資料）。
// - paymentAccountInfo、contactInfo：只在學員成功報名後，以「報名當下快照」顯示給該學員。

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  CONTACT_INFO_MAX_LENGTH,
  PAYMENT_ACCOUNT_INFO_MAX_LENGTH,
  PAYMENT_RULES_TEXT_MAX_LENGTH,
} from "./payment-settings-limits";


export type OwnPaymentSettings = {
  paymentAccountInfo: string;
  paymentRulesText: string;
  contactInfo: string;
};

export type OwnPaymentSettingsView =
  | { state: "ok"; settings: OwnPaymentSettings }
  | { state: "not_available" };

// 只有已通過審核（或暫停中、仍可管理自己既有課程）的老師有這個頁面。
export async function getOwnPaymentSettings(): Promise<OwnPaymentSettingsView> {
  const currentUser = await requireUser();
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { status: true, paymentAccountInfo: true, paymentRulesText: true, contactInfo: true },
  });

  if (!profile || (profile.status !== "approved" && profile.status !== "suspended")) {
    return { state: "not_available" };
  }

  return {
    state: "ok",
    settings: {
      paymentAccountInfo: profile.paymentAccountInfo ?? "",
      paymentRulesText: profile.paymentRulesText ?? "",
      contactInfo: profile.contactInfo ?? "",
    },
  };
}

export type UpdateOwnPaymentSettingsInput = {
  paymentAccountInfo?: string | null;
  paymentRulesText?: string | null;
  contactInfo?: string | null;
};

export type UpdateOwnPaymentSettingsResult =
  | { ok: true }
  | {
      ok: false;
      code: "authentication_required" | "not_available" | "too_long" | "update_failed";
      message: string;
      field?: keyof OwnPaymentSettings;
    };

function normalize(value: string | null | undefined): string | null {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();

  return text.length > 0 ? text : null;
}

export async function updateOwnPaymentSettings(
  input: UpdateOwnPaymentSettingsInput,
): Promise<UpdateOwnPaymentSettingsResult> {
  let userId: string;

  try {
    userId = (await requireUser()).id;
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return { ok: false, code: "authentication_required", message: "請先登入。" };
    }

    throw error;
  }

  const paymentAccountInfo = normalize(input.paymentAccountInfo);
  const paymentRulesText = normalize(input.paymentRulesText);
  const contactInfo = normalize(input.contactInfo);

  const limits: { field: keyof OwnPaymentSettings; value: string | null; max: number; label: string }[] = [
    { field: "paymentAccountInfo", value: paymentAccountInfo, max: PAYMENT_ACCOUNT_INFO_MAX_LENGTH, label: "收款帳號" },
    { field: "paymentRulesText", value: paymentRulesText, max: PAYMENT_RULES_TEXT_MAX_LENGTH, label: "繳費與取消規則" },
    { field: "contactInfo", value: contactInfo, max: CONTACT_INFO_MAX_LENGTH, label: "聯絡方式" },
  ];

  for (const limit of limits) {
    if (limit.value && limit.value.length > limit.max) {
      return {
        ok: false,
        code: "too_long",
        field: limit.field,
        message: `${limit.label}不可超過 ${limit.max} 個字。`,
      };
    }
  }

  try {
    const updated = await prisma.teacherProfile.updateMany({
      where: { userId, status: { in: ["approved", "suspended"] } },
      data: { paymentAccountInfo, paymentRulesText, contactInfo },
    });

    if (updated.count !== 1) {
      return { ok: false, code: "not_available", message: "通過老師審核後，才能設定收款與聯絡資料。" };
    }

    return { ok: true };
  } catch (error) {
    console.error("[teacher-payment-settings] update failed", error);

    return { ok: false, code: "update_failed", message: "暫時無法儲存，請稍後再試。" };
  }
}
