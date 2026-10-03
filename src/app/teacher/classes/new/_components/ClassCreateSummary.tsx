import { formatDateWithWeekday } from "../_lib/form-state";

// 單堂「建立前核對」摘要（teacher-usability-redesign 票 01）。
// 顯示的值跟表單送出的值來自同一份 state，所以摘要＝實際會建立的內容；取代原本泛用的「我確認以上資訊無誤」勾選。
export function ClassCreateSummary({
  title,
  date,
  startTime,
  endTime,
  location,
  capacity,
  isPublic,
  requiresApproval,
}: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: string;
  isPublic: boolean;
  requiresApproval: boolean;
}) {
  const timeText =
    startTime && endTime ? `${startTime}–${endTime}（24 小時制）` : null;

  const rows: { label: string; value: string | null }[] = [
    { label: "課程名稱", value: title.trim() || null },
    { label: "排程", value: "單堂" },
    { label: "日期", value: date ? formatDateWithWeekday(date) : null },
    { label: "時間", value: timeText },
    { label: "地點", value: location.trim() || null },
    { label: "名額上限", value: capacity.trim() ? `${capacity.trim()} 人` : null },
    { label: "公開列表", value: isPublic ? "列在公開課程列表" : "不列在公開課程列表" },
    { label: "報名方式", value: requiresApproval ? "需要你確認才算報名成功" : "報名送出即成立" },
  ];

  return (
    <section
      aria-labelledby="single-summary-heading"
      className="grid gap-3 rounded-2xl border border-pine/25 bg-pine-tint/40 p-4 sm:p-5"
    >
      <h2 className="text-base font-medium text-ink" id="single-summary-heading">
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
      </dl>
      <p className="text-xs leading-5 text-ink-soft">
        建立後目前無法修改課程內容，請先確認以上資訊。建立後會先存成草稿，不會立即開放報名；到課程頁按「開放報名」學員才能報名。
      </p>
    </section>
  );
}
