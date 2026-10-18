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
  // 2026-10-18 impeccable 改版（診斷報告 Q6）：這一輪優先打動老師，首頁主按鈕改成老師入口；
  // 團主入口留在下方「找到你的起點」卡片與 header 的「發起團課」。

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
    },
    {
      title: "老師依意願回應",
      description: "平台審核需求後才公開，瑜伽老師看到清楚的資訊，自己決定要不要回應。",
    },
    {
      title: "一起成課",
      description: "團主選定老師、建立課程，成員就能在飛索報名。",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-cream text-ink">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-gold">讓團體練習，自然發生</p>
            <h1 className="mt-6 max-w-3xl break-keep text-balance wrap-break-word text-4xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-6xl">
              讓好的瑜伽老師，被需要的團體找到
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft">
              飛索把公司社團、社區與小團體的上課需求整理清楚，讓瑜伽老師依自己的時間與風格回應。目前服務大新竹生活圈。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-pine px-7 font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" href={teacherHref}>
                成為合作老師
              </Link>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-pine/30 bg-white/50 px-7 font-medium transition hover:border-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" href="/classes">
                找一堂課
              </Link>
            </div>
          </div>

          <div aria-label="Free Soar 品牌精神" className="relative mx-auto aspect-square w-full max-w-md rounded-[42%_58%_52%_48%] bg-sage p-8 sm:p-12">
            <div className="flex h-full flex-col justify-between rounded-[38%_62%_45%_55%] border border-white/80 bg-white/45 p-7 backdrop-blur-sm">
              <p className="text-sm tracking-[0.3em] text-ink-soft">自由・覺醒</p>
              <p className="text-2xl font-medium leading-snug text-pine sm:text-3xl">從舒展身體開始，<br />慢慢找回內在寧靜</p>
              <p className="text-sm tracking-[0.3em] text-ink-soft">成長・共創</p>
            </div>
          </div>
        </section>
      </div>

      {/* 2026-10-18 impeccable 改版（診斷報告 Q7）：說明一堂團課怎麼成形。只寫流程事實，不放人數或推薦語。 */}
      <section aria-labelledby="how-it-works-heading" className="bg-sky-mist py-16 text-sky-ink sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl" id="how-it-works-heading">一堂團課，這樣成形</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {howItWorks.map((step) => (
              <li className="border-t border-sky-ink/25 pt-5" key={step.title}>
                <h3 className="text-xl font-medium leading-snug">{step.title}</h3>
                <p className="mt-3 leading-7">{step.description}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-2xl leading-7">老師也可以自己開設單堂或固定課程，讓學員直接報名。</p>
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
