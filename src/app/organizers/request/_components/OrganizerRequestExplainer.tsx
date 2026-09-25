import Link from "next/link";

// 2026-09-22 organizer-flow-redesign 第 2 批：還不是團主的人（沒登入／已登入但沒有團主資料）
// 看到的招募內容。兩種狀態只差主按鈕：沒登入先去登入（登入後直接進入開需求流程），已登入就直接去建立團主資料。比照 teachers/join 的
// TeacherJoinExplainer，把原本右側卡片的內容併進標題下方的「左側色條＋條列」。
// 票 02：登入後直接落在新需求表單。新使用者還沒有團主資料，/organizer/demands/new 會自己導向
// /organizer/profile 建立；已是團主的人則直接看到表單，兩種人都不會再回到這頁多看一次招募內容。
const signInHref = `/sign-in?callbackUrl=${encodeURIComponent("/organizer/demands/new")}`;

const valuePoints = [
  "平台以審核與需求整理，協助團主與老師建立長期、互相尊重的合作關係。",
  "建立團主資料只需要登入帳號，平台不會事先審核你的身分。",
  "提出的需求會先經過平台審核，通過後才會進入老師可見的範圍。",
];

const howItWorksSteps = [
  {
    title: "建立團主資料",
    description:
      "只需要一組顯示名稱與所屬組織，就能開始使用團主功能，不需要平台事先審核即可建立。",
  },
  {
    title: "整理你的需求",
    description:
      "把上課人數、時段、地點與頻率整理成清楚的需求說明，平台會先審核再公開。",
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

export function OrganizerRequestExplainer({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  return (
    <>
      <section>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          為公司社團與社區，找到適合的瑜伽老師
        </h1>
        <div className="mt-6 ml-6 max-w-2xl border-l-4 border-clay/50 pl-4">
          <p className="text-base leading-7 text-ink-soft">
            飛索協助團體把上課需求整理清楚，也重視清楚溝通，而不是低價競標：
          </p>
          <ul className="mt-4 space-y-3">
            {valuePoints.map((point) => (
              <li className="flex items-start gap-3" key={point}>
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-clay"
                />
                <span className="text-sm leading-6 text-ink-soft">{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-7 ml-6">
          {isSignedIn ? (
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/profile"
            >
              建立團主資料
            </Link>
          ) : (
            <a
              className="inline-flex rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep"
              href={signInHref}
            >
              登入／建立帳號並開始
            </a>
          )}
        </div>
        <p className="mt-4 ml-6 text-sm leading-6 text-ink-faint">
          {isSignedIn
            ? "你已經登入了，只要填顯示名稱和所屬組織就能開始。"
            : "登入或建立帳號後，就可以建立團主資料、開始整理需求。"}
        </p>
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
    </>
  );
}
