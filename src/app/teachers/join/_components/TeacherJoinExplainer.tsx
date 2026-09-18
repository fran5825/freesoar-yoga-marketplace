import Link from "next/link";

import {
  applicationSections,
  fieldLabels,
  requiredFields,
} from "../_lib/application-fields";

// teacher-join-gated-application Slice 2：這是未登入訪客看到的導覽內容，取代原本「不論
// 登入與否都直接顯示可填表單」的行為（見 plan §1）。刻意不含 "use client"——內容全是靜態
// 文字，不需要互動狀態，維持 Server Component 可以少送一份不必要的 JS bundle。
// 這裡的 CTA 與 callbackUrl 是全新內容，不受 Slice 1「零行為改變」的約束，所以直接採用
// plan §5 的最終文案；已登入使用者看到的 TeacherApplicationForm 仍照舊維持第一版
// 「/sign-in」連結，要等 Slice 3 才會補上 callbackUrl。
const signInHref = `/sign-in?callbackUrl=${encodeURIComponent("/teachers/join")}`;

const collaborationPrinciples = [
  "尊重老師的教學風格、時間安排與專業界線。",
  "讓團主清楚表達需求，再由適合的老師回應合作機會。",
  "透過審核與清楚流程，守住課程品質與平台信任。",
];

const reviewProcessSteps = [
  {
    title: "送出申請",
    description:
      "登入後填寫申請資料，內容包含教學背景、風格與可服務範圍，送出後即進入審核。",
  },
  {
    title: "平台確認",
    description:
      "平台會確認教學背景與服務範圍是否符合 Free Soar 的合作定位。審核期間你可以隨時回來查看進度。",
  },
  {
    title: "結果與後續",
    description:
      "如果需要補充資料，我們會清楚告訴你需要調整的地方；你可以直接修改後重新送出，沒有次數限制。",
  },
];

const faqItems = [
  {
    question: "審核大概要多久？",
    answer:
      "目前沒有固定的審核時間承諾，平台會盡快確認並在完成後透過站內通知告訴你結果。",
  },
  {
    question: "沒有通過會怎樣？",
    answer:
      "會收到具體的退回原因，你可以依照說明修改後重新送出，沒有次數限制。",
  },
  {
    question: "我需要先有正式證照才能申請嗎？",
    answer:
      "不一定，平台重視教學風格與經驗說明是否清楚，證照與訓練背景是加分的建議欄位，不是必填門檻。",
  },
];

const requiredFieldPreviewLabels = requiredFields.map(
  (fieldName) => fieldLabels[fieldName],
);

const optionalFieldPreviewLabels = applicationSections
  .flatMap((section) => section.fields)
  .filter((field) => field.requirement === "optionalRecommended")
  .map((field) => fieldLabels[field.name]);

export function TeacherJoinExplainer() {
  return (
    <>
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-clay">
            Free Soar Yoga teacher community
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            與我們一起建立更清楚、更安心的瑜伽團課合作
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">
            Free Soar Yoga 重視老師的專業、風格與教學界線。我們希望讓團主的需求被清楚整理，也讓老師能被正確理解，回應真正適合自己的團課機會。
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              className="rounded bg-pine px-5 py-3 text-center text-sm font-medium text-white"
              href={signInHref}
            >
              登入／建立帳號並開始申請
            </a>
            <Link
              className="rounded border border-ink/20 px-5 py-3 text-center text-sm font-medium text-ink"
              href="/"
            >
              回到首頁
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-faint">
            登入或建立帳號後，就會看到完整的申請表單；下方可以先了解審核流程與需要準備的資料。
          </p>
        </div>

        <div className="rounded border border-ink/10 bg-clay-tint/60 p-5">
          <h2 className="text-lg font-medium text-ink">
            我們尋找的不是可被比較的商品，而是能共同照顧練習品質的合作夥伴。
          </h2>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            平台會以審核、需求整理與清楚的溝通流程，支持老師與團主建立信任，而不是用低價競標或倉促媒合推動合作。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {collaborationPrinciples.map((principle) => (
          <article
            className="rounded border border-ink/12 bg-white p-5"
            key={principle}
          >
            <p className="text-sm leading-6 text-ink-soft">{principle}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="review-process-title" className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-pine">老師申請</p>
          <h2
            className="mt-2 text-2xl font-semibold tracking-tight text-ink"
            id="review-process-title"
          >
            審核怎麼進行
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {reviewProcessSteps.map((step, index) => (
            <article
              className="rounded border border-ink/12 bg-white p-5"
              key={step.title}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/20 text-xs font-medium text-ink-soft">
                {index + 1}
              </span>
              <h3 className="mt-3 text-sm font-medium text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="application-preview-title"
        className="grid gap-6 border-y border-pine/15 bg-pine-tint/60 py-6"
      >
        <div>
          <p className="text-sm font-medium text-pine">申請前可以先準備</p>
          <h2
            className="mt-2 text-2xl font-semibold tracking-tight text-ink"
            id="application-preview-title"
          >
            申請前可以先準備這些
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            這是登入後申請表單會用到的欄位預覽，讓你可以先想好要怎麼填。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-ink/12 bg-white p-5">
            <h3 className="text-sm font-medium text-ink">送審必填</h3>
            <ul className="mt-3 space-y-2">
              {requiredFieldPreviewLabels.map((label) => (
                <li
                  className="rounded-full bg-sage px-3 py-1 text-sm text-pine"
                  key={label}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-ink/12 bg-white p-5">
            <h3 className="text-sm font-medium text-ink">建議，可留空</h3>
            <ul className="mt-3 space-y-2">
              {optionalFieldPreviewLabels.map((label) => (
                <li
                  className="rounded-full bg-sand px-3 py-1 text-sm text-clay"
                  key={label}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-clay">FAQ</p>
          <h2
            className="mt-2 text-2xl font-semibold tracking-tight text-ink"
            id="faq-title"
          >
            常見問題
          </h2>
        </div>
        <div className="grid gap-4">
          {faqItems.map((item) => (
            <article
              className="rounded border border-ink/12 bg-white p-5"
              key={item.question}
            >
              <h3 className="text-sm font-medium text-ink">
                {item.question}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
