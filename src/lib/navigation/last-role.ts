import { cookies } from "next/headers";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import {
  LAST_ROLE_COOKIE,
  LAST_ROLE_HOME,
  parseLastRole,
  type LastRole,
} from "./last-role-cookie";

// 讀出目前登入者的上次身分；cookie 沒有、看不懂，或那個身分已不能用（例如管理員權限被取消、
// 沒有老師資料），一律回學員——每個登入的人都一定是學員（docs/signed-in-navigation-plan.md 決策 8）。
// 身分判斷沿用 getRoleSwitchOptions 的規則：有團主資料才算團主、有老師資料（任何狀態）才算老師、
// User.isAdmin 才算管理員。這裡只決定「導到哪裡／顯示哪個外框」，不改任何權限。
export async function getLastRole(): Promise<LastRole> {
  const cookieStore = await cookies();
  const remembered = parseLastRole(cookieStore.get(LAST_ROLE_COOKIE)?.value);

  if (!remembered || remembered === "member") {
    return "member";
  }

  if (remembered === "admin") {
    const user = await getCurrentUser();
    return user?.isAdmin ? "admin" : "member";
  }

  if (remembered === "teacher") {
    return (await getOwnTeacherProfileApplicationSnapshot()) ? "teacher" : "member";
  }

  return (await getOwnOrganizerContext()) ? "organizer" : "member";
}

export async function getLastRoleHome(): Promise<string> {
  return LAST_ROLE_HOME[await getLastRole()];
}
