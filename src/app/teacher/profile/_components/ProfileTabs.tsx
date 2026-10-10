import Link from "next/link";

// 老師資料的三個分頁：①可授課時間（/teacher/profile）②個人資料（/teacher/profile/info）③收款與聯絡（/teacher/profile/payment）。
// 三個網址都在 /teacher/profile 底下，導覽列「老師資料」在每個分頁都會標示為目前頁。
const tabs = [
  { key: "availability", href: "/teacher/profile", label: "可授課時間" },
  { key: "info", href: "/teacher/profile/info", label: "個人資料" },
  { key: "payment", href: "/teacher/profile/payment", label: "收款與聯絡" },
] as const;

export function ProfileTabs({ active }: { active: (typeof tabs)[number]["key"] }) {
  return (
    <nav aria-label="老師資料分頁" className="mt-4 flex gap-2 border-b border-ink/10">
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
              isActive
                ? "border-pine text-pine"
                : "border-transparent text-ink-soft hover:text-clay"
            }`}
            href={tab.href}
            key={tab.key}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
