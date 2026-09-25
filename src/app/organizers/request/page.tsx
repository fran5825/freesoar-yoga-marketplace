import { redirect } from "next/navigation";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";

import { OrganizerRequestExplainer } from "./_components/OrganizerRequestExplainer";

// 2026-09-25 organizer-usability：這頁只給「還不是團主」的人看（招募頁）。
// 已有團主資料的人直接送到新需求表單（票 02，決策 1 修訂），不再多繞一頁「歡迎回來」或總覽
// （推翻 2026-09-21「留在原頁顯示歡迎回來」的決定，見 docs/organizer-usability-plan.md）。
// 1. 沒登入：招募內容，主按鈕去登入（帶 callbackUrl 回到這一頁）
// 2. 已登入、沒有團主資料：招募內容，主按鈕去 /organizer/profile 建立資料
// 3. 已有團主資料：redirect 到 /organizer/demands/new
export default async function OrganizersRequestPage() {
  const [currentUser, organizerContext] = await Promise.all([
    getCurrentUser(),
    getOwnOrganizerContext(),
  ]);

  if (organizerContext) {
    redirect("/organizer/demands/new");
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
        <OrganizerRequestExplainer isSignedIn={currentUser !== null} />
      </main>
      <PublicFooter />
    </div>
  );
}
