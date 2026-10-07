import Link from "next/link";

// admin-usability 票 04：列表卡片。整張可點；兩行：名稱＋狀態標籤、補充資訊（用「・」串起來）。
// 手機上補充資訊會自然換行，不橫向捲動。
export function AdminListCard({
  href,
  title,
  statusLabel,
  statusToneClass,
  lines,
}: {
  href: string;
  title: string;
  statusLabel?: string;
  statusToneClass?: string;
  lines: string[];
}) {
  return (
    <Link
      className="grid min-w-0 gap-2 rounded-2xl border border-ink/15 bg-white p-4 transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-5 sm:py-3"
      href={href}
    >
      {/* 第四批票 14：沒有空白的長名稱在手機上會撐出卡片（break-words 不會縮小最小寬度），改用 wrap-anywhere。 */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h2 className="min-w-0 max-w-full wrap-anywhere text-lg font-semibold text-ink">
          {title}
        </h2>
        {statusLabel ? (
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusToneClass ?? "bg-sand text-ink"}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-1">{lines.map((line) => (
        <p className="wrap-anywhere text-sm text-ink-soft" key={line}>
          {line}
        </p>
      ))}</div>
    </Link>
  );
}
