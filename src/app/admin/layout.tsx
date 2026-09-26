import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";

import { AdminShell } from "./_components/AdminShell";

// 2026-09-26 admin-usability 票 01：/admin/* 全部頁面共用的導覽列與頁寬。
// 這裡也擋一次非管理員：不然頁面內 notFound() 時，導覽列（含管理後台連結）會先被外框畫出來。
// 各頁自己的 requireAdmin() 仍保留，是第二道把關。
export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  return <AdminShell>{children}</AdminShell>;
}
