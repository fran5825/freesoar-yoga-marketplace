import type { ReactNode } from "react";

// teacher-series-rollup 票 01（spec 2.2）：單堂頁標題下方的操作列，老師、團主、管理員共用。
// 第一顆、第二顆永遠露出；其餘動作在版面夠寬時攤開成同一排，手機寬度放不下時收進「更多」。
// （兩份其餘動作只會有一份顯示，另一份用 display:none 隱藏，不在無障礙樹裡重複出現。）
export function ActionBar({
  primary,
  secondary,
  rest,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  rest: { key: string; node: ReactNode }[];
}) {
  if (!primary && !secondary && rest.length === 0) {
    return null;
  }

  return (
    <div aria-label="課程操作" className="flex flex-wrap items-start gap-2" role="group">
      {primary}
      {secondary}
      {rest.length > 0 ? (
        <>
          <div className="hidden flex-wrap items-start gap-2 sm:flex">
            {rest.map((item) => (
              <div key={item.key}>{item.node}</div>
            ))}
          </div>
          <details className="relative sm:hidden">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-medium text-ink marker:hidden">
              更多…
            </summary>
            <div className="mt-2 grid gap-2 rounded-xl border border-ink/15 bg-white p-3">
              {rest.map((item) => (
                <div key={item.key}>{item.node}</div>
              ))}
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

// 按鈕旁的「ⓘ」：需要一眼看懂的說明才放，點開才顯示一兩句，不佔版面。
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="inline-block text-sm">
      <summary aria-label={label} className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-ink-soft marker:hidden hover:text-ink">
        ⓘ
      </summary>
      <div className="mt-1 max-w-sm rounded-xl border border-ink/15 bg-white px-3 py-2 leading-6 text-ink-soft">{children}</div>
    </details>
  );
}
