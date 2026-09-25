import Link from "next/link";

// 票 06：聯絡資料不齊時，在需求表單最上方就提醒，而不是填完整張表送審才被擋。
// 連到資料頁並帶上 next，補完儲存後會直接回到這張表單；草稿內容因為存在資料庫所以不會遺失
// （新需求還沒存過草稿的話，回來會是空白表單，所以提醒文字建議先儲存草稿）。
export function ContactIncompleteBanner({ returnPath }: { returnPath: string }) {
  return (
    <div
      className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep"
      role="status"
    >
      送出需求審核前，需要先補齊組織聯絡資料（聯絡窗口、電話、信箱）。你可以先填草稿；建議先儲存草稿，再{" "}
      <Link
        className="font-medium underline underline-offset-4"
        href={`/organizer/profile?next=${encodeURIComponent(returnPath)}`}
      >
        前往補齊聯絡資料
      </Link>
      ，補完會自動回到這裡。
    </div>
  );
}
