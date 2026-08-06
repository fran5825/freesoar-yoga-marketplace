import type { Metadata } from "next";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";

export const metadata: Metadata = {
  title: "關於 Free Soar Yoga",
  description: "認識 Free Soar Yoga 如何連結主辦人、瑜伽老師與學員，共創有品質的團體練習。",
};

const values = [
  ["自由", "讓每個人能以自己的節奏，選擇適合的練習與合作方式。"],
  ["覺醒", "回到身體感受與當下需要，而非追逐單一標準答案。"],
  ["成長", "讓清楚的流程支持長期、可持續的練習關係。"],
  ["身心整合", "把身體練習放回日常，保留對每個人的尊重與彈性。"],
  ["自主與共創", "讓主辦人、老師與學員在清楚的角色中一起完成一堂課。"],
] as const;

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-gray-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-medium text-amber-800">關於 Free Soar Yoga</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">讓團體練習，從清楚理解彼此開始。</h1>
          <p className="mt-6 text-base leading-8 text-gray-600">Free Soar Yoga 是 Free Soar 主品牌下的瑜伽團課 marketplace。我們希望讓有練習需求的團體、具備專業與風格的老師，以及準備參與課程的學員，在更有秩序也更有人味的方式中相遇。</p>
        </section>
        <section className="mt-14 grid gap-6 rounded-3xl border border-amber-100 bg-white p-6 sm:grid-cols-2 sm:p-10">
          <div><h2 className="text-2xl font-semibold tracking-tight">我們相信的，不只是媒合。</h2></div>
          <div className="space-y-4 text-sm leading-7 text-gray-600">
            <p>一堂團課的開始，往往來自有人願意把需要說清楚，也有人願意帶著專業回應。</p>
            <p>平台的角色，是協助這些對話有可依循的流程，而不是把人變成價格、標籤或快速成交的數字。</p>
          </div>
        </section>
        <section className="mt-14" aria-labelledby="values-heading">
          <p className="text-sm font-medium text-amber-800">Free Soar 的價值</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight" id="values-heading">這些價值，落在每一次合作裡。</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {values.map(([title, body]) => (
              <article className="rounded-2xl border border-gray-200 bg-white p-6" key={title}>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-14 rounded-3xl border border-sky-100 bg-sky-50/60 p-6 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">我們不承諾不切實際的改變。</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-700">Free Soar Yoga 不是醫療服務，也不以課程保證特定身心成果。我們更在意的是：讓參與者在被尊重、資訊清楚的情況下，找到願意持續靠近的練習。</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
