import Link from "next/link";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";

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
  const [teacherProfile, organizerContext] = await Promise.all([
    getOwnTeacherProfileApplicationSnapshot(),
    getOwnOrganizerContext(),
  ]);

  const teacherHref = teacherProfile ? "/teacher/dashboard" : "/teachers/join";
  const organizerHref = organizerContext
    ? "/organizer/dashboard"
    : "/organizers/request";

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

  return (
    <main className="min-h-screen overflow-hidden bg-cream text-ink">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-clay">讓團體練習，自然發生</p>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-6xl">
              連結好老師與你的瑜伽團課平台
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#536158]">
              連結真實的團課需求與專業瑜伽老師，與團主、學員共同形成安心而有品質的團課。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="rounded-full bg-pine px-6 py-3 text-center font-medium text-white transition hover:bg-pine-deep" href={organizerHref}>
                {organizerContext ? "前往團主總覽" : "我想發起團課 →"}
              </Link>
              <Link className="rounded-full border border-pine/30 bg-white/50 px-6 py-3 text-center font-medium transition hover:border-pine" href="/classes">
                找一堂適合我的課
              </Link>
            </div>
          </div>

          <div aria-label="Free Soar 品牌精神" className="relative mx-auto aspect-square w-full max-w-md rounded-[42%_58%_52%_48%] bg-sage p-8 sm:p-12">
            <div className="flex h-full flex-col justify-between rounded-[38%_62%_45%_55%] border border-white/80 bg-white/45 p-7 backdrop-blur-sm">
              <p className="text-sm tracking-[0.18em] text-[#6d7d70]">FREEDOM · AWAKENING</p>
              <p className="text-3xl font-medium leading-snug text-pine">從舒展身體開始，<br />慢慢找回內在寧靜</p>
              <p className="text-sm tracking-[0.18em] text-[#6d7d70]">GROWTH · COMMUNITY</p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-pine py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-sm font-medium tracking-[0.2em] text-[#cfdbd1]">找到你的起點</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">不論你是團主、老師，還是想找一堂課的學員</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pathways.map((pathway) => (
              <article className="flex flex-col rounded-3xl border border-white/15 bg-white/[0.07] p-7 sm:p-9" key={pathway.href}>
                <p className="text-sm text-[#cfdbd1]">{pathway.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-medium leading-snug">{pathway.title}</h3>
                <p className="mt-4 flex-1 leading-7 text-[#e3e9e4]">{pathway.description}</p>
                <Link className="mt-7 inline-flex min-h-11 items-center font-medium underline decoration-white/35 underline-offset-8 hover:decoration-white" href={pathway.href}>
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
