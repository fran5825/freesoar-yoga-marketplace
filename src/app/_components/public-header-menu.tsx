"use client";

import { useState, type ReactNode } from "react";

import { usePathname } from "next/navigation";

import { MenuIcon } from "./menu-icon";

// 公開 header 的手機選單（member-usability 票 08）：手機只露出品牌＋「選單」按鈕，
// 連結、登入狀態、登出、我的專區收進選單；md 以上用 md:contents 讓這層包裝「消失」，
// 裡面的東西直接回到原本 header 的 flex 排版，桌機外觀不變。做法比照 RoleNav 的手機選單。
// children 由伺服器端的 PublicHeader 傳進來（含登出的 server action），這裡只管開關。
export function PublicHeaderMenu({ children }: { children: ReactNode }) {
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
        className="rounded-full p-2 text-ink transition hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay md:hidden"
        onClick={() => setOpenedAtPath(isOpen ? null : pathname)}
        type="button"
      >
        <MenuIcon isOpen={isOpen} />
      </button>
      <div
        className={`${isOpen ? "flex" : "hidden"} w-full flex-col gap-4 md:contents`}
        id="public-header-menu"
      >
        {children}
      </div>
    </>
  );
}
