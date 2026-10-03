"use client";

import { useState } from "react";

// 複製學員報名連結（/classes/<id>）。系列場次與不公開的單堂不會出現在「找課程」，
// 老師要把這個連結傳給學員；學員登入後就能打開並報名（既有讀取規則，不改權限）。
export function CopyEnrollLinkButton({
  classSessionId,
  label = "複製報名連結",
  ariaLabel,
  className = "min-h-11 rounded-full border border-pine/40 bg-white px-4 py-2 text-sm font-medium text-pine transition hover:bg-pine-tint",
}: {
  classSessionId: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [link, setLink] = useState("");

  async function copy() {
    const url = `${window.location.origin}/classes/${encodeURIComponent(classSessionId)}`;
    setLink(url);

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      // 瀏覽器不允許寫入剪貼簿時，把連結顯示出來讓老師手動複製。
      setStatus("failed");
    }
  }

  return (
    <div className="grid gap-1">
      <div>
        <button aria-label={ariaLabel} className={className} onClick={copy} type="button">
          {status === "copied" ? "已複製連結" : label}
        </button>
      </div>
      <p aria-live="polite" className="min-w-0 break-all text-xs leading-5 text-ink-soft">
        {status === "copied" ? "已複製，可以貼到 LINE 或訊息傳給學員。" : null}
        {status === "failed" ? (
          <>
            無法自動複製，請手動複製這個連結：
            <span className="select-all font-medium text-ink">{link}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
