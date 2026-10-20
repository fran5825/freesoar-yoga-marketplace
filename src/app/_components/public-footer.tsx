import Link from "next/link";

// variant="home"：首頁剪紙團課改版（2026-10-20）專用配色，其他公開頁維持原樣。
// showSignIn：已登入的人看首頁時拿掉「登入」（2026-10-20 signed-in-navigation 修訂）。
export function PublicFooter({
  showSignIn = true,
  variant = "default",
}: {
  showSignIn?: boolean;
  variant?: "default" | "home";
}) {
  const isHome = variant === "home";
  const linkClass = isHome
    ? "inline-flex min-h-11 items-center rounded-xl font-bold transition hover:text-home-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
    : "inline-flex min-h-11 items-center rounded-xl transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return (
    <footer className={isHome ? "mt-auto border-t border-home-navy/15 bg-home-band" : "mt-auto border-t border-ink/10"}>
      <div
        className={`mx-auto flex w-full flex-col gap-3 px-5 py-8 text-sm ${isHome ? "max-w-[calc(430*var(--hu))] font-semibold text-home-indigo lg:max-w-[calc(1190*var(--du))] lg:flex-row lg:items-center lg:justify-between lg:px-0" : "max-w-6xl text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8"}`}
      >
        <p>真誠遞出一份邀請，讓練習連結身心、日常與彼此。</p>
        <nav aria-label="頁尾導覽" className="flex flex-wrap gap-x-5">
          <Link className={linkClass} href="/about">
            關於我們
          </Link>
          <Link className={linkClass} href="/faq">
            常見問題
          </Link>
          {showSignIn ? (
            <Link className={linkClass} href="/sign-in">
              登入
            </Link>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
