"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

// admin-usability 票 05：危險操作（暫停老師、取消整堂課、取消報名）的共用確認視窗。
// 放在 <form> 裡當「送出」按鈕用：先檢查表單欄位（例如必填的原因）有沒有填好，沒填好就用瀏覽器
// 自己的提示擋下，不會跳確認視窗；填好才跳視窗說明後果，按「確認」才真的送出表單。
// 用瀏覽器內建的 <dialog>（showModal）：自帶鍵盤 Esc 關閉、焦點鎖在視窗內。初始焦點在「返回」，
// 避免管理員連按 Enter 就誤送出。
export function AdminConfirmButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  triggerClassName,
  pending,
  pendingLabel,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  triggerClassName?: string;
  // 第二批票 07／08：「處理中」狀態。有傳時以呼叫端為準（例如 useActionState 的 isPending，
  // 用在自行 onSubmit 送出的表單）；沒傳時用 useFormStatus 追蹤所在表單的送出。
  // 兩種都會在請求結束後解除停用，失敗時可以重試，不會像以前一樣送出後永久停用。
  pending?: boolean;
  pendingLabel?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formStatus = useFormStatus();
  const isSubmitting = pending ?? formStatus.pending;
  // 同一頁可能有多個確認視窗（每筆報名各一個），標題 id 不能寫死。
  const titleId = useId();

  function openDialog() {
    const form = triggerRef.current?.form;

    if (form && !form.reportValidity()) {
      return;
    }

    dialogRef.current?.showModal();
  }

  function confirm() {
    dialogRef.current?.close();
    triggerRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <button
        className={
          triggerClassName ??
          "w-full rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
        }
        disabled={isSubmitting}
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        {isSubmitting && pendingLabel ? pendingLabel : triggerLabel}
      </button>
      <dialog
        aria-labelledby={titleId}
        // 不論按返回、Esc 或點背景關閉，焦點都回到觸發按鈕，鍵盤使用者不會迷路。
        onClose={() => triggerRef.current?.focus()}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-ink/15 bg-white p-6 text-ink shadow-lg backdrop:bg-ink/40"
        onClick={(event) => {
          // 點到視窗外的半透明背景 = 返回。
          if (event.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
        ref={dialogRef}
      >
        <h2 className="wrap-anywhere text-lg font-semibold text-ink" id={titleId}>
          {title}
        </h2>
        <p className="mt-3 wrap-anywhere text-sm leading-6 text-ink-soft">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            autoFocus
            className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            返回
          </button>
          <button
            className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            onClick={confirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
