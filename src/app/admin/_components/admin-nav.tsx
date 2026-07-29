import Link from "next/link";

// D10（admin-dashboard-plan）：四個既有 admin 頁面互相沒有任何連結，加上這個最小共用導覽列，
// 不做成 layout.tsx（四個頁面各自的 page.tsx 已經有自己的 requireAdmin() 把關與版型，硬做
// 共用 layout 需要調整既有結構，超出「加一列連結」這個最小修正的範圍）。
export function AdminNav() {
  return (
    <nav className="mt-2 flex flex-wrap gap-3 text-sm">
      <Link className="text-sky-700 hover:underline" href="/admin/dashboard">
        Dashboard
      </Link>
      <Link className="text-sky-700 hover:underline" href="/admin/teachers">
        Teachers
      </Link>
      <Link className="text-sky-700 hover:underline" href="/admin/demands">
        Demands
      </Link>
      <Link className="text-sky-700 hover:underline" href="/admin/classes">
        Classes
      </Link>
    </nav>
  );
}
