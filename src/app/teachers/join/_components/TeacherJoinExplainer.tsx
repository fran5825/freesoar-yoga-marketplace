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

// 2026-10-18 impeccable 改版（診斷報告 J1／Q8）：訪客版首屏先說加入的好處，只寫產品真實有的能力，
// 不放人數、推薦語或成效承諾；審核流程、欄位預覽與常見問題往下移。
const joinBenefits = [
  {
    title: "被合適的團體看見",
    description: "團主的需求經過平台整理與審核才公開，你會看到清楚的人數、時段與地點，再決定要不要回應。",
  },
  {
    title: "開設自己的固定課",
    description: "除了回應團主需求，也可以自己開單堂、持續開課或期班，讓學員直接報名。",
  },
  {
    title: "先從大新竹生活圈開始",
    description: "目前以新竹縣市與竹北一帶的公司、社區與教室為主。",
  },
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
      "平台會確認教學背景與服務範圍是否符合飛索的合作定位。審核期間你可以隨時回來查看進度。",
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
      <section aria-labelledby="teacher-join-heading">
        <h1
          className="max-w-3xl break-keep text-balance text-4xl font-semibold tracking-tight text-ink wrap-break-word sm:text-5xl"
          id="teacher-join-heading"
        >
          把你的教學，帶給真正需要的團體
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
          飛索整理大新竹生活圈公司社團、社區與小團體的上課需求，讓你依自己的時間、風格與界線選擇合作。
        </p>
        <ul className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
          {joinBenefits.map((benefit) => (
            <li className="border-t border-ink/15 pt-5" key={benefit.title}>
              <h2 className="text-lg font-medium text-ink">{benefit.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{benefit.description}</p>
            </li>
          ))}
        </ul>
        <a
          className="mt-10 inline-flex min-h-12 items-center rounded-full bg-pine px-7 text-center font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          href={signInHref}
        >
          登入／建立帳號並開始申請
        </a>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-faint">
          登入或建立帳號後，就會看到完整的申請表單；下方可以先了解審核流程與需要準備的資料。
        </p>
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
              className="rounded-2xl border border-ink/12 bg-white p-5"
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
          <h2
            className="text-2xl font-semibold tracking-tight text-ink"
            id="application-preview-title"
          >
            申請前可以先準備這些
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            這是登入後申請表單會用到的欄位預覽，讓你可以先想好要怎麼填。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink/12 bg-white p-5">
            <h3 className="text-sm font-medium text-ink">送審必填</h3>
            <ul className="mt-3 space-y-2">
              {requiredFieldPreviewLabels.map((label) => (
                <li className="flex items-start gap-3 text-sm leading-6 text-ink" key={label}>
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-pine" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-ink/12 bg-white p-5">
            <h3 className="text-sm font-medium text-ink">建議，可留空</h3>
            <ul className="mt-3 space-y-2">
              {optionalFieldPreviewLabels.map((label) => (
                <li className="flex items-start gap-3 text-sm leading-6 text-ink-soft" key={label}>
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-glow" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="grid gap-6">
        <div>
          <h2
            className="text-2xl font-semibold tracking-tight text-ink"
            id="faq-title"
          >
            常見問題
          </h2>
        </div>
        <div className="grid gap-4">
          {faqItems.map((item) => (
            <article
              className="rounded-2xl border border-ink/12 bg-white p-5"
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
