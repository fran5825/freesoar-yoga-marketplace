import { NextResponse, type NextRequest } from "next/server";

import {
  LAST_ROLE_COOKIE,
  lastRoleCookieOptions,
  lastRoleFromPath,
} from "@/lib/navigation/last-role-cookie";

// signed-in-navigation 票 01：進入學員、老師、團主、管理後台任一專區時，記下「上次身分」。
// 只寫一個存身分代號的 cookie，不碰登入 session，也不做任何權限判斷——各專區自己的
// 身分檢查照舊，cookie 讀出來時也會再確認這個身分是否仍有效（src/lib/navigation/last-role.ts）。
//
// member-flow-redesign 票 01：這裡只記「整頁載入」。站內換頁與背景預先載入（prefetch）在 proxy
// 看來完全一樣（Next.js 會先拿掉 prefetch header），若照樣寫，老師只是逛了套學員外框的 /classes，
// 導覽列的 /member/* 被預先載入就會改成學員。站內換頁改由各專區 layout 的 RememberLastRole 記錄。
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const role = lastRoleFromPath(request.nextUrl.pathname);

  if (role && isDocumentRequest(request) && request.cookies.get(LAST_ROLE_COOKIE)?.value !== role) {
    response.cookies.set(
      LAST_ROLE_COOKIE,
      role,
      lastRoleCookieOptions(request.nextUrl.protocol === "https:"),
    );
  }

  return response;
}

// 瀏覽器整頁載入帶 sec-fetch-dest: document；預先載入與站內換頁都是 empty。
// 沒有這個 header 的（非瀏覽器）請求維持原本行為。
function isDocumentRequest(request: NextRequest): boolean {
  const destination = request.headers.get("sec-fetch-dest");
  return destination === null || destination === "document";
}

export const config = {
  matcher: ["/member/:path*", "/teacher/:path*", "/organizer/:path*", "/admin/:path*"],
};
