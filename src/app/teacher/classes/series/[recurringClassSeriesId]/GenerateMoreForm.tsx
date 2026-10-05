"use client";

import { useEffect, useRef } from "react";

import { PendingSubmitButton } from "../../_components/PendingSubmitButton";

// teacher-class-scheduling 票 01：「生成更多」多一個「建立後全部開放報名」勾選框。
// 預設沿用老師上次在「這個系列」的選擇，只記在這台瀏覽器（localStorage），不存進資料庫；
// 讀不到（私密視窗、被封鎖）時預設不勾，行為與既有一致。
export function GenerateMoreForm({
  action,
  recurringClassSeriesId,
  dayLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  recurringClassSeriesId: string;
  dayLabel: string;
}) {
  const storageKey = `teacher-series-open-on-generate:${recurringClassSeriesId}`;
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      // 掛載後才把瀏覽器記憶套到勾選框上，避免伺服器與瀏覽器第一次畫面不一致。
      if (checkboxRef.current) {
        checkboxRef.current.checked = window.localStorage.getItem(storageKey) === "yes";
      }
    } catch {
      // 讀不到就維持預設（不勾）。
    }
  }, [storageKey]);

  function handleChange(checked: boolean) {
    try {
      window.localStorage.setItem(storageKey, checked ? "yes" : "no");
    } catch {
      // 存不了也不影響這次送出。
    }
  }

  return (
    <form action={action} className="grid gap-3">
      <input name="recurringClassSeriesId" type="hidden" value={recurringClassSeriesId} />
      <label className="text-sm font-medium text-ink" htmlFor="count">
        生成更多場次
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-h-11 w-24 rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
          defaultValue={8}
          id="count"
          max={26}
          min={1}
          name="count"
          required
          type="number"
        />
        <PendingSubmitButton className="min-h-11 rounded-full border border-ink/25 px-5 py-2 text-sm font-medium text-ink transition hover:border-pine/40 hover:bg-pine-tint">
          生成
        </PendingSubmitButton>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-6 text-ink">
        <input
          className="h-4 w-4 shrink-0 accent-pine"
          defaultChecked={false}
          name="openForEnrollment"
          onChange={(event) => handleChange(event.target.checked)}
          ref={checkboxRef}
          type="checkbox"
          value="yes"
        />
        建立後全部開放報名
      </label>
      <p className="text-xs leading-5 text-ink-faint">
        從目前最後一場之後，依每{dayLabel}繼續生成。沒有勾選時，新場次會先存成草稿，之後可以按「全部開放報名」。
      </p>
    </form>
  );
}
