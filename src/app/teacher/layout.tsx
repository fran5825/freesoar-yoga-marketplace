import type { ReactNode } from "react";

import { TeacherShell } from "./_components/TeacherShell";

// 2026-09-25：/teacher/* 全部頁面共用的導覽列與頁寬（max-w-4xl），各頁面本身不再自己設定寬度。
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
