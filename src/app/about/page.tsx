import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";

export const metadata: Metadata = {
  title: "關於我們",
  description: "認識 Free Soar Yoga 的品牌精神、共創角色與瑜伽團課 marketplace 定位。",
};

const spirits = [
  ["自由 Freedom", "在清楚的界線與選擇中，找到適合自己的練習與合作方式。"],
  ["覺醒 Awakening", "回到身體與當下，培養對自己、他人與環境的覺察。"],
  ["成長 Growth", "讓每一次教學、組織與參與，都成為可持續的共同學習。"],
  ["身心整合 Wellness", "重視完整的人，而不以表現、速度或單一結果定義練習。"],
  ["自主 Leadership", "支持每個角色理解責任、表達需求，也尊重彼此的專業判斷。"],
  ["共創社群 Community", "以信任與回應形成關係，讓好課不是單方面提供，而是一起完成。"],
];

const roles = [
  ["團主／組織者", "理解團體情境，提出清楚的團課需求，並選擇適合的老師。"],
  ["瑜伽老師", "呈現真實的教學風格與專業，依自身意願回應合適需求。"],
  ["會員／學員", "在資訊清楚的課程中安心報名，尊重課堂與共同練習。"],
  ["Free Soar 平台", "提供審核、連結與流程支持，守住基本品質與信任邊界。"],
];

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f7f4ee] text-[#29382f]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl flex-1 px-5 sm:px-8">
        <section className="py-16 sm:py-24">
          <p className="text-sm font-medium tracking-[0.2em] text-[#8a5c49]">ABOUT FREE SOAR</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.03em] sm:text-6xl">讓自由與覺察，長成有品質的共同練習</h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-[#56645b]">
            Free Soar Yoga 是 Free Soar 品牌的第一階段實踐。我們從瑜伽團課出發，建立一個以人、專業與信任為核心的 marketplace，讓需求與教學不是倉促配對，而是經過理解後展開的合作。
          </p>
        </section>

        <section aria-labelledby="spirit-heading" className="border-t border-[#29382f]/15 py-16 sm:py-20">
          <h2 className="text-3xl font-semibold" id="spirit-heading">品牌精神</h2>
          <div className="mt-9 grid gap-px overflow-hidden rounded-3xl bg-[#29382f]/10 sm:grid-cols-2 lg:grid-cols-3">
            {spirits.map(([title, description]) => (
              <article className="bg-[#fcfaf6] p-7" key={title}>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="mt-3 leading-7 text-[#5d6a61]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="roles-heading" className="py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-sm font-medium tracking-[0.2em] text-[#8a5c49]">FOUR-WAY CO-CREATION</p>
              <h2 className="mt-4 text-3xl font-semibold" id="roles-heading">四方共創，不是單向交易</h2>
            </div>
            <div className="space-y-4">
              {roles.map(([title, description], index) => (
                <article className="grid gap-2 rounded-2xl border border-[#29382f]/10 bg-white/55 p-6 sm:grid-cols-[3rem_1fr]" key={title}>
                  <span className="text-sm text-[#8a5c49]">0{index + 1}</span>
                  <div><h3 className="text-xl font-medium">{title}</h3><p className="mt-2 leading-7 text-[#5d6a61]">{description}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-16 rounded-3xl bg-[#dfe8dc] p-7 sm:mb-24 sm:p-10">
          <h2 className="text-2xl font-semibold">我們此刻專注的事</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[#506056]">
            現階段聚焦瑜伽團課 marketplace：團主提出需求、老師建立資料並回應、團主選擇老師形成課程，以及學員報名參與。我們寧可先把這段關係做得清楚可信，也不急著承諾尚未落地的服務。
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link className="rounded-full bg-[#345343] px-5 py-3 text-center font-medium text-white" href="/teachers/join">了解老師加入</Link>
            <Link className="rounded-full border border-[#345343]/30 px-5 py-3 text-center font-medium" href="/organizers/request">提出團課需求</Link>
          </div>
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}
