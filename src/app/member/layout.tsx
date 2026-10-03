import type { ReactNode } from "react";

import { RememberLastRole } from "../_components/remember-last-role";

import { MemberShell } from "./_components/MemberShell";

// /member/* 全部頁面共用的導覽列與頁寬（max-w-4xl），各頁面本身不再自己設定寬度。
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <MemberShell>
      <RememberLastRole role="member" />
      {children}
    </MemberShell>
  );
}
