import { auth, signIn, signOut } from "@/auth";
import Link from "next/link";

import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";

type SignInPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([auth(), searchParams]);
  const callbackUrl = sanitizeCallbackUrl(resolvedSearchParams?.callbackUrl) ?? "/member/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-[0.2em] text-clay">讓團體練習，自然發生</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
          {session?.user ? "你已經登入了" : "登入或建立帳號"}
        </h1>

        {session?.user ? (
          <div className="mt-8 rounded-3xl border border-ink/10 bg-white p-7">
            <p className="text-sm text-ink-soft">目前登入的帳號</p>
            <p className="mt-2 break-words font-medium">
              {session.user.email ?? session.user.name ?? "已登入的使用者"}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-full bg-pine px-6 py-3 text-center font-medium text-white transition hover:bg-pine-deep"
                href="/member/dashboard"
              >
                前往我的總覽
              </Link>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/sign-in" });
                }}
              >
                <button
                  className="w-full rounded-full border border-ink/25 px-6 py-3 font-medium transition hover:border-ink sm:w-auto"
                  type="submit"
                >
                  登出
                </button>
              </form>
            </div>
          </div>
        ) : (
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
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
