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
// variant="home"：首頁剪紙團課改版（2026-10-20，構圖 comp-4e）用白底、深藏青粗體品牌字，
// 品牌字貼近畫面左邊（產品主人核准的刻意差異，不和首頁主標對齊）。其他公開頁維持原樣。
export function PublicHeader({ variant = "default" }: { variant?: "default" | "home" }) {
  const isHome = variant === "home";

  return (
    <header className={isHome ? "border-b border-home-navy/10 bg-white" : "border-b border-ink/10"}>
      <div
        className={
          isHome
            ? "mx-auto flex w-full max-w-[calc(430*var(--hu))] flex-wrap items-center justify-between gap-x-6 gap-y-3 pl-4 pr-9 lg:h-[calc(66*var(--du))] lg:max-w-none lg:flex-nowrap lg:pl-[calc(98*var(--du))] lg:pr-[calc(94*var(--du))]"
            : "mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8"
        }
      >
        {isHome ? (
          <Link
            className="flex min-h-10 -translate-y-0.5 items-center leading-none text-home-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-green"
            href="/"
          >
            <span className="font-home-display text-[calc(19.2*var(--hu))] font-extrabold tracking-[0.02em] lg:text-[calc(40*var(--du))]">飛索</span>
            <span aria-hidden="true" className="mx-[calc(7*var(--hu))] inline-block size-[calc(3.4*var(--hu))] lg:mx-[calc(12*var(--du))] lg:size-[calc(6*var(--du))] rounded-full bg-current" />
            <span className="font-home-display text-[calc(14*var(--hu))] font-extrabold tracking-[0.03em] lg:text-[calc(27*var(--du))] lg:tracking-[0.13em]">瑜伽團課共創平台</span>
            <span className="sr-only">Free Soar Yoga</span>
          </Link>
        ) : (
          <Link
            className="flex min-h-11 flex-col justify-center leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            href="/"
          >
            <span className="text-base font-semibold tracking-[0.04em] text-ink">飛索・瑜伽團課共創平台</span>
            <span className="text-xs tracking-[0.08em] text-ink-soft">Free Soar Yoga</span>
          </Link>
        )}
        <PublicHeaderMenu tone={isHome ? "home" : "default"}>
          <nav
            aria-label="公開網站導覽"
            className={`flex flex-col gap-1 text-sm md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2 ${isHome ? "font-bold text-home-indigo" : "text-ink-soft"}`}
          >
            {publicLinks.map((link) => (
              <Link
                className={`inline-flex min-h-11 items-center rounded-xl px-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 ${isHome ? "hover:text-home-green focus-visible:outline-home-green" : "hover:text-gold focus-visible:outline-gold"}`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              className={`inline-flex min-h-11 items-center rounded-full px-5 text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 ${isHome ? "bg-home-navy font-bold hover:bg-home-navy-deep focus-visible:outline-home-green" : "bg-pine font-medium hover:bg-pine-deep focus-visible:outline-gold"}`}
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
