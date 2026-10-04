import { cookies, headers } from "next/headers";

import { sanitizeCallbackUrl } from "./callback-url";

// member-flow-redesign 票 05：記住「這次登入完要回哪裡」。Auth.js 在 Google 取消或失敗時只會帶
// ?error=<代碼> 回到 /sign-in，原本的 callbackUrl 會遺失，所以每次送出登入前自己記一份。
// - 每一次送出登入都覆寫（課程頁、/sign-in、錯誤畫面的重試），不同入口不會沿用上一次的目的地。
// - 20 分鐘：長於 Auth.js 登入流程 cookie 的 15 分鐘。
// - 只存經 sanitizeCallbackUrl 過濾的站內路徑，讀出時再過濾一次；不存個資。
const SIGN_IN_RETURN_COOKIE = "fsy_sign_in_return";
const SIGN_IN_RETURN_MAX_AGE_SECONDS = 60 * 20;

export async function rememberSignInReturn(destination: string): Promise<void> {
  const safeDestination = sanitizeCallbackUrl(destination) ?? "/";
  const forwardedProto = (await headers()).get("x-forwarded-proto");

  (await cookies()).set(SIGN_IN_RETURN_COOKIE, safeDestination, {
    httpOnly: true,
    maxAge: SIGN_IN_RETURN_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: forwardedProto === "https",
  });
}

export async function readSignInReturn(): Promise<string | null> {
  return sanitizeCallbackUrl((await cookies()).get(SIGN_IN_RETURN_COOKIE)?.value);
}
