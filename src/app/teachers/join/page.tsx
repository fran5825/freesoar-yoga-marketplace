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
