import Link from "next/link";

import { auth, signOut } from "@/auth";

const publicLinks = [
  { href: "/organizers/request", label: "發起團課" },
  { href: "/classes", label: "搜尋課程" },
  { href: "/teachers/join", label: "老師合作" },
  { href: "/about", label: "關於飛索" },
];

// public-header-shows-signed-in-state：這個 header 原本不管有沒有登入都同時顯示
// 「登入」跟「我的帳戶」，完全不反映實際登入狀態（使用者手動測試時發現，登入後也看不出
// 自己是哪個帳號）。改成用 auth()（比照 src/app/sign-in/page.tsx 既有寫法，讀 session
// 就好，不需要像 getCurrentUser() 多一趟資料庫查詢）判斷，登入後把「登入」換成
// email／名字＋登出，未登入維持原樣不變。
export async function PublicHeader() {
  const session = await auth();
  const signedInLabel = session?.user
    ? (session.user.email ?? session.user.name ?? "已登入")
    : null;

  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link
          className="flex flex-col leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay"
          href="/"
        >
          <span className="text-base font-semibold tracking-[0.04em] text-ink">Free Soar Yoga</span>
          <span className="text-xs tracking-[0.08em] text-ink-soft">飛索・瑜伽團課共創平台</span>
        </Link>
        <nav aria-label="公開網站導覽" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          {publicLinks.map((link) => (
            <Link
              className="rounded-xl px-1 py-1 transition hover:text-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {signedInLabel ? (
            <>
              <span className="rounded-full border border-ink/20 bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
                已登入：{signedInLabel}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  className="rounded-full border border-ink/30 px-4 py-2 font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                  type="submit"
                >
                  登出
                </button>
              </form>
            </>
          ) : (
            <Link
              className="rounded-full border border-ink/30 px-4 py-2 font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              href="/sign-in"
            >
              登入
            </Link>
          )}
          <Link
            className="rounded-full bg-pine px-5 py-2 font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            href="/account"
          >
            我的帳戶
          </Link>
        </div>
      </div>
    </header>
  );
}
