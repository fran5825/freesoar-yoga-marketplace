"use client";

import { useState, type ReactNode } from "react";

// inline-member-enroll 票 06：場次列的「按下按鈕、在列下方展開」。按鈕放在列的右側（名額旁邊），
// 展開內容（報名表單或登入選項）出現在整列下方。defaultOpen：登入回來或送出失敗時由伺服器指定直接展開。
export function RowExpander({
  main,
  aside,
  buttonLabel,
  defaultOpen,
  children,
}: {
  main: ReactNode;
  aside: ReactNode;
  buttonLabel: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">{main}</div>
        <div className="flex flex-wrap items-center gap-3">
          {aside}
          <button
            aria-expanded={open}
            className={
              open
                ? "inline-flex min-h-11 items-center rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine hover:bg-pine-tint focus-visible:outline-2 focus-visible:outline-pine"
                : "inline-flex min-h-11 items-center rounded-full bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            }
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? "收起" : buttonLabel}
          </button>
        </div>
      </div>
      {open ? <div className="grid gap-4 border-t border-ink/10 pt-4">{children}</div> : null}
    </>
  );
}
