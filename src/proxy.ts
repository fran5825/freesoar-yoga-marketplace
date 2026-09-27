import { NextResponse, type NextRequest } from "next/server";

import {
  LAST_ROLE_COOKIE,
  LAST_ROLE_MAX_AGE_SECONDS,
  lastRoleFromPath,
} from "@/lib/navigation/last-role-cookie";

// signed-in-navigation 票 01：進入學員、老師、團主、管理後台任一專區時，記下「上次身分」。
// 只寫一個存身分代號的 cookie，不碰登入 session，也不做任何權限判斷——各專區自己的
// 身分檢查照舊，cookie 讀出來時也會再確認這個身分是否仍有效（src/lib/navigation/last-role.ts）。
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const role = lastRoleFromPath(request.nextUrl.pathname);

  if (role && request.cookies.get(LAST_ROLE_COOKIE)?.value !== role) {
    response.cookies.set(LAST_ROLE_COOKIE, role, {
      httpOnly: true,
      maxAge: LAST_ROLE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}

export const config = {
  matcher: ["/member/:path*", "/teacher/:path*", "/organizer/:path*", "/admin/:path*"],
};
