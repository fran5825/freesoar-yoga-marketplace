import { redirect } from "next/navigation";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { SiteShell } from "../../_components/site-shell";

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

  // 2026-09-27 signed-in-navigation 票 05：登入但還不是團主的人用學員專區導覽列（有角色切換），
  // 不再用公開 header；頁面內容不變。
  return (
    <SiteShell
      publicMainClassName="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14"
      signedInArea="member"
      signedInClassName="flex flex-col gap-10"
    >
      <OrganizerRequestExplainer isSignedIn={currentUser !== null} />
    </SiteShell>
  );
}
