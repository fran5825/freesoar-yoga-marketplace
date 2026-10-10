import type { ReactNode } from "react";

import { formatTaipeiDatetimeLocal } from "@/domain/class-session/timezone";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import type { PublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { classDiscoveryWeekday } from "@/domain/class-session/class-discovery-filters";

// teacher-class-scheduling 票 14（Q7）：上課時間改成一行「2026/10/12（週一）12:00–13:00」；
// 屬於期班時另加「期間」（termPeriod，由頁面傳入）。
export function classTimeLine(startAt: Date, endAt: Date): string {
  const [date, start] = formatTaipeiDatetimeLocal(startAt).split("T");
  const [, end] = formatTaipeiDatetimeLocal(endAt).split("T");

  return `${date.replaceAll("-", "/")}（${classDiscoveryWeekday(startAt)}）${start}–${end}`;
}

export function ClassSummary({
  classSession,
  termPeriod = null,
  statusSlot = null,
  actionsSlot = null,
}: {
  classSession: PublicClassSessionDetail & { organization?: { name: string } | null };
  termPeriod?: string | null;
  // inline-member-actions 票 03：已報名學員的狀態（卡片頂端）與就地操作／連結（卡片底部）。
  statusSlot?: ReactNode;
  actionsSlot?: ReactNode;
}) {
  const items = [
    ...(termPeriod ? [["期間", termPeriod]] : []),
    ["上課時間", classTimeLine(classSession.startAt, classSession.endAt)],
    ["地點", classSession.location],
    ["授課老師", classSession.teacherProfile.displayName ?? "老師"],
    ...(classSession.organization ? [["團體", classSession.organization.name]] : []),
    ...(getClassServiceTypes(classSession).length ? [["課程風格", getClassServiceTypes(classSession).join("、")]] : []),
    ...(classSession.yogaStyles.length ? [["瑜伽類型", classSession.yogaStyles.join("、")]] : []),
  ];
  return (
    <section aria-label="課程重點" className="rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
      {statusSlot ? <div className="mb-4 border-b border-ink/10 pb-4">{statusSlot}</div> : null}
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-medium text-ink">{label}</dt><dd className="mt-1 break-words leading-6 text-ink-soft">{value}</dd></div>)}
        <div className="min-w-0"><dt className="font-medium text-ink">報名方式</dt><dd className="mt-1 leading-6 text-ink-soft">{classSession.requiresApproval ? "需老師確認。送出申請後，確認結果會顯示在「通知」。" : "確認報名後即成立。"}</dd></div>
      </dl>
      {actionsSlot ? <div className="mt-4 grid gap-3">{actionsSlot}</div> : null}
    </section>
  );
}
