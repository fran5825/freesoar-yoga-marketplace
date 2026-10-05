import { OrganizerEntryCards } from "./OrganizerEntryCards";

// 2026-09-22 organizer-flow-redesign 第 2 批：還不是團主的人（沒登入／已登入但沒有團主資料）
// 看到的招募內容。比照 teachers/join 的 TeacherJoinExplainer，把原本右側卡片的內容併進標題下方
// 的「左側色條＋條列」。
// organizer-usability-redesign 票 10：主按鈕改成兩張情境卡（找老師／已有合作老師），開團意圖
// 會一路保留到登入與建立團主資料之後。

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
  viewer,
}: {
  viewer: "visitor" | "signed_in_without_organizer";
}) {
  return (
    <>
      {/* 票 10：兩張情境卡緊接在標題下，手機第一個畫面就看得到兩條路徑；介紹往下移。 */}
      <section aria-labelledby="organizer-entry-heading" className="grid gap-5">
        <h1
          className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-5xl"
          id="organizer-entry-heading"
        >
          為公司社團與社區，找到適合的瑜伽老師
        </h1>
        <OrganizerEntryCards headingLevel="h2" viewer={viewer} />
        <p className="text-sm leading-6 text-ink-faint">
          {viewer === "signed_in_without_organizer"
            ? "你已經登入了。第一次使用時，先用一頁填好你的稱呼與團體資料，就會回到你選的流程。"
            : "選好後會先登入或建立帳號；第一次使用時，用一頁填好你的稱呼與團體資料，就會回到你選的流程。"}
        </p>
      </section>

      <section>
        <div className="ml-6 max-w-2xl border-l-4 border-clay/50 pl-4">
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
