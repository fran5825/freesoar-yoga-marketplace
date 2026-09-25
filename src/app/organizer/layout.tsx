import type { ReactNode } from "react";

import { OrganizerShell } from "./_components/OrganizerShell";

// 2026-09-25 organizer-usability 第 1 批：/organizer/* 全部頁面共用的導覽列與頁寬（max-w-4xl），
// 各頁面本身不再自己設定寬度。
export default function OrganizerLayout({ children }: { children: ReactNode }) {
  return <OrganizerShell>{children}</OrganizerShell>;
}
