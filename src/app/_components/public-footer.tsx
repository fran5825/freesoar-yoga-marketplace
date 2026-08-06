import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-[#29382f]/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[#69756d] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Free Soar Yoga · 讓自由、覺察與共創，成為每一次練習的起點。</p>
        <nav aria-label="頁尾導覽" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="hover:text-[#8a5c49]" href="/about">
            關於我們
          </Link>
          <Link className="hover:text-[#8a5c49]" href="/faq">
            常見問題
          </Link>
          <Link className="hover:text-[#8a5c49]" href="/sign-in">
            登入
          </Link>
        </nav>
      </div>
    </footer>
  );
}
