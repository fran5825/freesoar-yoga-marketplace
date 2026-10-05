// organizer-usability-redesign 票 10（spec 3.1／3.2、13.8）：團主入口的兩種開團意圖。
// 只接受兩個允許值；其他值一律當成「沒有意圖」，走既有 last-role 行為，不猜測。
export type OrganizerIntent = "find_teacher" | "direct_class";

const intentDestinations: Record<OrganizerIntent, string> = {
  find_teacher: "/organizer/demands/new",
  direct_class: "/organizer/class-proposals/new",
};

// 「我已有合作老師」入口是否公開（入口卡片、總覽與我的課程的捷徑）。
// 2026-10-05 產品主人決定：先不公開，等票 09 的老師端開放／取消 origin guards 落地（spec §8：
// 受邀老師不能從老師端取消團主的課）後再改成 true。網址與 intent 仍可用，只是不放入口。
export const DIRECT_CLASS_ENTRY_PUBLIC = false;

export function isOrganizerIntentPublic(intent: OrganizerIntent): boolean {
  return intent === "find_teacher" || DIRECT_CLASS_ENTRY_PUBLIC;
}

export function parseOrganizerIntent(value: unknown): OrganizerIntent | null {
  return value === "find_teacher" || value === "direct_class" ? value : null;
}

// 意圖對應的表單頁（已有團主資料時直接前往）。
export function getOrganizerIntentDestination(intent: OrganizerIntent): string {
  return intentDestinations[intent];
}

// 依登入與團主資料狀態，決定入口卡片要連到哪裡，讓每一種身分都一路走到正確流程：
// - 訪客：先登入，登入後回入口頁帶著意圖，由入口頁再分流（不在登入前猜身分）。
// - 已登入、還沒有團主資料（包含只有老師身分的人）：先到一頁式團主資料，建立後回意圖表單。
// - 已有團主資料：直接到意圖表單。
export function getOrganizerIntentHref(
  intent: OrganizerIntent,
  viewer: "visitor" | "signed_in_without_organizer" | "organizer",
): string {
  const destination = getOrganizerIntentDestination(intent);

  if (viewer === "organizer") {
    return destination;
  }

  if (viewer === "signed_in_without_organizer") {
    return `/organizer/profile?next=${encodeURIComponent(destination)}`;
  }

  return `/sign-in?callbackUrl=${encodeURIComponent(`/organizers/request?intent=${intent}`)}`;
}
