"use server";

import { cookies, headers } from "next/headers";

import { LAST_ROLE_COOKIE, lastRoleCookieOptions, parseLastRole } from "./last-role-cookie";

// member-flow-redesign 票 01：站內換頁進入專區時記下上次身分（整頁載入由 src/proxy.ts 記）。
// 讀「當下」的 cookie 再決定要不要寫：其他分頁可能已改掉 cookie，不能沿用 layout 畫出時的舊值。
// cookie 只是偏好、不代表權限；不是合法身分代號的值直接忽略。
export async function rememberLastRole(role: string): Promise<void> {
  const parsed = parseLastRole(role);
  if (!parsed) {
    return;
  }

  const cookieStore = await cookies();
  if (cookieStore.get(LAST_ROLE_COOKIE)?.value === parsed) {
    return;
  }

  const forwardedProto = (await headers()).get("x-forwarded-proto");
  cookieStore.set(LAST_ROLE_COOKIE, parsed, lastRoleCookieOptions(forwardedProto === "https"));
}
