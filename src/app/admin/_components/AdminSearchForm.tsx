import Link from "next/link";

import { adminConditionParams, adminListHref, adminRelationParams, hasAdminRelation, type AdminListKind, type NormalizedAdminListQuery } from "../_lib/list-context";

export function AdminSearchForm({ kind, query, label, hint }: {
  kind: AdminListKind;
  query: NormalizedAdminListQuery;
  label: string;
  hint: string;
}) {
  const relation = adminConditionParams(query);
  return (
    <form key={`${query.status}:${query.q}:${relation.organizationId ?? ""}:${relation.teacherProfileId ?? ""}:${relation.when ?? ""}`} action={`/admin/${kind}`} method="get" role="search" aria-label={label} className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-4 sm:p-5">
      <label className="text-sm font-medium text-ink" htmlFor={`search-${kind}`}>{label}</label>
      <input name="status" type="hidden" value={query.status} />
      {relation.organizationId ? <input name="organizationId" type="hidden" value={relation.organizationId} /> : null}
      {relation.teacherProfileId ? <input name="teacherProfileId" type="hidden" value={relation.teacherProfileId} /> : null}
      {relation.when ? <input name="when" type="hidden" value={relation.when} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="min-w-0 flex-1 rounded-xl border border-ink/30 bg-white px-3 py-2 text-base text-ink focus:outline-2 focus:outline-clay" defaultValue={query.q} id={`search-${kind}`} maxLength={200} name="q" placeholder={hint} type="search" />
        <button className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay" type="submit">搜尋</button>
      </div>
      <p className="break-words text-xs leading-5 text-ink-soft">{hint}；輸入後按搜尋或 Enter。</p>
      {query.q ? (
        <div className="flex flex-wrap gap-3 text-sm text-ink-soft">
          <p className="min-w-0 wrap-anywhere">關鍵字：{query.q}</p>
          <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref(kind, { status: query.status, ...relation })}>清除關鍵字</Link>
          <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref(kind)}>清除全部條件</Link>
        </div>
      ) : null}
    </form>
  );
}

// 第三批票 09：限定列表顯示「目前只看哪個團體／老師」與解除入口。名稱由 server 依 id 查得；
// 查不到時只說找不到，不透露任何其他資料。解除限定保留關鍵字與分類。
export function AdminRelationNotice({ kind, query, label }: {
  kind: AdminListKind;
  query: NormalizedAdminListQuery;
  label: string | null;
}) {
  if (!hasAdminRelation(query)) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-pine/30 bg-pine-tint p-4 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 wrap-anywhere" role="status">{label ?? "找不到這個限定對象，可能已不存在。"}</p>
      <div className="flex flex-wrap gap-3">
        <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref(kind, { q: query.q, status: query.status, when: query.when })}>解除限定</Link>
        <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref(kind)}>清除全部條件</Link>
      </div>
    </div>
  );
}

// 第三批票 13：課程列表「即將開始」條件（從總覽 KPI 進來）。清楚寫出條件，可單獨清除（保留其他條件）。
export function AdminUpcomingNotice({ query }: { query: NormalizedAdminListQuery }) {
  if (query.when !== "upcoming") return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-pine/30 bg-pine-tint p-4 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0" role="status">只看即將開始的課程：開放報名中，且還沒到開始時間。</p>
      <Link
        className="font-medium text-clay underline underline-offset-4"
        href={adminListHref("classes", { ...adminRelationParams(query), q: query.q, status: query.status })}
      >
        清除這個條件
      </Link>
    </div>
  );
}

export function AdminListResults({ count, query }: { count: number; query: NormalizedAdminListQuery }) {
  return <p className="text-sm text-ink-soft" role="status">{query.q ? "搜尋結果" : "目前顯示"}：{count} 筆</p>;
}
