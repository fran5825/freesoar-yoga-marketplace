import type { ReactNode } from "react";

import { RoleShell } from "@/app/_components/role-shell";

const memberLinks = [
  { href: "/classes", label: "找課程" },
  { href: "/member/enrollments", label: "我的報名" },
  { href: "/notifications", label: "通知" },
];

// 學員專區外框。/member/* 由 layout.tsx 套用；學員（不是團主、老師）開 /notifications 時由通知頁自己包這個。
export function MemberShell({ children }: { children: ReactNode }) {
  return (
    <RoleShell areaLabel="學員專區" links={memberLinks}>
      {children}
    </RoleShell>
  );
}
