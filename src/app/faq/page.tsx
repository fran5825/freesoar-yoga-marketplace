import type { Metadata } from "next";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";

export const metadata: Metadata = {
  title: "常見問題",
  description: "了解 Free Soar Yoga 的團課需求、老師加入、學員報名與站內通知方式。",
};

const faqGroups = [
  {
    title: "主辦人",
    items: [
      ["我可以怎麼開始提出團課需求？", "先登入並建立團主資料，再整理人數、時段、地區與練習需求。需求會先經過平台流程確認，再讓合適的老師看見。"],
      ["所有需求都會公開嗎？", "不會。尚未進入公開需求池的內容，不會提供給其他老師或團主瀏覽。"],
    ],
  },
  {
    title: "瑜伽老師",
    items: [
      ["老師可以怎麼加入？", "你可以先建立老師申請資料並送出審核。通過後，才可以查看適合的需求並回應合作機會。"],
      ["我可以先儲存申請資料嗎？", "可以。你可以先把申請內容整理成草稿，準備好後再正式送出審核。"],
    ],
  },
  {
    title: "學員",
    items: [
      ["我要怎麼找到可以報名的課程？", "目前不提供公開課程列表。當你收到已形成課程的分享連結，且該課程開放報名時，可以登入後查看並報名。"],
      ["平台是否提供線上付款或退款？", "目前平台不提供完整的線上付款與退款自動化。"],
    ],
  },
  {
    title: "帳戶與通知",
    items: [
      ["我可以查看自己的進度嗎？", "可以。登入後可在帳戶、角色工作區與站內通知中，查看與自己相關的資料和狀態。"],
      ["平台會如何通知我重要進度？", "目前重要流程會透過站內通知呈現。請登入後在通知頁查看自己的訊息。"],
    ],
  },
] as const;

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-gray-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-medium text-amber-800">常見問題</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">先把重要的事說清楚。</h1>
          <p className="mt-6 text-base leading-8 text-gray-600">這裡整理目前 Free Soar Yoga 已提供的基本流程，以及仍在逐步建立的服務邊界。</p>
        </section>
        <div className="mt-14 space-y-10">
          {faqGroups.map((group) => (
            <section aria-labelledby={`${group.title}-faq`} key={group.title}>
              <h2 className="text-2xl font-semibold tracking-tight" id={`${group.title}-faq`}>{group.title}</h2>
              <div className="mt-4 space-y-3">
                {group.items.map(([question, answer]) => (
                  <details className="rounded-2xl border border-gray-200 bg-white p-5" key={question}>
                    <summary className="cursor-pointer pr-6 text-base font-medium text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700">{question}</summary>
                    <p className="mt-4 text-sm leading-7 text-gray-600">{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
