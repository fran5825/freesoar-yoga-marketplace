import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { getLastRoleHome } from "@/lib/navigation/last-role";

import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";

// homepage-role-aware-entry：首頁原本不管登入與否、有沒有身分，一律顯示同一組
// 「我想發起團課／了解老師加入」引導文案——對已經有 TeacherProfile／OrganizerProfile
// 的使用者來說，這兩個連結應該是回到自己的總覽，而不是再導向一次申請/建立頁。
// getOwnTeacherProfileApplicationSnapshot()／getOwnOrganizerContext() 對未登入或
// 尚未建立過資料的情況都已經安全回傳 null（見各自 service.ts），這裡不需要另外呼叫
// getCurrentUser() 判斷登入狀態——null 時原本連到 /teachers/join、/organizers/request
// 的行為本來就是對的，不管是「未登入」還是「已登入但還沒申請」。
export default async function Home() {
  // 2026-09-27 signed-in-navigation 決策 6：已登入的人不看首頁，直接到上次身分的總覽。
  // 下方依身分切換文案的邏輯因此只剩訪客會走到（兩個 profile 都會是 null），先保留不動。
  const session = await auth();

  if (session?.user) {
    redirect(await getLastRoleHome());
  }

  const [teacherProfile, organizerContext] = await Promise.all([
    getOwnTeacherProfileApplicationSnapshot(),
    getOwnOrganizerContext(),
  ]);

  const teacherHref = teacherProfile ? "/teacher/dashboard" : "/teachers/join";
  const organizerHref = organizerContext
    ? "/organizer/dashboard"
    : "/organizers/request";
  // 2026-10-20 產品主人定案：首頁主軸是團課，第一個行動是「我要發起團課」，老師入口降為按鈕下方的小字連結。

  const pathways = [
    {
      eyebrow: "給團主與組織者",
      title: organizerContext
        ? "查看你的團課需求與合作進度"
        : "為一群人開一堂課",
      description: organizerContext
        ? "回到團主總覽，查看目前的需求狀態、老師回覆，或管理已成立的課程。"
        : "公司、社區與朋友團體，說明情境與期待，讓平台協助你找到合適的老師。",
      href: organizerHref,
      action: organizerContext ? "前往團主總覽" : "提出團課需求",
    },
    {
      eyebrow: "給想上課的學員",
      title: "開始你的練習",
      description: "依照程度與生活節奏，探索可以報名的課，找到適合自己的那一堂。",
      href: "/classes",
      action: "探索課程",
    },
    {
      eyebrow: "給瑜伽老師",
      title: teacherProfile
        ? "查看你的老師申請與課程狀態"
        : "分享你的教學",
      description: teacherProfile
        ? "回到老師總覽，查看目前的審核狀態、已建立的課程，或編輯你的老師資料。"
        : "回應真正適合你的團課需求，或開設自己的固定課程，被合適的團體看見。",
      href: teacherHref,
      action: teacherProfile ? "前往老師總覽" : "了解老師加入",
    },
  ];

  const howItWorks = [
    {
      title: "團主說明需求",
      description: "公司社團、社區或朋友團體，寫下人數、時段、地點與想要的練習。",
      art: { src: "/home/step-1-art.png", width: 560, height: 280, imgClass: "w-full" },
    },
    {
      title: "老師依意願回應",
      description: "平台審核需求後才公開，瑜伽老師看到清楚的資訊，自己決定要不要回應。",
      art: { src: "/home/step-2-art.png", width: 576, height: 284, imgClass: "w-full" },
    },
    {
      title: "一起成課",
      description: "團主選定老師、建立課程，成員就能在飛索報名。",
      art: { src: "/home/step-3-art.png", width: 592, height: 366, imgClass: "mr-auto w-[95.6%]" },
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-white text-home-ink">
      <PublicHeader variant="home" />

      {/* 2026-10-20 首頁剪紙團課改版（構圖 .impeccable/mocks/comp-4e.png）：主軸是團課。
          插畫是示意圖，不是真實課程現場；不放人數、評分或推薦語。 */}
      <section aria-labelledby="home-heading">
        <Image
          alt="剪紙風格插畫：一位老師在明亮教室中帶著七位學員練習戰士二式，窗外是新竹的山與城市"
          className="h-auto w-full"
          height={783}
          priority
          sizes="100vw"
          src="/home/hero-illustration.png"
          width={1536}
        />
        <div className="mx-auto max-w-xl px-[clamp(1.25rem,9.4vw,2.5rem)] pb-2 pt-2.5">
          <p className="text-[0.95rem] font-bold leading-none text-home-green">讓團體練習，自然發生</p>
          <h1
            className="mt-1 max-w-[9.3em] font-home-display text-[2.08rem] font-extrabold leading-[1.2] tracking-[0.01em]"
            id="home-heading"
          >
            {/* 一整段文字（螢幕閱讀器讀起來不會被切開），用 9.3em 寬讓它剛好在逗號後換行。 */}
            找到對的瑜伽老師，讓一群人一起練習
          </h1>
          <p className="mt-2.5 -mr-4 text-pretty text-[0.8125rem] font-semibold leading-[1.6] text-home-indigo">
            飛索把公司社團、社區與小團體的上課需求整理清楚，
            <br />
            讓瑜伽老師依自己的時間與風格回應。目前服務大新竹生活圈。
          </p>
          <div className="mt-1.5 flex flex-col gap-1">
            {/* 主按鈕 37px、次按鈕 32px、引言 13px、老師連結 12px（依構圖量測）：產品主人 2026-10-20 為貼近構圖決定，低於 PRODUCT.md 的 44px 下限。
                兩顆按鈕同一種內部排法：文字置中、箭頭貼右（產品主人 2026-10-20 選做法 1），主次只用實心／外框區分。 */}
            <Link
              className="relative inline-flex h-[37px] items-center justify-center rounded-full bg-home-navy px-12 font-home-display text-base font-extrabold tracking-[0.04em] text-white transition hover:bg-home-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
              href={organizerHref}
            >
              我要發起團課
              <ArrowIcon className="absolute right-5 size-6" />
            </Link>
            <Link
              className="relative inline-flex h-8 items-center justify-center rounded-full border-[1.5px] border-home-indigo bg-home-band px-12 font-home-display text-base font-extrabold tracking-[0.04em] text-home-indigo transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
              href="/classes"
            >
              我要找一堂課
              <ArrowIcon className="absolute right-5 size-6" />
            </Link>
          </div>
          <p className="mt-1.5 text-center leading-none">
            <Link
              className="inline-flex items-center gap-1 text-xs font-bold text-home-indigo underline decoration-home-indigo underline-offset-2 hover:decoration-home-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
              href={teacherHref}
            >
              你是瑜伽老師？了解如何加入
              <ArrowIcon className="size-3.5" />
            </Link>
          </p>
        </div>
      </section>

      {/* 說明一堂團課怎麼成形。只寫流程事實，不放人數或推薦語。 */}
      <section aria-labelledby="how-it-works-heading" className="border-t border-home-navy/10 bg-home-band pb-14 pt-0.5">
        {/* 步驟區照構圖固定在手機寬（430px），插圖不會隨畫面變寬而放大；桌機版在 responsive 關再設計。 */}
        <div className="mx-auto max-w-[430px] px-5">
          <h2 className="relative z-10 text-center font-home-display text-[1.1875rem] font-extrabold leading-tight tracking-[0.04em]" id="how-it-works-heading">一堂團課，這樣成形</h2>
          <ol className="-mt-3 grid grid-cols-3 gap-2">
            {howItWorks.map((step) => (
              <li className="flex flex-col items-center text-center" key={step.title}>
                {/* 三張插圖比例不同（第三張較高），放進同比例的框、靠下對齊，讓下方標籤排在同一條線上；
                    第三張照構圖量測右側留邊（283/296）。 */}
                <div className="flex aspect-[296/183] w-full items-end justify-center">
                  <Image alt="" className={`h-auto ${step.art.imgClass}`} height={step.art.height} loading="eager" sizes="33vw" src={step.art.src} width={step.art.width} />
                </div>
                <h3 className="mt-0.5 font-home-display text-[0.8rem] font-extrabold leading-snug">{step.title}</h3>
                <p className="mt-2 text-xs leading-5 text-home-ink/80">{step.description}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-sm leading-6">老師也可以自己開設單堂或固定課程，讓學員直接報名。</p>
        </div>
      </section>

      <section className="bg-pine py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-sm font-medium tracking-[0.2em] text-sage">找到你的起點</p>
          <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">不論你是團主、老師，還是想找一堂課的學員</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pathways.map((pathway) => (
              <article className="flex flex-col rounded-3xl border border-white/15 bg-white/[0.07] p-7 sm:p-9" key={pathway.href}>
                <p className="text-sm text-sage">{pathway.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-medium leading-snug">{pathway.title}</h3>
                <p className="mt-4 flex-1 leading-7 text-pine-tint">{pathway.description}</p>
                <Link className="mt-7 inline-flex min-h-11 items-center font-medium underline decoration-white/35 underline-offset-8 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href={pathway.href}>
                  {pathway.action} <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function ArrowIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} viewBox="0 0 24 24">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}
