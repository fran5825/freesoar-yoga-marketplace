import Link from "next/link";

import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";

const howItWorksSteps = [
  {
    title: "建立團主資料",
    description:
      "只需要一組顯示名稱與所屬組織，就能開始使用團主功能，不需要平台事先審核即可建立。",
  },
  {
    title: "整理你的需求",
    description:
      "把上課人數、時段、地區與頻率整理成清楚的需求說明，平台會先審核再公開。",
  },
  {
    title: "等待平台審核",
    description:
      "審核通過後，需求才會進入合適老師看得到的範圍；審核前不會被公開曝光。",
  },
];

const audienceExamples = [
  "公司內部瑜伽社團或員工紓壓課程",
  "社區大學、里民活動或親友揪團",
  "希望長期合作、而非單次比價的團體",
];

export default function OrganizersRequestPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-clay">
            Free Soar Yoga organizer community
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            為公司社團與社區，找到適合的瑜伽老師
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">
            Free Soar Yoga 協助團體把上課需求整理清楚，並在平台審核後，讓合適的老師理解並回應真正適合的合作機會。
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/profile"
            >
              建立團主資料
            </Link>
            <Link
              className="rounded-full border border-ink/20 px-5 py-3 text-center text-sm font-medium text-ink transition hover:bg-[#efece4]"
              href="/sign-in"
            >
              登入 / 註冊
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-faint">
            建立團主資料只需要登入帳號，平台不會事先審核你的身分；提出的需求會先經過平台審核，才會進入老師可見的範圍。
          </p>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-clay-tint/60 p-5">
          <h2 className="text-lg font-medium text-ink">
            我們重視清楚溝通，而不是低價競標。
          </h2>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            平台以審核與清楚的需求整理，協助團主與老師建立長期、互相尊重的合作關係。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {howItWorksSteps.map((step, index) => (
          <article
            className="rounded-2xl border border-ink/12 bg-white p-5"
            key={step.title}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/20 text-xs font-medium text-ink-soft">
              {index + 1}
            </span>
            <h3 className="mt-3 text-base font-medium text-ink">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {step.description}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-2xl border border-ink/12 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-6">
        <div>
          <p className="text-sm font-medium text-clay">適合對象</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            這些團體最常與我們合作
          </h2>
        </div>
        <ul className="space-y-3">
          {audienceExamples.map((example) => (
            <li
              className="flex gap-3 text-sm leading-6 text-ink-soft"
              key={example}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/20 text-xs font-medium text-ink-soft">
                •
              </span>
              <span>{example}</span>
            </li>
          ))}
        </ul>
      </section>
      </main>
      <PublicFooter />
    </div>
  );
}
