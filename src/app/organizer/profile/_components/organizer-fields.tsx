import type { ReactNode } from "react";

export const organizerInputClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

// 聯絡資料還沒填時，欄位框用陶土色標出來（票 05：缺項標紅）。
export const organizerInputMissingClassName =
  "mt-2 w-full rounded-xl border border-clay bg-clay-tint px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

export function OrganizerField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p>
      ) : null}
      {children}
    </label>
  );
}
