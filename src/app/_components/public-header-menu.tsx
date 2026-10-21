"use client";

import { useState, type ReactNode } from "react";

import { usePathname } from "next/navigation";

import { MenuIcon } from "./menu-icon";

// 公開 header 的手機選單（member-usability 票 08）：手機只露出品牌＋「選單」按鈕，
// 連結、登入狀態、登出、我的專區收進選單；md 以上用 md:contents 讓這層包裝「消失」，
// 裡面的東西直接回到原本 header 的 flex 排版，桌機外觀不變。做法比照 RoleNav 的手機選單。
// children 由伺服器端的 PublicHeader 傳進來（含登出的 server action），這裡只管開關。
export function PublicHeaderMenu({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "home";
}) {
  const pathname = usePathname();
  // 記住「在哪一頁打開的」：點選單裡的連結換頁後網址不同，選單自然就收起，不需要 effect。
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const isOpen = openedAtPath === pathname;

  return (
    <>
      <button
        aria-controls="public-header-menu"
        aria-expanded={isOpen}
        aria-label={isOpen ? "關閉選單" : "選單"}
        className={`inline-flex ${tone === "home" ? "size-11 lg:size-[calc(60*var(--du))]" : "size-11"} items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 ${tone === "home" ? "" : "md:hidden"} ${tone === "home" ? "text-home-ink hover:bg-home-navy/5 focus-visible:outline-home-green" : "text-ink hover:bg-ink/5 focus-visible:outline-gold"}`}
        onClick={() => setOpenedAtPath(isOpen ? null : pathname)}
        type="button"
      >
        <MenuIcon className={tone === "home" ? "size-7 -translate-y-0.5 lg:size-[calc(60*var(--du))] lg:translate-y-[calc(3*var(--du))]" : undefined} isOpen={isOpen} strokeWidth={tone === "home" ? 2.25 : undefined} />
      </button>
      <div
        className={`${isOpen ? "flex" : "hidden"} w-full flex-col gap-4 ${tone === "home" ? "pb-4" : "md:contents"}`}
        id="public-header-menu"
      >
        {children}
      </div>
    </>
  );
}
