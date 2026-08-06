import Link from "next/link";

const publicLinks = [
  { href: "/about", label: "關於我們" },
  { href: "/faq", label: "常見問題" },
  { href: "/teachers/join", label: "我是老師" },
  { href: "/organizers/request", label: "我是主辦人" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-amber-100 bg-white/95">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link className="text-base font-semibold tracking-tight text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700" href="/">
          Free Soar Yoga
        </Link>
        <nav aria-label="公開網站導覽" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
          {publicLinks.map((link) => (
            <Link className="rounded px-1 py-1 transition hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <Link className="rounded border border-gray-300 px-3 py-1.5 font-medium text-gray-900 transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" href="/sign-in">
            登入
          </Link>
          <Link className="rounded px-1 py-1 transition hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" href="/account">
            我的帳戶
          </Link>
        </nav>
      </div>
    </header>
  );
}
