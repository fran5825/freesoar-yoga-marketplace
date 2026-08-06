import Link from "next/link";

const publicLinks = [
  { href: "/about", label: "關於我們" },
  { href: "/faq", label: "常見問題" },
  { href: "/teachers/join", label: "我是老師" },
  { href: "/organizers/request", label: "我是主辦人" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-[#29382f]/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link
          className="text-base font-semibold uppercase tracking-[0.16em] text-[#29382f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a5c49]"
          href="/"
        >
          Free Soar Yoga
        </Link>
        <nav aria-label="公開網站導覽" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#56645b]">
          {publicLinks.map((link) => (
            <Link
              className="rounded px-1 py-1 transition hover:text-[#8a5c49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          <Link
            className="rounded-full border border-[#29382f]/30 px-4 py-2 font-medium text-[#29382f] transition hover:border-[#29382f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
            href="/sign-in"
          >
            登入
          </Link>
          <Link
            className="rounded px-1 py-1 transition hover:text-[#8a5c49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5c49]"
            href="/account"
          >
            我的帳戶
          </Link>
        </nav>
      </div>
    </header>
  );
}
