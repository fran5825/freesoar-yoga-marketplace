import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { parseSignInProvider } from "@/lib/auth/sign-in-providers";
import { readSignInReturn, rememberSignInReturn } from "@/lib/auth/sign-in-return";
import { getLastRoleHome } from "@/lib/navigation/last-role";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import { SignInOptions } from "../_components/sign-in-options";

type SignInPageProps = {
  searchParams?: Promise<{ callbackUrl?: string; error?: string }>;
};

// member-flow-redesign 票 05：每次送出登入都先記下這次要回哪裡（Auth.js 失敗時不會帶回 callbackUrl），
// 只接受開放清單內的登入方式。
async function startSignInAction(formData: FormData): Promise<void> {
  "use server";

  const callbackValue = formData.get("callbackUrl");
  const destination = sanitizeCallbackUrl(typeof callbackValue === "string" ? callbackValue : null) ?? "/";
  const provider = parseSignInProvider(formData.get("provider"));

  if (!provider) {
    redirect(`/sign-in?error=UnsupportedProvider&callbackUrl=${encodeURIComponent(destination)}`);
  }

  await rememberSignInReturn(destination);
  await signIn(provider, { redirectTo: destination });
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([auth(), searchParams]);
  const safeCallbackUrl = sanitizeCallbackUrl(resolvedSearchParams?.callbackUrl);

  // 2026-09-27 signed-in-navigation 決策 7：已登入的人不需要再看登入頁——有指定要回去的頁面
  // （例如某堂課）就回去，否則直接到上次身分的總覽。callbackUrl 一律先經 sanitizeCallbackUrl
  // 過濾，只接受站內路徑，不會變成開放轉址。
  if (session?.user) {
    redirect(safeCallbackUrl ?? (await getLastRoleHome()));
  }

  // Google 取消或失敗時，Auth.js 只帶 ?error=<代碼> 回到這裡（src/auth.ts 的 pages），
  // 原本要回去的頁面改從登入返回 cookie 取。錯誤代碼不顯示給使用者。
  const signInFailed = Boolean(resolvedSearchParams?.error);
  const returnFromCookie = signInFailed ? await readSignInReturn() : null;

  // 登入完成預設回首頁，首頁會再把已登入的人導到上次身分的總覽（決策 6），
  // 這樣「上次身分」的判斷只寫在一個地方。
  const callbackUrl = safeCallbackUrl ?? returnFromCookie ?? "/";
  const returnsToClass = callbackUrl.startsWith("/classes/");

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-[0.2em] text-clay">讓團體練習，自然發生</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
          登入或建立帳號
        </h1>

          <div className="mt-8 rounded-3xl border border-ink/10 bg-white p-7">
            {signInFailed ? (
              <div className="mb-6 rounded-2xl border border-clay/30 bg-cream p-4" role="alert">
                <p className="font-medium text-ink">登入沒有完成，沒有送出任何報名。</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">你可以再試一次，或先回到剛才的頁面。</p>
                {returnsToClass ? (
                  <Link className="mt-3 inline-flex py-1 text-sm text-clay underline" href={callbackUrl}>
                    回到課程
                  </Link>
                ) : null}
              </div>
            ) : null}

            <p className="leading-7 text-ink-soft">
              第一次使用時，會自動為你建立帳號。
            </p>

            <div className="mt-7">
              <SignInOptions
                action={startSignInAction}
                buttonClassName="w-full rounded-full bg-pine px-6 py-3 font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                fields={{ callbackUrl }}
                label={(provider) => `使用 ${provider} 帳號繼續`}
              />
            </div>

            <p className="mt-5 text-sm leading-6 text-ink-faint">
              登入後，會帶你回到剛才要前往的頁面。
            </p>
          </div>
      </main>
      <PublicFooter />
    </div>
  );
}
