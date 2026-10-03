"use client";

import { useId, useRef, type ReactNode } from "react";

import { PendingSubmitButton } from "./PendingSubmitButton";

// 老師課程的「先確認再執行」視窗（teacher-usability-redesign 票 03，票 05 系列沿用）。
// - 用原生 <dialog>：showModal 會把焦點鎖在視窗內，Escape 可關閉。
// - 打開時預設焦點在「先不要」，不放在破壞性按鈕上；關閉後焦點回到觸發按鈕。
// - 只有按下視窗裡的確認按鈕才會送出 form（呼叫 Server Action），按「先不要」或 Escape 不會寫入任何資料。
export function ConfirmActionDialog({
  triggerLabel,
  triggerAriaLabel,
  triggerClassName,
  title,
  children,
  confirmLabel,
  action,
  hiddenFields,
}: {
  triggerLabel: string;
  // 同一頁有多個同名按鈕時（例如每筆報名都有「婉拒」），用來說清楚是哪一筆。
  triggerAriaLabel?: string;
  triggerClassName: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function open() {
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        aria-label={triggerAriaLabel}
        className={triggerClassName}
        onClick={open}
        ref={triggerRef}
        type="button"
      >
        {triggerLabel}
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-ink/15 bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <div className="grid gap-4 p-5 sm:p-6">
          <h2 className="text-lg font-medium" id={titleId}>
            {title}
          </h2>
          <div className="grid gap-2 text-sm leading-6 text-ink-soft">{children}</div>
          <form action={action} className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            ))}
            <button
              className="min-h-11 rounded-full border border-ink/25 px-5 py-2 text-sm font-medium text-ink transition hover:bg-cream"
              onClick={close}
              ref={cancelRef}
              type="button"
            >
              先不要
            </button>
            <PendingSubmitButton className="min-h-11 rounded-full bg-clay px-5 py-2 text-sm font-medium text-white transition hover:bg-clay-deep">
              {confirmLabel}
            </PendingSubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
