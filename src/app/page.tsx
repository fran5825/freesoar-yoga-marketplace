import Link from "next/link";

import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";

const roleCards = [
  { title: "主辦人", body: "把團體的時間、地點與練習需求整理清楚，讓合適的老師理解這次合作。" },
  { title: "瑜伽老師", body: "用自己的教學風格與可授課時間，回應真正適合的團課機會。" },
  { title: "學員", body: "透過已形成課程的分享連結了解內容，並在開放報名時完成報名。" },
];

const steps = ["提出需求", "老師回應", "選擇合作", "形成課程", "學員報名"];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-gray-950">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-5 py-12 sm:px-8 sm:py-16">
        <section className="grid gap-8 rounded-3xl border border-amber-100 bg-white px-6 py-10 shadow-sm sm:px-10 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-medium tracking-wide text-amber-800">Free Soar Yoga</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">從一堂團課開始，讓練習與人重新相遇。</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-gray-600">Free Soar Yoga 協助主辦人、瑜伽老師與學員，以清楚溝通與彼此尊重，共創安心而有品質的團體練習經驗。</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" href="/organizers/request">我是主辦人</Link>
              <Link className="rounded border border-gray-300 bg-white px-5 py-3 text-center text-sm font-medium text-gray-900 transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" href="/teachers/join">我是老師</Link>
            </div>
          </div>
          <aside className="rounded-2xl border border-amber-100 bg-amber-50/70 p-6">
            <h2 className="text-lg font-medium text-gray-950">不是低價媒合，而是合適的開始。</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">我們重視每一次需求是否被好好說明、每一位老師是否被專業看見，以及每一堂課是否能讓人安心投入。</p>
          </aside>
        </section>
        <section aria-labelledby="roles-heading">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-amber-800">為不同角色而設計</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight" id="roles-heading">讓每個人都知道，下一步可以怎麼走。</h2>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {roleCards.map((card) => (
              <article className="rounded-2xl border border-gray-200 bg-white p-6" key={card.title}>
                <h3 className="text-lg font-medium">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">{card.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-10" aria-labelledby="how-heading">
          <p className="text-sm font-medium text-amber-800">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight" id="how-heading">從需求到練習，保持清楚與溫度。</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <li className="rounded-xl bg-stone-50 p-4" key={step}>
                <span className="text-sm font-medium text-amber-800">0{index + 1}</span>
                <p className="mt-2 text-sm font-medium text-gray-900">{step}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="grid gap-6 rounded-3xl border border-sky-100 bg-sky-50/60 p-6 sm:grid-cols-[0.85fr_1.15fr] sm:p-10">
          <div>
            <p className="text-sm font-medium text-sky-800">信任從清楚開始</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">把合作前的重要事情，先說明白。</h2>
          </div>
          <div className="space-y-3 text-sm leading-7 text-gray-700">
            <p>老師申請與團課需求都會經過平台流程確認，再進入下一個階段。</p>
            <p>我們不以低價競標定義一堂課，也不對身心結果做不實保證。</p>
            <Link className="inline-flex font-medium text-sky-900 underline underline-offset-4" href="/faq">查看常見問題</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
