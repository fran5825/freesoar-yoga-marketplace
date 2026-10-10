"use client";

import { useState } from "react";

import { PAYMENT_RULES_TEXT_MAX_LENGTH } from "@/domain/teacher-profile/payment-settings-limits";

// 範例句只是幫老師起頭：點一下加到文字最後面，老師可以自己改。語氣溫和清楚，不用緊迫用語（voice-and-tone）。
const EXAMPLES = [
  "請於開課前 3 天內完成轉帳。",
  "轉帳後請填寫帳號後五碼，方便我對帳。",
  "開課前 48 小時取消，可全額退費。",
  "開課前 48 小時內取消，恕不退費，歡迎改報其他場次。",
  "有特殊情況請直接聯絡我，我們一起討論。",
] as const;

const controlClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

export function PaymentRulesField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);

  function insert(example: string) {
    setValue((current) => {
      const next = current.trim().length > 0 ? `${current.trimEnd()}\n${example}` : example;

      return next.slice(0, PAYMENT_RULES_TEXT_MAX_LENGTH);
    });
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink" htmlFor="paymentRulesText">
        繳費與取消規則（選填）
      </label>
      <p className="mt-1 text-xs leading-5 text-ink-faint">
        學員報名前就會在課程頁看到這段文字。沒填的話，課程頁不會顯示這一塊。
      </p>
      <textarea
        className={`${controlClassName} min-h-36`}
        id="paymentRulesText"
        maxLength={PAYMENT_RULES_TEXT_MAX_LENGTH}
        name="paymentRulesText"
        onChange={(event) => setValue(event.target.value)}
        placeholder="例如：請於開課前 3 天內完成轉帳；開課前 48 小時取消，可全額退費。"
        value={value}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-ink-faint">點一下加入範例句，再自己修改：</span>
        {EXAMPLES.map((example) => (
          <button
            className="inline-flex min-h-9 items-center rounded-full border border-ink/20 px-3 py-1.5 text-left text-xs text-ink-soft transition hover:border-pine hover:text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            key={example}
            onClick={() => insert(example)}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
