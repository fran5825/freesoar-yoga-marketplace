import Link from "next/link";

import { adminListHref, type AdminListKind, type AdminListQuery } from "../_lib/list-context";

export function AdminSearchForm({ kind, query, label, hint }: {
  kind: AdminListKind;
  query: { q: string; status: string };
  label: string;
  hint: string;
}) {
  return (
    <form key={`${query.status}:${query.q}`} action={`/admin/${kind}`} method="get" role="search" aria-label={label} className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-4 sm:p-5">
      <label className="text-sm font-medium text-ink" htmlFor={`search-${kind}`}>{label}</label>
      <input name="status" type="hidden" value={query.status} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="min-w-0 flex-1 rounded-xl border border-ink/30 bg-white px-3 py-2 text-base text-ink focus:outline-2 focus:outline-clay" defaultValue={query.q} id={`search-${kind}`} maxLength={200} name="q" placeholder={hint} type="search" />
        <button className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay" type="submit">搜尋</button>
      </div>
      <p className="break-words text-xs leading-5 text-ink-soft">{hint}；輸入後按搜尋或 Enter。</p>
      {query.q ? (
        <div className="flex flex-wrap gap-3 text-sm text-ink-soft">
          <p className="min-w-0 wrap-anywhere">關鍵字：{query.q}</p>
          <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref(kind, { status: query.status })}>清除關鍵字</Link>
          <Link className="font-medium text-clay underline underline-offset-4" href={adminListHref(kind)}>清除全部條件</Link>
        </div>
      ) : null}
    </form>
  );
}

export function AdminListResults({ count, query }: { count: number; query: AdminListQuery }) {
  return <p className="text-sm text-ink-soft" role="status">{query.q ? "搜尋結果" : "目前顯示"}：{count} 筆</p>;
}
