import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "常見問題",
  description: "了解 Free Soar Yoga 的老師與需求審核、課程報名、取消方式及平台信任邊界。",
};

const questions = [
  ["老師加入後會直接出現在平台上嗎？", "不會。老師可以先整理並儲存申請資料，準備好後再送出審核。平台確認基本資料、教學背景與服務方式後，通過審核的老師才可回應團課需求。審核是基本信任機制，不代表醫療、療效或個別教學成果保證。"],
  ["團主提出需求後會立刻公開嗎？", "不會。需求先由團主建立並送出，平台會確認內容是否清楚、適合發布，以及是否符合團課合作的基本邊界。通過後才會進入需求池，讓符合資格的老師查看與回應。"],
  ["學員如何報名課程？", "當團主選定老師、建立課程並開放報名後，學員可透過課程分享連結查看資訊。登入後，在尚有名額且同意課程條款的情況下即可報名；同一位學員不會重複報名同一堂課。"],
  ["報名後可以取消嗎？", "可以在課程開始前，從自己的報名紀錄取消。課程開始後不開放自助取消。若整堂課由團主或平台在課前取消，系統也會同步取消該課程下已確認的報名。"],
  ["團主可以取消需求或課程嗎？", "需求在特定階段可由團主取消；若已收到老師回應，相關有效回應會一併結束。已建立的課程也可在開始前取消。實際可操作狀態會以畫面當下顯示為準。"],
  ["平台審核代表什麼？", "平台審核協助確認資料完整度、角色資格與合作內容的基本適切性，並透過清楚的狀態與流程降低誤解。它不取代老師與學員對自身狀況的判斷，也不構成醫療建議、療效承諾或所有風險的保證。"],
  ["目前可以在平台上付款或申請退款嗎？", "目前 V1 不提供完整的線上付款與退款自動化。若課程涉及費用，請依課程頁面與團主提供的實際安排確認；不要把尚未顯示的付款或退款方式視為平台承諾。"],
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#29382f]">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[#29382f]/10 py-4">
          <Link className="text-base font-semibold tracking-[0.16em]" href="/">FREE SOAR YOGA</Link>
          <nav aria-label="主要導覽" className="flex items-center gap-4 text-sm">
            <Link className="py-2" href="/about">關於我們</Link>
            <Link aria-current="page" className="py-2 text-[#8a5c49]" href="/faq">常見問題</Link>
            <Link className="rounded-full border border-[#29382f]/30 px-4 py-2" href="/sign-in">登入</Link>
          </nav>
        </header>

        <section className="py-16 sm:py-24">
          <p className="text-sm font-medium tracking-[0.2em] text-[#8a5c49]">FAQ</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">開始以前，先把重要的事說清楚</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#56645b]">關於審核、報名、取消與平台能守住的信任邊界，我們整理了目前 V1 的實際做法。</p>
        </section>

        <section aria-labelledby="questions-heading" className="pb-16 sm:pb-24">
          <h2 className="sr-only" id="questions-heading">常見問題列表</h2>
          <div className="divide-y divide-[#29382f]/15 border-y border-[#29382f]/15">
            {questions.map(([question, answer], index) => (
              <details className="group py-6" key={question} open={index === 0}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-lg font-medium marker:hidden sm:text-xl">
                  <span>{question}</span><span aria-hidden="true" className="text-2xl font-light text-[#8a5c49] group-open:rotate-45">＋</span>
                </summary>
                <p className="max-w-3xl pr-8 pt-4 leading-7 text-[#5d6a61]">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-3xl bg-[#ebe2d7] p-7 sm:mb-24 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-9">
          <div><h2 className="text-2xl font-semibold">準備好展開下一步了嗎？</h2><p className="mt-2 leading-7 text-[#5d625c]">依你的角色選擇入口，也可以先登入查看自己的帳號。</p></div>
          <div className="mt-6 flex flex-col gap-3 sm:mt-0 sm:min-w-48">
            <Link className="rounded-full bg-[#345343] px-5 py-3 text-center font-medium text-white" href="/teachers/join">老師加入</Link>
            <Link className="rounded-full border border-[#345343]/30 px-5 py-3 text-center font-medium" href="/organizers/request">提出需求</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
