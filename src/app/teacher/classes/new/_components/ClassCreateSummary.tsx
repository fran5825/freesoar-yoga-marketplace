import { formatDateWithWeekday } from "../_lib/form-state";

export type SummaryRow = { label: string; value: string | null };

// 「建立前核對」摘要（teacher-usability-redesign 票 01 單堂、票 02 系列）。
// 顯示的值跟表單送出的值來自同一份 state，所以摘要＝實際會建立的內容；取代原本泛用的「我確認以上資訊無誤」勾選。
// dates：系列實際會建立的日期（每週固定用既有的生成規則推算、指定日期就是送出的清單）。
export function ClassCreateSummary({
  rows,
  dates,
  datesPlaceholder,
  notes,
}: {
  rows: SummaryRow[];
  dates?: string[];
  datesPlaceholder?: string;
  notes: string[];
}) {
  return (
    <section
      aria-labelledby="create-summary-heading"
      className="grid gap-3 rounded-2xl border border-pine/25 bg-pine-tint/40 p-4 sm:p-5"
    >
      <h2 className="text-base font-medium text-ink" id="create-summary-heading">
        建立前核對
      </h2>
      <dl className="grid gap-x-4 gap-y-2 text-sm leading-6 sm:grid-cols-[7rem_1fr]">
        {rows.map((row) => (
          <div className="contents" key={row.label}>
            <dt className="text-ink-soft">{row.label}</dt>
            <dd className={`min-w-0 break-words ${row.value ? "text-ink" : "text-ink-faint"}`}>
              {row.value ?? "尚未填寫"}
            </dd>
          </div>
        ))}
        {dates ? (
          <div className="contents">
            <dt className="text-ink-soft">
              上課日期{dates.length > 0 ? `（共 ${dates.length} 場）` : ""}
            </dt>
            <dd className="min-w-0">
              {dates.length > 0 ? (
                <ul
                  aria-label="會建立的上課日期"
                  className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap"
                >
                  {dates.map((date) => (
                    <li
                      className="rounded-full border border-ink/15 bg-white px-2.5 py-0.5 text-center text-ink sm:text-left"
                      key={date}
                    >
                      {formatDateWithWeekday(date)}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-faint">{datesPlaceholder ?? "尚未填寫"}</span>
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      {notes.map((note) => (
        <p className="text-xs leading-5 text-ink-soft" key={note}>
          {note}
        </p>
      ))}
    </section>
  );
}
