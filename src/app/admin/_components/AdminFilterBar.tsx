import Link from "next/link";

export type AdminFilterTab = { key: string; label: string; count: number };

// admin-usability 票 04：老師／需求／課程三個列表共用的狀態篩選列。
// 用網址參數 ?status=<key> 切換（重新整理不會掉）；第一個 tab 視為預設，網址不帶參數。
// 只是讀取現有資料的篩選，不改任何狀態。
export function AdminFilterBar({
  ariaLabel,
  basePath,
  tabs,
  activeKey,
}: {
  ariaLabel: string;
  basePath: string;
  tabs: AdminFilterTab[];
  activeKey: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {tabs.map((tab, index) => {
        const isActive = tab.key === activeKey;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
              isActive
                ? "border-pine bg-pine-tint font-medium text-pine"
                : "border-ink/20 text-ink-soft hover:border-ink/40"
            }`}
            href={index === 0 ? basePath : `${basePath}?status=${tab.key}`}
            key={tab.key}
          >
            {tab.label}・{tab.count}
          </Link>
        );
      })}
    </nav>
  );
}

// 網址上的 status 不在 tabs 裡（亂填或舊連結）時，退回第一個 tab。
export function resolveActiveTab<T extends { key: string }>(
  tabs: T[],
  requested: string | undefined,
): T {
  return tabs.find((tab) => tab.key === requested) ?? tabs[0];
}
