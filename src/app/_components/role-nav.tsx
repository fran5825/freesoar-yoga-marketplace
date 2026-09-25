"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type RoleNavLink = { href: string; label: string };

// 2026-09-25 organizer-usability：登入後各角色專區共用的導覽列（先用在團主、老師）。
// 只放該角色日常會用到的連結，不放公開網站的行銷導覽；桌機橫排，手機收成選單。
// 需要 usePathname 標示目前所在頁，所以是 client component；登出是 server action，由外框傳進來。
export function RoleNav({
  areaLabel,
  links,
  primaryAction,
  signedInLabel,
  signOutAction,
}: {
  areaLabel: string;
  links: RoleNavLink[];
  primaryAction?: RoleNavLink;
  signedInLabel: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const linkClassName = (href: string) =>
    `rounded-full px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
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
          className={`${isMenuOpen ? "flex" : "hidden"} w-full flex-col gap-4 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:justify-between`}
          id="role-nav-menu"
        >
          <nav
            aria-label={`${areaLabel}導覽`}
            className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1"
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

          <div className="flex flex-wrap items-center gap-2">
            {primaryAction ? (
              <Link
                className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                href={primaryAction.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {primaryAction.label}
              </Link>
            ) : null}
            <span className="max-w-48 truncate rounded-full border border-ink/20 bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
              {signedInLabel}
            </span>
            <form action={signOutAction}>
              <button
                className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
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
