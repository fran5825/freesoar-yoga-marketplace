import type { ReactNode } from "react";

import { RoleShell } from "@/app/_components/role-shell";

const links = [
  { href: "/organizer/dashboard", label: "總覽" },
  { href: "/organizer/demands", label: "我的需求" },
  { href: "/organizer/classes", label: "我的課程" },
  { href: "/organizer/profile", label: "團主資料" },
  { href: "/notifications", label: "通知" },
];

// 團主專區外框。/organizer/* 由 layout.tsx 套用；團主開 /notifications 時由通知頁自己包這個。
export function OrganizerShell({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      areaLabel="團主專區"
      links={links}
      primaryAction={{ href: "/organizer/demands/new", label: "＋ 發起新需求" }}
    >
      {children}
    </RoleShell>
  );
}
