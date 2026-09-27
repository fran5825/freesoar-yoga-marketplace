import type { ReactNode } from "react";

import { RoleShell } from "@/app/_components/role-shell";

const memberLinks = [
  { href: "/member/dashboard", label: "總覽" },
  { href: "/classes", label: "找課程" },
  { href: "/member/enrollments", label: "我的報名" },
  { href: "/member/notifications", label: "通知" },
];

// 學員專區外框。/member/* 由 layout.tsx 套用（含 /member/notifications）；登入後的課程頁、
// 還沒有老師或團主資料時的老師合作／發起團課頁，以及上次身分是學員時的共用頁也用這個。
export function MemberShell({ children }: { children: ReactNode }) {
  return (
    <RoleShell areaLabel="學員專區" links={memberLinks}>
      {children}
    </RoleShell>
  );
}
