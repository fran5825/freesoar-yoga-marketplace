import Link from "next/link";

import { auth, signOut } from "@/auth";

const publicLinks = [
  { href: "/about", label: "關於我們" },
  { href: "/faq", label: "常見問題" },
  { href: "/teachers/join", label: "我是老師" },
  { href: "/organizers/request", label: "我是主辦人" },
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
    <header className="border-b border-[#29382f]/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link
          className="text-base font-semibold uppercase tracking-[0.16em] text-[#29382f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a5c49]"
          href="/"
        >
          Free Soar Yoga
        </Link>
        <nav aria-label="公開網站導覽" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#56645b]">
          {publicLinks.map((link) => (
            <Link
              className="rounded px-1 py-1 transition hover:text-[#8a5c49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          {signedInLabel ? (
            <span className="rounded-full border border-[#29382f]/20 bg-[#eef2ee] px-3 py-1 text-xs font-medium text-[#345343]">
              已登入：{signedInLabel}
            </span>
          ) : (
            <Link
              className="rounded-full border border-[#29382f]/30 px-4 py-2 font-medium text-[#29382f] transition hover:border-[#29382f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
              href="/sign-in"
            >
              登入
            </Link>
          )}
          <Link
            className="rounded px-1 py-1 transition hover:text-[#8a5c49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
            href="/account"
          >
            我的帳戶
          </Link>
          {signedInLabel ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                className="rounded px-1 py-1 text-[#56645b] transition hover:text-[#8a5c49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
                type="submit"
              >
                登出
              </button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
