"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type RoleNavLink = { href: string; label: string };
export type RoleSwitchLink = RoleNavLink & { isJoin?: boolean };

const roleAreaPrefixes: Record<string, string> = {
  學員: "/member",
  團主: "/organizer",
  老師: "/teacher",
  管理後台: "/admin",
};

// 2026-09-25 organizer-usability：登入後各角色專區共用的導覽列（先用在團主、老師）。
// 只放該角色日常會用到的連結，不放公開網站的行銷導覽；桌機橫排，手機收成選單。
// 需要 usePathname 標示目前所在頁，所以是 client component；登出是 server action，由外框傳進來。
// 桌機分兩列：第一列品牌（左）＋主按鈕／登入狀態／登出（右），第二列放導覽連結。連結一多，
// 全擠在同一列會把中文一個字一個字折行，所以連結獨立一列，且不允許折行（whitespace-nowrap）。
export function RoleNav({
  areaLabel,
  links,
  primaryAction,
  roleOptions = [],
  signedInLabel,
  signOutAction,
}: {
  areaLabel: string;
  links: RoleNavLink[];
  primaryAction?: RoleNavLink;
  roleOptions?: RoleSwitchLink[];
  signedInLabel: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const roleSwitchRef = useRef<HTMLDivElement>(null);

  // 角色切換選單打開後，點選單以外的地方或按 Esc 都要收起來。
  useEffect(() => {
    if (!isRoleOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!roleSwitchRef.current?.contains(event.target as Node)) {
        setIsRoleOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsRoleOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRoleOpen]);

  // 只有同一帳號有兩種以上身分才需要切換；目前所在的身分依網址前綴判斷。
  const currentRole = roleOptions.find((option) => {
    if (option.isJoin) return false;
    const prefix = roleAreaPrefixes[option.label];
    return prefix ? pathname.startsWith(prefix) : false;
  });

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const linkClassName = (href: string) =>
    `whitespace-nowrap rounded-full px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
      isActive(href)
        ? "bg-pine-tint font-medium text-pine"
        : "text-ink-soft hover:text-clay"
    }`;

  return (
    <header className="border-b border-ink/10 bg-cream">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
        <Link
          className="flex flex-col leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay"
          href="/"
        >
          <span className="text-base font-semibold tracking-[0.04em] text-ink">
            飛索・瑜伽團課共創平台
          </span>
          <span className="text-xs tracking-[0.08em] text-ink-soft">
            {areaLabel}
          </span>
        </Link>

        <button
          aria-controls="role-nav-menu"
          aria-expanded={isMenuOpen}
          className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink md:hidden"
          onClick={() => setIsMenuOpen((open) => !open)}
          type="button"
        >
          {isMenuOpen ? "關閉選單" : "選單"}
        </button>

        <div
          className={`${isMenuOpen ? "flex" : "hidden"} w-full flex-col gap-4 md:contents`}
          id="role-nav-menu"
        >
          <nav
            aria-label={`${areaLabel}導覽`}
            className="flex flex-col gap-1 md:order-3 md:w-full md:flex-row md:flex-wrap md:items-center md:gap-1 md:border-t md:border-ink/10 md:pt-2"
          >
            {links.map((link) => (
              <Link
                aria-current={isActive(link.href) ? "page" : undefined}
                className={linkClassName(link.href)}
                href={link.href}
                key={link.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2 md:order-2">
            {primaryAction ? (
              <Link
                className="whitespace-nowrap rounded-full bg-pine px-4 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                href={primaryAction.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {primaryAction.label}
              </Link>
            ) : null}
            {roleOptions.length > 1 ? (
              <div className="relative" ref={roleSwitchRef}>
                <button
                  aria-controls="role-switch-menu"
                  aria-expanded={isRoleOpen}
                  className="whitespace-nowrap rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                  onClick={() => setIsRoleOpen((open) => !open)}
                  type="button"
                >
                  目前身分：{currentRole?.label ?? "切換"} ▾
                </button>
                {isRoleOpen ? (
                  <ul
                    className="z-10 mt-2 grid min-w-40 gap-1 rounded-2xl border border-ink/15 bg-white p-2 shadow-sm md:absolute md:right-0"
                    id="role-switch-menu"
                  >
                    {roleOptions.map((option, index) => (
                      <li
                        className={
                          option.isJoin && !roleOptions[index - 1]?.isJoin
                            ? "mt-1 border-t border-ink/10 pt-1"
                            : undefined
                        }
                        key={option.href}
                      >
                        <Link
                          aria-current={option === currentRole ? "page" : undefined}
                          className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
                            option === currentRole
                              ? "bg-pine-tint font-medium text-pine"
                              : option.isJoin
                                ? "text-clay hover:bg-sand"
                                : "text-ink-soft hover:bg-sand hover:text-ink"
                          }`}
                          href={option.href}
                          onClick={() => {
                            setIsRoleOpen(false);
                            setIsMenuOpen(false);
                          }}
                        >
                          {option.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <span className="max-w-48 truncate rounded-full border border-ink/20 bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
              {signedInLabel}
            </span>
            <form action={signOutAction}>
              <button
                className="whitespace-nowrap rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                type="submit"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
