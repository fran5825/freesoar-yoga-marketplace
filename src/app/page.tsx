import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { isHomeViewRequested } from "@/lib/navigation/home-view";
import { getLastRoleHome } from "@/lib/navigation/last-role";

import { LastRoleShell } from "./_components/last-role-shell";
import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";

// homepage-role-aware-entry：首頁原本不管登入與否、有沒有身分，一律顯示同一組
// 「我想發起團課／了解老師加入」引導文案——對已經有 TeacherProfile／OrganizerProfile
// 的使用者來說，這兩個連結應該是回到自己的總覽，而不是再導向一次申請/建立頁。
// getOwnTeacherProfileApplicationSnapshot()／getOwnOrganizerContext() 對未登入或
// 尚未建立過資料的情況都已經安全回傳 null（見各自 service.ts），這裡不需要另外呼叫
// getCurrentUser() 判斷登入狀態——null 時原本連到 /teachers/join、/organizers/request
// 的行為本來就是對的，不管是「未登入」還是「已登入但還沒申請」。
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  // 2026-09-27 signed-in-navigation 決策 6（2026-10-20 修訂）：已登入的人直接打開 `/` 時轉到上次身分的總覽；
  // 從專區導覽列點品牌名稱（帶 view=home）時留在首頁，上方改用上次身分的專區導覽列。
  const [session, { view }] = await Promise.all([auth(), searchParams]);
  const isSignedIn = Boolean(session?.user);

  if (isSignedIn && !isHomeViewRequested(view)) {
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
      audience: "團主與組織者",
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
      audience: "想上課的學員",
      title: "開始你的練習",
      description: "依照程度與生活節奏，探索可以報名的課，找到適合自己的那一堂。",
      href: "/classes",
      action: "探索課程",
    },
    {
      audience: "瑜伽老師",
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
      art: { src: "/home/step-3-art.png", width: 592, height: 366, imgClass: "mr-auto w-[95.6%] lg:m-0 lg:!h-[calc(190*var(--du))] lg:shrink-0" },
    },
  ];

  // 手機／平板用直式插圖，桌機（lg 以上）換成寬幅橫圖；用 <picture> 讓瀏覽器只下載需要的那一張。
  const { props: mobileHero } = getImageProps({ alt: "", height: 783, priority: true, sizes: "100vw", src: "/home/hero-illustration.png", width: 1536 });
  const { props: desktopBanner } = getImageProps({ alt: "", height: 579, priority: true, sizes: "100vw", src: "/home/hero-banner.png", width: 2304 });

  const page = (
    <main className="min-h-screen overflow-hidden bg-white text-home-ink">
      {/* 整頁包在 .home-scale 裡：430px 以上依視窗等比放大，並受螢幕高度限制、單欄置中（見 globals.css）。 */}
      <div className="home-scale">
      {isSignedIn ? null : <PublicHeader variant="home" />}

      {/* 2026-10-20 首頁剪紙團課改版（構圖 .impeccable/mocks/comp-4e.png）：主軸是團課。
          插畫是示意圖，不是真實課程現場；不放人數、評分或推薦語。 */}
      {/* 桌機（lg 以上）照 comp-desktop-a：滿版寬幅橫圖（/home/hero-banner.png），下方文字置中、兩顆按鈕並排。 */}
      <section aria-labelledby="home-heading" className="mx-auto max-w-[calc(430*var(--hu))] lg:max-w-none">
        <picture>
          <source media="(min-width: 1024px)" sizes="100vw" srcSet={desktopBanner.srcSet} />
          {/* src 直接寫出原始檔路徑：瀏覽器實際用 srcSet 載入最佳化版本，這個 src 只是後備，也讓偵測工具看得到圖片來源。 */}
          <img {...mobileHero} src="/home/hero-illustration.png" alt="剪紙風格插畫：一位老師在明亮教室中帶著七位學員練習戰士二式，窗外是新竹的山與城市" className="home-enter h-auto w-full" />
        </picture>
        <div className="px-[min(9.4vw,calc(40.4*var(--hu)))] pb-2 pt-5 lg:flex lg:flex-col lg:items-center lg:px-0 lg:pb-[calc(4*var(--du))] lg:pt-[calc(22*var(--du))] lg:text-center">
          {/* 2026-10-20 finish review：原本主標上方的綠色小標「讓團體練習，自然發生」違反 /impeccable craft-floor 的小標禁令，產品主人同意刪除。 */}
          <h1
            className="home-enter max-w-[9.3em] font-home-display text-[min(max(1.6rem,7.75vw),calc(33.3*var(--hu)))] font-extrabold leading-[1.2] tracking-[0.01em] lg:max-w-none lg:text-[calc(65*var(--du))] lg:leading-[1.15]"
            id="home-heading"
            style={{ "--enter-delay": "120ms" } as React.CSSProperties}
          >
            {/* 一整段文字（螢幕閱讀器讀起來不會被切開），用 9.3em 寬讓它剛好在逗號後換行；字級隨螢幕寬度縮放，360px 也維持兩行。 */}
            找到對的瑜伽老師，讓一群人一起練習
          </h1>
          <p className="home-enter mt-2.5 -mr-4 text-pretty text-[calc(13*var(--hu))] font-semibold leading-[1.6] text-home-indigo lg:mr-0 lg:mt-[calc(8*var(--du))] lg:text-[calc(26*var(--du))] lg:font-medium lg:leading-[1.36]" style={{ "--enter-delay": "180ms" } as React.CSSProperties}>
            飛索把公司社團、社區與小團體的上課需求整理清楚，
            {/* 400px 以上才在逗號後換行（照構圖）；更窄時讓文字自然折行，避免「清楚，」單獨一行。 */}
            <br className="hidden min-[400px]:inline" />
            讓瑜伽老師依自己的時間與風格回應。目前服務大新竹生活圈。
          </p>
          <div className="home-enter mt-1.5 flex flex-col gap-1 lg:mt-[calc(12*var(--du))] lg:flex-row lg:gap-[calc(16*var(--du))]" style={{ "--enter-delay": "240ms" } as React.CSSProperties}>
            {/* 主按鈕 37px、次按鈕 32px、引言 13px、老師連結 12px（依構圖量測）：產品主人 2026-10-20 為貼近構圖決定，低於 PRODUCT.md 的 44px 下限。
                兩顆按鈕同一種內部排法：文字置中、箭頭貼右（產品主人 2026-10-20 選做法 1），主次只用實心／外框區分。 */}
            <Link
              className="home-nudge home-press relative inline-flex h-[calc(37*var(--hu))] items-center justify-center rounded-full bg-home-navy px-12 font-home-display text-base lg:h-[calc(66*var(--du))] lg:w-[calc(422*var(--du))] lg:text-[calc(28*var(--du))] font-extrabold tracking-[0.04em] text-white transition hover:bg-home-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
              href={organizerHref}
            >
              我要發起團課
              <ArrowIcon className="home-nudge-arrow absolute right-5 size-6 lg:right-[calc(40*var(--du))] lg:size-[calc(34*var(--du))]" />
            </Link>
            <Link
              className="home-nudge home-press relative inline-flex h-8 items-center justify-center rounded-full border-[calc(1.5*var(--hu))] border-home-indigo bg-home-band px-12 font-home-display text-base lg:h-[calc(66*var(--du))] lg:w-[calc(422*var(--du))] lg:border-[calc(2.5*var(--du))] lg:bg-white lg:text-[calc(28*var(--du))] font-extrabold tracking-[0.04em] text-home-indigo transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
              href="/classes"
            >
              我要找一堂課
              <ArrowIcon className="home-nudge-arrow absolute right-5 size-6 lg:right-[calc(40*var(--du))] lg:size-[calc(34*var(--du))]" />
            </Link>
          </div>
          <p className="home-enter mt-1.5 text-center leading-none lg:mt-[calc(14*var(--du))]" style={{ "--enter-delay": "300ms" } as React.CSSProperties}>
            <Link
              className="home-nudge inline-flex items-center gap-1 text-xs font-bold text-home-indigo underline decoration-home-indigo underline-offset-2 lg:gap-[calc(6*var(--du))] lg:border-b-[calc(1.5*var(--du))] lg:border-home-indigo lg:pb-[calc(2*var(--du))] lg:text-[calc(20*var(--du))] lg:no-underline hover:decoration-home-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
              href={teacherHref}
            >
              你是瑜伽老師？了解如何加入
              <ArrowIcon className="home-nudge-arrow size-3.5 lg:size-[calc(20*var(--du))]" />
            </Link>
          </p>
        </div>
      </section>

      {/* 說明一堂團課怎麼成形。只寫流程事實，不放人數或推薦語。 */}
      <section aria-labelledby="how-it-works-heading" className="border-t border-home-navy/10 bg-home-band pb-14 pt-0.5 lg:pb-[calc(60*var(--du))] lg:pt-[calc(10*var(--du))]">
        {/* 步驟區照構圖寬度，430px 以上隨 .home-scale 等比放大。 */}
        <div className="mx-auto max-w-[calc(430*var(--hu))] px-5 lg:max-w-[calc(1190*var(--du))] lg:px-0">
          <h2 className="relative z-10 text-center font-home-display text-[calc(19*var(--hu))] font-extrabold leading-tight tracking-[0.04em] lg:text-[calc(40*var(--du))]" id="how-it-works-heading">一堂團課，這樣成形</h2>
          <ol className="-mt-3 grid grid-cols-3 gap-2 lg:-mt-[calc(4*var(--du))] lg:gap-[calc(90*var(--du))]">
            {howItWorks.map((step) => (
              <li className="home-reveal flex flex-col items-center text-center" key={step.title}>
                {/* 三張插圖比例不同（第三張較高），放進同比例的框、靠下對齊，讓下方標籤排在同一條線上；
                    第三張照構圖量測右側留邊（283/296）。 */}
                <div className="flex aspect-[296/183] w-full items-end justify-center lg:aspect-auto lg:h-[calc(156*var(--du))]">
                  <Image alt="" className={`h-auto ${step.art.imgClass} lg:h-full lg:w-auto lg:max-w-full`} height={step.art.height} loading="eager" sizes="33vw" src={step.art.src} width={step.art.width} />
                </div>
                <h3 className="mt-0.5 font-home-display text-[calc(12.8*var(--hu))] font-extrabold leading-snug lg:mt-0 lg:text-[calc(29*var(--du))]">{step.title}</h3>
                <p className="mt-2 text-balance text-xs leading-5 text-home-indigo lg:mt-[calc(10*var(--du))] lg:break-keep lg:text-[calc(18*var(--du))] lg:leading-[1.6]">{step.description}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-balance text-center text-[calc(13*var(--hu))] font-semibold leading-6 text-home-indigo lg:mt-[calc(36*var(--du))] lg:text-[calc(20*var(--du))]">老師也可以自己開設單堂或固定課程，讓學員直接報名。</p>
        </div>
      </section>

      {/* 2026-10-20 sections 關：沿用首屏的白底、深藍粗標題與細線，不加卡片或陰影；和首屏同一個置中單欄、同一套縮放。
          finish review 後拿掉標題上方的小標（/impeccable craft-floor 禁令）：角色名稱改當 h3，原本的標題併為內文第一句。 */}
      <section aria-labelledby="pathways-heading" className="bg-white py-12 lg:py-[calc(80*var(--du))]">
        <div className="mx-auto max-w-[calc(430*var(--hu))] px-[min(9.4vw,calc(40.4*var(--hu)))] lg:max-w-[calc(1190*var(--du))] lg:px-0">
          <h2 className="max-w-[10.6em] font-home-display text-[calc(22*var(--hu))] font-extrabold leading-[1.35] lg:max-w-none lg:text-[calc(40*var(--du))]" id="pathways-heading">
            不論你是團主、老師，還是想找一堂課的學員
          </h2>
          <ul className="mt-6 border-t border-home-navy/15 lg:mt-[calc(36*var(--du))] lg:grid lg:grid-cols-3 lg:gap-[calc(60*var(--du))] lg:border-t-0">
            {pathways.map((pathway) => (
              <li className="home-reveal border-b border-home-navy/15 py-5 lg:border-b-0 lg:border-t lg:pt-[calc(24*var(--du))]" key={pathway.href}>
                <h3 className="font-home-display text-[calc(17*var(--hu))] font-extrabold leading-snug lg:text-[calc(28*var(--du))]">{pathway.audience}</h3>
                <p className="mt-1.5 text-pretty text-[calc(13*var(--hu))] font-semibold leading-[1.7] text-home-indigo lg:mt-[calc(10*var(--du))] lg:text-[calc(18*var(--du))]">
                  <span className="font-bold text-home-ink">{pathway.title}。</span>
                  {pathway.description}
                </p>
                <Link
                  className="home-nudge mt-1 inline-flex min-h-11 items-center gap-1 text-[calc(13*var(--hu))] font-bold lg:text-[calc(18*var(--du))] text-home-indigo underline decoration-home-indigo underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-green"
                  href={pathway.href}
                >
                  {pathway.action}
                  <ArrowIcon className="home-nudge-arrow size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PublicFooter showSignIn={!isSignedIn} variant="home" />
      </div>
    </main>
  );

  return isSignedIn ? <LastRoleShell fullWidth>{page}</LastRoleShell> : page;
}

function ArrowIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} viewBox="0 0 24 24">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}
