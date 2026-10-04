import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import type { PublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { classDiscoveryWeekday } from "@/domain/class-session/class-discovery-filters";

export function ClassSummary({ classSession }: { classSession: PublicClassSessionDetail & { organization?: { name: string } | null } }) {
  const items = [
    ["開始時間", `${formatTaipeiDatetime(classSession.startAt)}・${classDiscoveryWeekday(classSession.startAt)}`],
    ["結束時間", formatTaipeiDatetime(classSession.endAt)],
    ["地點", classSession.location],
    ["授課老師", classSession.teacherProfile.displayName ?? "老師"],
    ...(classSession.organization ? [["團體", classSession.organization.name]] : []),
    ...(getClassServiceTypes(classSession).length ? [["課程風格", getClassServiceTypes(classSession).join("、")]] : []),
    ...(classSession.yogaStyles.length ? [["瑜伽類型", classSession.yogaStyles.join("、")]] : []),
  ];
  return (
    <section aria-label="課程重點" className="rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-medium text-ink">{label}</dt><dd className="mt-1 break-words leading-6 text-ink-soft">{value}</dd></div>)}
        <div className="min-w-0"><dt className="font-medium text-ink">報名方式</dt><dd className="mt-1 leading-6 text-ink-soft">{classSession.requiresApproval ? "需老師確認。送出申請後，確認結果會顯示在「通知」。" : "確認報名後即成立。"}</dd></div>
      </dl>
    </section>
  );
}
