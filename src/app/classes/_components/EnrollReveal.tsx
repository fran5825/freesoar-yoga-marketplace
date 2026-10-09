"use client";

import { useState, type ReactNode } from "react";

// teacher-class-scheduling 票 14（Q3、Q5、Q13）：「我要報名」按下後才在同一個位置展開報名表單。
// 登入回來（網址帶 enroll=1）或手機底部按鈕帶回來時，伺服器傳入 defaultOpen，表單直接展開，
// 仍由本人勾選同意後送出，不會自動報名。
export function EnrollReveal({
  defaultOpen,
  hint,
  children,
}: {
  defaultOpen: boolean;
  // 按鈕旁的說明，例如「送出即成立」或「需老師確認」。
  hint: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (open) {
    return <div className="grid gap-4">{children}</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-pine px-6 py-3 text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
        onClick={() => setOpen(true)}
        type="button"
      >
        我要報名
      </button>
      <span className="text-sm text-ink-soft">{hint}</span>
    </div>
  );
}

// 備註預設收起（Q4），點「加備註」才出現。
export function OptionalNotes({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <button className="min-h-11 text-sm font-medium text-pine underline" onClick={() => setOpen(true)} type="button">
          加備註
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink" htmlFor={id}>
        備註（選填）
      </label>
      <p className="mt-1 text-xs leading-5 text-ink-soft">例如身體狀況提醒，讓老師更了解你的需求。</p>
      <textarea
        autoFocus
        className="mt-2 min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink focus-visible:outline-2 focus-visible:outline-pine"
        id={id}
        maxLength={500}
        name="notes"
      />
    </div>
  );
}
