import Link from "next/link";

// 票 06：聯絡資料不齊時，在需求表單最上方就提醒，而不是填完整張表送審才被擋。
// 連到團體編輯頁並帶上 returnTo，補完儲存後會直接回到這張表單；草稿內容因為存在資料庫所以不會遺失
// （新需求還沒存過草稿的話，回來會是空白表單，所以提醒文字建議先儲存草稿）。
// organizer-usability-redesign 票 03：團體資料移到「我的團體」，連結改指向這筆需求所屬團體的編輯頁。
export function ContactIncompleteBanner({
  returnPath,
  organizationId,
}: {
  returnPath: string;
  organizationId: string | null;
}) {
  const target = organizationId
    ? `/organizer/organizations/${organizationId}`
    : "/organizer/organizations/new";

  return (
    <div
      className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep"
      role="status"
    >
      送出需求審核前，需要先補齊組織聯絡資料（聯絡窗口、電話、信箱）。你可以先填草稿；建議先儲存草稿，再{" "}
      <Link
        className="font-medium underline underline-offset-4"
        href={`${target}?returnTo=${encodeURIComponent(returnPath)}`}
      >
        前往補齊聯絡資料
      </Link>
      ，補完會自動回到這裡。
    </div>
  );
}
