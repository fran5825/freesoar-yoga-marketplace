import type { ReactNode } from "react";

import { getLastRole } from "@/lib/navigation/last-role";

import { AdminShell } from "../admin/_components/AdminShell";
import { MemberShell } from "../member/_components/MemberShell";
import { OrganizerShell } from "../organizer/_components/OrganizerShell";
import { TeacherShell } from "../teacher/_components/TeacherShell";

// signed-in-navigation 決策 3：不屬於任何專區的頁面（關於、FAQ、共用的 /notifications 等），
// 登入後用「上次身分」的專區外框。只給已登入的人用；訪客請繼續用公開 header。
// getLastRole() 已確認身分仍有效（管理員也會再確認 isAdmin），這裡不需要再檢查。
export async function LastRoleShell({ children }: { children: ReactNode }) {
  const role = await getLastRole();

  if (role === "admin") return <AdminShell>{children}</AdminShell>;
  if (role === "teacher") return <TeacherShell>{children}</TeacherShell>;
  if (role === "organizer") return <OrganizerShell>{children}</OrganizerShell>;

  return <MemberShell>{children}</MemberShell>;
}
