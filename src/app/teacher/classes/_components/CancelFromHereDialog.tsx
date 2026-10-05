import { formatTaipeiDatetime } from "@/domain/class-session/timezone";

import { cancelSeriesFromOccurrenceAction } from "../series/[recurringClassSeriesId]/actions";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

export type CancelFromHereOccurrence = {
  id: string;
  startAt: Date;
  confirmedCount: number;
  pendingCount: number;
};

// teacher-class-scheduling 票 03：「從這場以後全部取消」的確認視窗。系列頁每一場與單堂詳情頁共用。
// affected 由呼叫端算好：這一場與之後所有尚未開始的草稿／開放報名場次。按「先不要」或 Escape 不寫入。
export function CancelFromHereDialog({
  recurringClassSeriesId,
  seriesTitle,
  fromClassSessionId,
  affected,
  canGenerateMore,
  triggerAriaLabel,
}: {
  recurringClassSeriesId: string;
  seriesTitle: string;
  fromClassSessionId: string;
  affected: CancelFromHereOccurrence[];
  // 每週固定系列取消後仍可生成更多；指定日期系列不行。
  canGenerateMore: boolean;
  triggerAriaLabel?: string;
}) {
  const confirmedTotal = affected.reduce((sum, item) => sum + item.confirmedCount, 0);
  const pendingTotal = affected.reduce((sum, item) => sum + item.pendingCount, 0);

  return (
    <ConfirmActionDialog
      action={cancelSeriesFromOccurrenceAction}
      confirmLabel={`確定取消 ${affected.length} 場`}
      hiddenFields={{ recurringClassSeriesId, fromClassSessionId }}
      title="從這場以後全部取消？"
      triggerAriaLabel={triggerAriaLabel}
      triggerClassName="min-h-11 rounded-full px-3 text-sm font-medium text-clay underline-offset-4 hover:underline"
      triggerLabel="從這場以後全部取消"
    >
      <p>
        系列：<span className="break-words font-medium text-ink">{seriesTitle}</span>
      </p>
      <p>會取消以下 {affected.length} 場（這一場與之後尚未開始的場次）：</p>
      <ul
        aria-label="會被取消的場次"
        className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-3"
      >
        {affected.map((occurrence) => (
          <li key={occurrence.id}>
            {formatTaipeiDatetime(occurrence.startAt)}
            {occurrence.confirmedCount + occurrence.pendingCount > 0
              ? `（已報名 ${occurrence.confirmedCount}、待確認 ${occurrence.pendingCount}）`
              : ""}
          </li>
        ))}
      </ul>
      <p>
        {confirmedTotal + pendingTotal > 0
          ? `這些場次共有已報名 ${confirmedTotal} 筆、待確認 ${pendingTotal} 筆報名，會一起取消，學員會收到通知。`
          : "這些場次目前沒有人報名。"}
      </p>
      <p>
        這一場之前的場次照常上課。系列會保留
        {canGenerateMore ? "，之後想恢復上課，可以再生成新的場次。" : "。"}
      </p>
    </ConfirmActionDialog>
  );
}

// 從某一場開始、之後所有尚未開始的草稿／開放報名場次（與 domain 核心的篩選一致）。
export function occurrencesFromHere<T extends { startAt: Date; status: string }>(
  occurrences: T[],
  from: { startAt: Date },
  now: number,
): T[] {
  return occurrences.filter(
    (occurrence) =>
      ["draft", "open_for_enrollment"].includes(occurrence.status) &&
      occurrence.startAt.getTime() > now &&
      occurrence.startAt.getTime() >= from.startAt.getTime(),
  );
}
