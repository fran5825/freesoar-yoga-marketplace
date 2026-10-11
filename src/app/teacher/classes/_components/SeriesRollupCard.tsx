import Link from "next/link";

import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { seriesUrgentLabel, type RollupSession, type SeriesRollupCard } from "@/domain/class-session/teacher-class-list";

// teacher-series-rollup 票 03（spec 2.1）：一個課程系列在清單裡只出現一張卡（仿學員「找課程」的系列卡）。
// 點整張卡進系列頁；卡片底部只顯示最急的一件待處理。老師「我的課程」與管理員課程清單共用。
const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export type TabCountLabel = (count: number) => string;

export function SeriesRollupCardView<T extends RollupSession>({
  card,
  href,
  tabCountLabel,
  originLabel,
  now,
}: {
  card: SeriesRollupCard<T>;
  href: string;
  // 依分頁描述這張卡算進的堂數，例如「3 堂草稿」。
  tabCountLabel: TabCountLabel;
  originLabel?: string | null;
  now: Date;
}) {
  const urgent = seriesUrgentLabel(card.urgent);
  const schedule =
    card.dayOfWeek === null ? `指定日期 ${card.startTime}–${card.endTime}` : `每${weekdayLabels[card.dayOfWeek]} ${card.startTime}–${card.endTime}`;

  return (
    <div
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-ink/15 bg-white transition hover:border-pine/40"
      id={`series-${card.seriesId}`}
    >
      <Link
        className="grid gap-3 p-5 transition hover:bg-pine-tint/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay"
        href={href}
      >
        <article className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-lg font-medium text-ink">{card.title}</h2>
            <span className="w-fit rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">
              {card.seriesKind === "term" ? "期班" : "持續開課"}・{tabCountLabel(card.sessions.length)}
            </span>
            {originLabel ? (
              <span className="w-fit rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">{originLabel}</span>
            ) : null}
          </div>
          <p className="break-words text-sm text-ink-soft">
            {schedule}・{card.next.location}
          </p>
          <p className="text-sm text-ink-soft">
            {card.next.startAt.getTime() > now.getTime() ? "下一堂" : "第一堂"} {formatTaipeiShortDatetime(card.next.startAt)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 text-sm">
            <span className="text-ink-soft">
              已報名 {card.confirmedStudents} 位學員
              {card.pendingStudents > 0 ? `・待確認 ${card.pendingStudents} 位` : ""}
            </span>
            <span className={urgent ? "font-medium text-clay-deep" : "text-ink-soft"}>{urgent ?? "查看每一堂"} →</span>
          </div>
        </article>
      </Link>
    </div>
  );
}
