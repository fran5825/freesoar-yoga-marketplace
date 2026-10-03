"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// 送出後立刻變成不可按，直到這次請求（含失敗時留在原頁、成功時導向新頁）結束，避免連點兩下
// 同一個表單時，第二次送出撞到「這份申請已經被處理過」這類狀態衝突錯誤。
// 必須放在 <form action={...}> 裡面：useFormStatus 只看得到最近的父層表單，不能用在表單外。
export function AdminSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? (pendingLabel ?? "處理中…") : children}
    </button>
  );
}
