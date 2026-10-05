import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getOrganizerIntentHref,
  parseOrganizerIntent,
} from "@/domain/organizer-profile/intent";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { SiteShell } from "../../_components/site-shell";
import { OrganizerShell } from "../../organizer/_components/OrganizerShell";

import { OrganizerEntryCards } from "./_components/OrganizerEntryCards";
import { OrganizerRequestExplainer } from "./_components/OrganizerRequestExplainer";

type OrganizersRequestPageProps = {
  searchParams?: Promise<{ intent?: string }>;
};

// organizer-usability-redesign 票 10：團主入口提供兩種情境（找老師／已有合作老師）。
// 推翻 2026-09-25 票 02「已有團主一律 redirect 到新需求表單」：已有團主改看精簡的兩種選擇。
// - `?intent=` 只接受 find_teacher／direct_class（訪客登入後會帶著回來）。已登入時直接分流到
//   該意圖的下一步：已有團主→表單；還沒有團主資料→一頁式團主資料，建立後回表單。
// - 沒有 intent：訪客與還不是團主的人看招募內容＋兩張卡；已有團主看精簡選擇。
export default async function OrganizersRequestPage({ searchParams }: OrganizersRequestPageProps) {
  const [currentUser, organizerContext, resolvedSearchParams] = await Promise.all([
    getCurrentUser(),
    getOwnOrganizerContext(),
    searchParams,
  ]);

  const viewer = organizerContext
    ? "organizer"
    : currentUser
      ? "signed_in_without_organizer"
      : "visitor";
  const intent = parseOrganizerIntent(resolvedSearchParams?.intent);

  if (intent && viewer !== "visitor") {
    redirect(getOrganizerIntentHref(intent, viewer));
  }

  if (viewer === "organizer") {
    return (
      <OrganizerShell>
        <div className="flex flex-col gap-8">
          <header className="border-b border-ink/15 pb-6">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              這次要怎麼開始？
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
              選一種方式開始安排團課。進行中的需求與課程都在總覽可以找到。
            </p>
          </header>
          <OrganizerEntryCards viewer="organizer" />
          <p className="text-sm">
            <Link
              className="font-medium text-clay underline-offset-4 hover:underline"
              href="/organizer/dashboard"
            >
              回到我的總覽
            </Link>
          </p>
        </div>
      </OrganizerShell>
    );
  }

  // 2026-09-27 signed-in-navigation 票 05：登入但還不是團主的人用學員專區導覽列（有角色切換），
  // 不再用公開 header。
  return (
    <SiteShell
      publicMainClassName="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14"
      signedInArea="member"
      signedInClassName="flex flex-col gap-10"
    >
      <OrganizerRequestExplainer viewer={viewer} />
    </SiteShell>
  );
}
