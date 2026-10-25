import Link from "next/link";

import {
  PAYMENT_REMINDER_SNAPSHOT_NOTE,
  PAYMENT_SETTINGS_HREF,
  type PaymentInfoReminder,
} from "@/domain/teacher-profile/payment-reminder";

// teacher-first-run 票 03：開放報名前的收款資訊提醒，放在每個會開始收報名的按鈕之前。
// 只是提醒，不擋操作；判斷在 domain（buildPaymentInfoReminder），這裡只負責顯示。
// 沒有 "use client"，伺服器頁面與建課表單（client component）都可以用。
// openInNewTab：建課表單上用，避免老師點去填收款資訊時離開還沒送出的表單。
// returnTo：課程頁、系列頁傳自己的網址，儲存收款資訊後回到這一頁（wrong-route-fixes F9-1）。
export function PaymentInfoReminderNotice({
  reminder,
  openInNewTab = false,
  returnTo,
}: {
  reminder: PaymentInfoReminder | null;
  openInNewTab?: boolean;
  returnTo?: string;
}) {
  if (!reminder) {
    return null;
  }

  const href = returnTo && !openInNewTab ? `${PAYMENT_SETTINGS_HREF}?returnTo=${encodeURIComponent(returnTo)}` : PAYMENT_SETTINGS_HREF;

  return (
    <div
      aria-label="收款資訊提醒"
      className="grid gap-1 rounded-xl border border-gold/30 bg-gold-tint px-4 py-3 text-sm leading-6 text-gold-deep"
      role="note"
    >
      <p className="font-medium">開放報名前，先看一下收款資訊：{reminder.missingItems.join("、")}。</p>
      <p>{PAYMENT_REMINDER_SNAPSHOT_NOTE}</p>
      <p>
        <Link
          className="inline-flex min-h-11 items-center font-medium underline"
          href={href}
          {...(openInNewTab ? { rel: "noopener", target: "_blank" } : {})}
        >
          到「收款與聯絡」填寫{openInNewTab ? "（開新分頁）" : ""}
        </Link>
      </p>
    </div>
  );
}
