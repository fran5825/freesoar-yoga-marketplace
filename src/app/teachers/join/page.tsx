import Link from "next/link";

const collaborationPrinciples = [
  "尊重老師的教學風格、時間安排與專業界線。",
  "讓團主清楚表達需求，再由適合的老師回應合作機會。",
  "透過審核與清楚流程，守住課程品質與平台信任。",
];

const nextSteps = [
  "登入後，後續將可建立 teacher profile 草稿。",
  "正式申請流程開放後，老師可補齊教學背景、服務區域與授課形式。",
  "送出申請後，平台會由 Admin 進行審核，再開放 marketplace 相關功能。",
];

const applicationSections = [
  {
    title: "基本呈現",
    description: "讓團主先理解你的稱呼、教學經驗與你希望被看見的專業樣貌。",
    fields: [
      {
        name: "displayName",
        label: "公開顯示名稱",
        requirement: "送審時必填",
        preview: "例如：林安瑜 / Anya Lin",
      },
      {
        name: "experienceYears",
        label: "教學年資",
        requirement: "送審時必填",
        preview: "例如：5 年團課與企業瑜伽經驗",
      },
      {
        name: "profilePhotoUrl",
        label: "老師照片",
        requirement: "建議，可稍後補上",
        preview: "正式上傳策略確認後開放",
      },
    ],
  },
  {
    title: "教學風格與背景",
    description: "用清楚、溫和的方式描述你如何帶領練習，而不是把老師壓縮成標籤。",
    fields: [
      {
        name: "bio",
        label: "老師簡介",
        requirement: "送審時必填",
        preview: "簡短說明你的練習背景、服務對象與教學關懷",
      },
      {
        name: "teachingStyle",
        label: "教學風格",
        requirement: "送審時必填",
        preview: "例如：穩定、細緻、重視呼吸與身體覺察",
      },
      {
        name: "certifications",
        label: "證照或訓練背景",
        requirement: "建議，可留空",
        preview: "例如：RYT 200、陰瑜伽培訓、孕產瑜伽進修",
      },
    ],
  },
  {
    title: "服務範圍與合作形式",
    description: "協助平台判斷哪些團課需求真正適合你，避免倉促媒合或不清楚的合作期待。",
    fields: [
      {
        name: "specialties",
        label: "擅長類型",
        requirement: "送審時至少一項",
        preview: "例如：哈達、陰瑜伽、伸展、企業放鬆課",
      },
      {
        name: "serviceAreas",
        label: "可服務區域",
        requirement: "送審時至少一項",
        preview: "例如：台北市、新北市、線上團課",
      },
      {
        name: "teachingFormats",
        label: "授課形式",
        requirement: "送審時至少一項",
        preview: "例如：實體團課、企業內訓、線上課",
      },
      {
        name: "priceRange",
        label: "參考收費區間",
        requirement: "建議，可留空",
        preview: "作為合作溝通參考，不作低價競標或排序",
      },
    ],
  },
];

export default function TeacherJoinPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-10 sm:px-8 sm:py-14">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-amber-700">
            Free Soar Yoga teacher community
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">
            與我們一起建立更清楚、更安心的瑜伽團課合作
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
            Free Soar Yoga 重視老師的專業、風格與教學界線。我們希望讓團主的需求被清楚整理，也讓老師能被正確理解，回應真正適合自己的團課機會。
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white"
              href="/sign-in"
            >
              登入並準備加入
            </Link>
            <Link
              className="rounded border border-gray-300 px-5 py-3 text-center text-sm font-medium text-gray-900"
              href="/"
            >
              回到首頁
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            Teacher application form 會在後續 slice 開放；目前可先登入，準備後續建立老師資料。
          </p>
        </div>

        <div className="rounded border border-amber-100 bg-amber-50/60 p-5">
          <h2 className="text-lg font-medium text-gray-950">
            我們尋找的不是可被比較的商品，而是能共同照顧練習品質的合作夥伴。
          </h2>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            平台會以審核、需求整理與清楚的溝通流程，支持老師與團主建立信任，而不是用低價競標或倉促媒合推動合作。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {collaborationPrinciples.map((principle) => (
          <article
            className="rounded border border-gray-200 bg-white p-5"
            key={principle}
          >
            <p className="text-sm leading-6 text-gray-700">{principle}</p>
          </article>
        ))}
      </section>

      <section
        aria-labelledby="application-preview-title"
        className="grid gap-6 border-y border-sky-100 bg-sky-50/60 py-6"
      >
        <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <div>
            <p className="text-sm font-medium text-sky-700">
              Application preview
            </p>
            <h2
              className="mt-2 text-2xl font-semibold tracking-tight text-gray-950"
              id="application-preview-title"
            >
              老師申請資料預覽
            </h2>
          </div>
          <p className="text-sm leading-6 text-gray-600">
            正式申請表單尚未開放，本區只是申請資料預覽與準備指引。這裡不會儲存資料，也不會送出審核；後續正式流程會提供可編輯表單與清楚的送審確認。
          </p>
        </div>

        <div className="grid gap-5">
          {applicationSections.map((section) => (
            <section
              className="grid gap-5 border-t border-sky-100 pt-5 first:border-t-0 first:pt-0"
              key={section.title}
            >
              <div className="max-w-2xl">
                <h3 className="text-lg font-medium text-gray-950">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {section.description}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {section.fields.map((field) => (
                  <article
                    className="rounded border border-gray-200 p-4"
                    key={field.name}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-950">
                          {field.label}
                        </p>
                        <p className="mt-1 font-mono text-xs text-gray-500">
                          {field.name}
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        {field.requirement}
                      </span>
                    </div>
                    <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-600">
                      {field.preview}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded border border-gray-200 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-6">
        <div>
          <p className="text-sm font-medium text-amber-700">Next steps</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
            申請流程將分階段開放
          </h2>
        </div>
        <ol className="space-y-4">
          {nextSteps.map((step, index) => (
            <li className="flex gap-3 text-sm leading-6 text-gray-700" key={step}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-700">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
