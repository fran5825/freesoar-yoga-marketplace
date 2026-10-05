"use client";

import { useState, useSyncExternalStore } from "react";

// organizer-usability-redesign 票 13：開放報名後的主要動作是複製「完整」報名連結（含網域），
// 不是只顯示相對路徑。網域取自目前瀏覽器網址，與團主實際打開的站一致；伺服器端先顯示路徑，
// 載入後換成完整網址。複製成功／失敗都用 aria-live 告知，失敗時把連結選起來讓團主手動複製。
const subscribeToNothing = () => () => {};

export function ClassShareLink({ classSessionId }: { classSessionId: string }) {
  const path = `/classes/${encodeURIComponent(classSessionId)}`;
  // 網域只在瀏覽器取得；伺服器端 render 時沒有 window，先顯示路徑。
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium text-ink">
        報名連結
        <input
          aria-describedby="class-share-status"
          className="min-w-0 rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm font-normal text-ink"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          type="text"
          value={url}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          onClick={copy}
          type="button"
        >
          {status === "copied" ? "已複製連結" : "複製報名連結"}
        </button>
        <a className="py-2 text-sm font-medium text-clay underline-offset-4 hover:underline" href={path}>
          開啟課程頁
        </a>
        <a className="py-2 text-sm font-medium text-clay underline-offset-4 hover:underline" href="#roster">
          看報名名單
        </a>
      </div>
      <p aria-live="polite" className="min-w-0 break-all text-sm leading-6 text-ink-soft" id="class-share-status">
        {status === "copied" ? "已複製，可以貼到 LINE 或群組傳給團員。" : null}
        {status === "failed" ? "無法自動複製，請點上面的連結欄位，全選後手動複製。" : null}
      </p>
    </div>
  );
}
