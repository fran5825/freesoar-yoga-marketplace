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
      className="grid gap-2 rounded-2xl border border-ink/15 bg-white p-5 transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
      href={href}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="min-w-0 break-words text-lg font-semibold text-ink">
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
      {lines.map((line) => (
        <p className="break-words text-sm text-ink-soft" key={line}>
          {line}
        </p>
      ))}
    </Link>
  );
}
