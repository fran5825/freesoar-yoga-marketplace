import type { ReactNode } from "react";

import { RoleShell } from "@/app/_components/role-shell";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";

const approvedLinks = [
  { href: "/teacher/dashboard", label: "總覽" },
  { href: "/teacher/demands", label: "需求池" },
  { href: "/teacher/classes", label: "我的課程" },
  { href: "/teacher/availability", label: "可授課時間" },
  { href: "/teacher/profile", label: "老師資料" },
  { href: "/notifications", label: "通知" },
];

// 還沒通過審核（沒有資料、草稿、審核中、被退回、停權）的老師不能使用媒合功能，
// 所以導覽列也不放需求池、課程、可授課時間，只放總覽、老師資料、通知。
const limitedLinks = [
  { href: "/teacher/dashboard", label: "總覽" },
  { href: "/teacher/profile", label: "老師資料" },
  { href: "/notifications", label: "通知" },
];

// 老師專區外框。/teacher/* 由 layout.tsx 套用；老師（不是團主）開 /notifications 時由通知頁自己包這個。
export async function TeacherShell({ children }: { children: ReactNode }) {
  const teacherProfile = await getOwnTeacherProfileApplicationSnapshot();
  const isApproved = teacherProfile?.status === "approved";

  return (
    <RoleShell
      areaLabel="老師專區"
      links={isApproved ? approvedLinks : limitedLinks}
      primaryAction={
        isApproved
          ? { href: "/teacher/classes/new", label: "＋ 建立課程" }
          : undefined
      }
    >
      {children}
    </RoleShell>
  );
}
