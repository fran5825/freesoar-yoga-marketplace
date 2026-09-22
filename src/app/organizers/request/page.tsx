import { isOrganizationContactComplete } from "@/domain/demand-request/validation";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";

import { OrganizerRequestExplainer } from "./_components/OrganizerRequestExplainer";
import { OrganizerWelcomeBack } from "./_components/OrganizerWelcomeBack";

// 2026-09-22 organizer-flow-redesign 第 2 批：依登入與團主資料狀態顯示三種內容，比照
// teachers/join 用不拋例外的 getCurrentUser() 判斷登入：
// 1. 沒登入：招募內容，主按鈕去登入（帶 callbackUrl 回到這一頁）
// 2. 已登入、沒有團主資料：招募內容，主按鈕去 /organizer/profile 建立資料
// 3. 已有團主資料：「歡迎回來」＋發起新需求入口
export default async function OrganizersRequestPage() {
  const [currentUser, organizerContext] = await Promise.all([
    getCurrentUser(),
    getOwnOrganizerContext(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
        {organizerContext ? (
          <OrganizerWelcomeBack
            displayName={organizerContext.organizerProfile.displayName}
            isContactComplete={
              organizerContext.organization !== null &&
              isOrganizationContactComplete(organizerContext.organization)
            }
          />
        ) : (
          <OrganizerRequestExplainer isSignedIn={currentUser !== null} />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
