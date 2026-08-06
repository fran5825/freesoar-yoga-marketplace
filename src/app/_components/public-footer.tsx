import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-amber-100 bg-amber-50/50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Free Soar Yoga · 以清楚、尊重的方式共創團課練習。</p>
        <nav aria-label="頁尾導覽" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="underline underline-offset-4 hover:text-amber-800" href="/about">關於我們</Link>
          <Link className="underline underline-offset-4 hover:text-amber-800" href="/faq">常見問題</Link>
          <Link className="underline underline-offset-4 hover:text-amber-800" href="/sign-in">登入</Link>
        </nav>
      </div>
    </footer>
  );
}
