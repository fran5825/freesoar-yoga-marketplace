import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { getLastRoleHome } from "@/lib/navigation/last-role";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";

type SignInPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([auth(), searchParams]);
  const safeCallbackUrl = sanitizeCallbackUrl(resolvedSearchParams?.callbackUrl);

  // 2026-09-27 signed-in-navigation 決策 7：已登入的人不需要再看登入頁——有指定要回去的頁面
  // （例如某堂課）就回去，否則直接到上次身分的總覽。callbackUrl 一律先經 sanitizeCallbackUrl
  // 過濾，只接受站內路徑，不會變成開放轉址。
  if (session?.user) {
    redirect(safeCallbackUrl ?? (await getLastRoleHome()));
  }

  // 登入完成預設回首頁，首頁會再把已登入的人導到上次身分的總覽（決策 6），
  // 這樣「上次身分」的判斷只寫在一個地方。
  const callbackUrl = safeCallbackUrl ?? "/";

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-[0.2em] text-clay">讓團體練習，自然發生</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
          登入或建立帳號
        </h1>

          <div className="mt-8 rounded-3xl border border-ink/10 bg-white p-7">
            <p className="leading-7 text-ink-soft">
              使用 Google 帳號登入。第一次使用時，會自動為你建立帳號。
            </p>

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <button
                className="mt-7 w-full rounded-full bg-pine px-6 py-3 font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                type="submit"
              >
                使用 Google 帳號繼續
              </button>
            </form>

            <p className="mt-5 text-sm leading-6 text-ink-faint">
              登入後，會帶你回到剛才要前往的頁面。
            </p>
          </div>
      </main>
      <PublicFooter />
    </div>
  );
}
