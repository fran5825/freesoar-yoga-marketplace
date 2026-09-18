import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-ink/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[#69756d] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>輕盈遞出一份邀請，讓練習連結身心、日常與彼此。</p>
        <nav aria-label="頁尾導覽" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="hover:text-clay" href="/about">
            關於我們
          </Link>
          <Link className="hover:text-clay" href="/faq">
            常見問題
          </Link>
          <Link className="hover:text-clay" href="/sign-in">
            登入
          </Link>
        </nav>
      </div>
    </footer>
  );
}
