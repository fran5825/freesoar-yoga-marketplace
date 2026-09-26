import type { ReactNode } from "react";

import { RoleShell } from "@/app/_components/role-shell";

const links = [
  { href: "/admin/dashboard", label: "總覽" },
  { href: "/admin/teachers", label: "老師" },
  { href: "/admin/demands", label: "需求" },
  { href: "/admin/classes", label: "課程" },
  { href: "/admin/organizations", label: "團體" },
];

// 管理後台外框。/admin/* 由 layout.tsx 套用，導覽列與頁寬（max-w-4xl）在這裡統一，各頁不再自己設定。
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RoleShell areaLabel="管理後台" links={links}>
      {children}
    </RoleShell>
  );
}
