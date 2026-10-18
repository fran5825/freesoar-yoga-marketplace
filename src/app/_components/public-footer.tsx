import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-ink/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>真誠遞出一份邀請，讓練習連結身心、日常與彼此。</p>
        <nav aria-label="頁尾導覽" className="flex flex-wrap gap-x-5">
          <Link className="inline-flex min-h-11 items-center rounded-xl transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" href="/about">
            關於我們
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-xl transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" href="/faq">
            常見問題
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-xl transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" href="/sign-in">
            登入
          </Link>
        </nav>
      </div>
    </footer>
  );
}
