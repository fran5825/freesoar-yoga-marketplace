import Link from "next/link";

import { PublicHeaderMenu } from "./public-header-menu";

const publicLinks = [
  { href: "/organizers/request", label: "發起團課" },
  { href: "/classes", label: "搜尋課程" },
  { href: "/teachers/join", label: "老師合作" },
  { href: "/about", label: "關於飛索" },
];

// 公開 header（docs/context/glossary.md）：只給沒登入的訪客。2026-09-27 signed-in-navigation
// 決策 1 起，登入後每一頁都改用專區導覽列（公開頁透過 SiteShell 切換外框，首頁與登入頁會把
// 已登入的人導到上次身分的總覽），所以這裡不再需要顯示登入狀態、登出與「我的專區」。
// 手機版連結與「登入」收進 ☰ 選單（member-usability 票 08）。
export function PublicHeader() {
  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link
          className="flex flex-col leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay"
          href="/"
        >
          <span className="text-base font-semibold tracking-[0.04em] text-ink">飛索・瑜伽團課共創平台</span>
          <span className="text-xs tracking-[0.08em] text-ink-soft">Free Soar Yoga</span>
        </Link>
        <PublicHeaderMenu>
          <nav
            aria-label="公開網站導覽"
            className="flex flex-col gap-1 text-sm text-ink-soft md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2"
          >
            {publicLinks.map((link) => (
              <Link
                className="rounded-xl px-1 py-2 transition hover:text-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay md:py-1"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              className="rounded-full bg-pine px-5 py-2 font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              href="/sign-in"
            >
              登入／註冊
            </Link>
          </div>
        </PublicHeaderMenu>
      </div>
    </header>
  );
}
