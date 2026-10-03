"use client";

import { useFormStatus } from "react-dom";

// 老師課程操作的送出按鈕（teacher-usability-redesign 票 03）：送出中停用並顯示「處理中…」，
// 避免網路慢時連按造成重複操作。必須放在 <form> 裡面。
export function PendingSubmitButton({
  children,
  className,
  pendingLabel = "處理中…",
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
