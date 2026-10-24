// teacher-first-run 票 03（spec「收款提醒」）：開放報名前的收款資訊提醒。
//
// 學員報名成立時，拿到的是老師「當下」的收款帳號快照（lightweight-payment-v0）；之後老師補填，
// 已報名的人不會更新。所以每個會讓課程開始收報名的老師端入口，都在按下之前用這裡判斷要不要提醒。
// 帳號與規則分開判斷：只填了規則、沒填帳號，也要提醒帳號。提醒只是說明，不擋操作（現金、免費課程）。
// 這裡是純函式，各入口共用；讀取老師本人設定在 payment-settings.ts 的 getOwnPaymentInfoReminder。

export const PAYMENT_SETTINGS_HREF = "/teacher/profile/payment";

export type PaymentInfoReminder = {
  // 缺哪個列哪個，順序固定：帳號在前。
  missingItems: string[];
};

export function buildPaymentInfoReminder(settings: {
  paymentAccountInfo: string | null;
  paymentRulesText: string | null;
}): PaymentInfoReminder | null {
  const missingAccount = !settings.paymentAccountInfo?.trim();
  const missingRules = !settings.paymentRulesText?.trim();

  if (!missingAccount && !missingRules) {
    return null;
  }

  return {
    missingItems: [
      ...(missingAccount ? ["還沒填收款帳號"] : []),
      ...(missingRules ? ["還沒填繳費與取消規則"] : []),
    ],
  };
}

export const PAYMENT_REMINDER_SNAPSHOT_NOTE =
  "學員報名時會看到你當下填的收款資訊，之後補填不會更新給已報名的人。現金收費或免費的課可以不填，直接開放報名。";
