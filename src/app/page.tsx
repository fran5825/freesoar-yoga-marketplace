import Link from "next/link";

const pathways = [
  {
    eyebrow: "給瑜伽老師",
    title: "帶著你的專業，被合適的團體看見",
    description:
      "建立老師資料、說明教學風格與可服務方式，再回應真正適合你的團課需求。",
    href: "/teachers/join",
    action: "了解老師加入",
  },
  {
    eyebrow: "給團主與組織者",
    title: "從一個清楚的需求，開始一堂好課",
    description:
      "說明團體情境、期待與時間，讓平台協助你與合適的老師展開合作。",
    href: "/organizers/request",
    action: "提出團課需求",
  },
];

const principles = [
  ["尊重專業", "老師不是被比價的商品；每一次合作都從理解教學與團體需求開始。"],
  ["清楚流程", "老師與需求經過平台審核，合作、成課與報名都有明確的下一步。"],
  ["共同成長", "團主、老師、學員與平台一起守住安全、品質與可持續的練習關係。"],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ee] text-[#29382f]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[#29382f]/10 py-4">
          <Link className="text-base font-semibold tracking-[0.16em]" href="/">
            FREE SOAR YOGA
          </Link>
          <nav aria-label="主要導覽" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm">
            <Link className="py-2 hover:text-[#8a5c49]" href="/about">關於我們</Link>
            <Link className="py-2 hover:text-[#8a5c49]" href="/faq">常見問題</Link>
            <Link className="rounded-full border border-[#29382f]/30 px-4 py-2 hover:border-[#29382f]" href="/sign-in">登入</Link>
          </nav>
        </header>

        <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-32">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-[#8a5c49]">讓團體練習，自然發生</p>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-6xl">
              連結好老師與真實需求的瑜伽團課 marketplace
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#536158]">
              Free Soar Yoga 以品牌、信任與共創為核心，陪伴團主提出需求、老師回應專業，讓學員在清楚安心的關係裡參與高品質的身心練習。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="rounded-full bg-[#345343] px-6 py-3 text-center font-medium text-white transition hover:bg-[#293f35]" href="/organizers/request">
                我想發起團課
              </Link>
              <Link className="rounded-full border border-[#345343]/30 bg-white/50 px-6 py-3 text-center font-medium transition hover:border-[#345343]" href="/teachers/join">
                我是瑜伽老師
              </Link>
            </div>
          </div>

          <div aria-label="Free Soar 品牌精神" className="relative mx-auto aspect-square w-full max-w-md rounded-[42%_58%_52%_48%] bg-[#dfe8dc] p-8 sm:p-12">
            <div className="flex h-full flex-col justify-between rounded-[38%_62%_45%_55%] border border-white/80 bg-white/45 p-7 backdrop-blur-sm">
              <p className="text-sm tracking-[0.18em] text-[#6d7d70]">FREEDOM · AWAKENING</p>
              <p className="text-3xl font-medium leading-snug text-[#345343]">在身體裡安住，<br />在關係中展開。</p>
              <p className="text-sm tracking-[0.18em] text-[#6d7d70]">GROWTH · COMMUNITY</p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-[#345343] py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-sm font-medium tracking-[0.2em] text-[#cfdbd1]">找到你的起點</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">每一堂團課，都從彼此理解開始</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {pathways.map((pathway) => (
              <article className="flex flex-col rounded-3xl border border-white/15 bg-white/[0.07] p-7 sm:p-9" key={pathway.href}>
                <p className="text-sm text-[#cfdbd1]">{pathway.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-medium leading-snug">{pathway.title}</h3>
                <p className="mt-4 flex-1 leading-7 text-[#e3e9e4]">{pathway.description}</p>
                <Link className="mt-7 inline-flex min-h-11 items-center font-medium underline decoration-white/35 underline-offset-8 hover:decoration-white" href={pathway.href}>
                  {pathway.action} <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-[#8a5c49]">我們如何守住品質</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">溫柔，不等於模糊</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {principles.map(([title, description], index) => (
              <article className="border-t border-[#29382f]/20 pt-5" key={title}>
                <p className="text-sm text-[#8a5c49]">0{index + 1}</p>
                <h3 className="mt-4 text-xl font-medium">{title}</h3>
                <p className="mt-3 leading-7 text-[#5d6a61]">{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#ebe2d7] p-7 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-semibold">想先多了解一點？</h2>
            <p className="mt-2 leading-7 text-[#5d625c]">認識 Free Soar 的品牌精神，或查看審核、報名與取消方式。</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link className="min-h-11 rounded-full border border-[#29382f]/30 px-5 py-2.5 text-center font-medium" href="/about">關於 Free Soar</Link>
            <Link className="min-h-11 rounded-full border border-[#29382f]/30 px-5 py-2.5 text-center font-medium" href="/faq">查看常見問題</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#29382f]/10 px-5 py-8 text-center text-sm text-[#69756d] sm:px-8">
        Free Soar Yoga · 讓自由、覺察與共創，成為每一次練習的起點。
      </footer>
    </main>
  );
}
