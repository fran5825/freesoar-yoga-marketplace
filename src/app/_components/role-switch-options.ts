import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

export type RoleSwitchOption = { href: string; label: string; isJoin?: boolean };

// 2026-09-26 admin-usability 票 02：導覽列「角色切換」要列出的身分。
// 判斷方式（2026-09-26 起 /account 已移除）（有團主資料才算團主、有老師資料才算老師），
// 管理員只有 User.isAdmin 為 true 的本人才看得到。只決定「顯示哪些連結」，
// 每個目標頁仍各自檢查身分，所以這裡不改任何權限。
export async function getRoleSwitchOptions(): Promise<RoleSwitchOption[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const [organizerContext, teacherProfile] = await Promise.all([
    getOwnOrganizerContext(),
    getOwnTeacherProfileApplicationSnapshot(),
  ]);

  const options: RoleSwitchOption[] = [
    { href: "/member/dashboard", label: "學員" },
  ];

  if (organizerContext) {
    options.push({ href: "/organizer/dashboard", label: "團主" });
  }

  if (teacherProfile) {
    options.push({ href: "/teacher/dashboard", label: "老師" });
  }

  if (user.isAdmin) {
    options.push({ href: "/admin/dashboard", label: "管理後台" });
  }

  // 還沒有的身分列成「＋ 成為…」連到申請頁：這取代原本 /account 入口中心的「開始成為…」卡片，
  // 讓只有學員身分的新使用者仍找得到加入團主、老師的入口。
  if (!organizerContext) {
    options.push({ href: "/organizers/request", label: "＋ 成為團主", isJoin: true });
  }

  if (!teacherProfile) {
    options.push({ href: "/teachers/join", label: "＋ 成為老師", isJoin: true });
  }

  return options;
}
