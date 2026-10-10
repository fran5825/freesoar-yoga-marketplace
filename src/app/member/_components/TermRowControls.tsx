import type { TermRowControl } from "@/domain/enrollment/term-row-controls";
import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";

import { leaveRowAction, restoreRowAction, withdrawTermRowAction } from "../_actions/term-row-actions";
import { CancelEnrollmentForm } from "./CancelEnrollmentForm";
import { EnrollmentStatusBadge } from "./EnrollmentStatusBadge";

// inline-member-actions 票 01（spec 3.1）：整期某一堂那一列的狀態標籤與就地操作。
// 「我的報名」、期班頁、單堂頁的同系列列表共用；顯示什麼完全由 service layer 算好的 control 決定。

export function TermRowBadge({ status, control }: { status: string; control: TermRowControl }) {
  if (control.kind === "on_leave") {
    return <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">請假中</span>;
  }

  return <EnrollmentStatusBadge status={status} />;
}

export function TermRowAction({
  control,
  enrollmentId,
  classSessionId,
  termMode,
  returnTo,
}: {
  control: TermRowControl;
  enrollmentId: string;
  classSessionId: string;
  termMode: "term_only" | "term_and_single" | null;
  returnTo: string;
}) {
  if (control.kind === "leave") {
    return (
      <CancelEnrollmentForm
        action={leaveRowAction}
        classSessionId={classSessionId}
        enrollmentId={enrollmentId}
        returnTo={returnTo}
        summaryLabel="請假"
        termMode={termMode}
        variant="leave"
      />
    );
  }

  if (control.kind === "on_leave" && control.restore === "available") {
    return (
      <form action={restoreRowAction} className="relative z-10">
        <input name="enrollmentId" type="hidden" value={enrollmentId} />
        <input name="classSessionId" type="hidden" value={classSessionId} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <button
          className="rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine hover:bg-pine-tint focus-visible:outline-2 focus-visible:outline-pine"
          type="submit"
        >
          取消請假
        </button>
      </form>
    );
  }

  if (control.kind === "on_leave") {
    return <p className="text-sm leading-6 text-ink-soft">{control.note}</p>;
  }

  return null;
}

// 退出整期（就地展開）：列出會取消的堂、已上過的紀錄保留、確認勾選。
export function WithdrawTermInline({
  seriesEnrollmentId,
  affectedStartAts,
  returnTo,
}: {
  seriesEnrollmentId: string;
  affectedStartAts: Date[];
  returnTo: string;
}) {
  return (
    <details className="relative z-10 rounded-xl border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
        退出整期…
      </summary>
      <form action={withdrawTermRowAction} className="grid gap-3 border-t border-amber-100 p-4">
        <input name="seriesEnrollmentId" type="hidden" value={seriesEnrollmentId} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <p className="text-sm font-medium leading-6 text-amber-900">
          {affectedStartAts.length > 0 ? `會取消之後的 ${affectedStartAts.length} 堂：` : "之後沒有要取消的場次。"}
        </p>
        {affectedStartAts.length > 0 ? (
          <ul aria-label="退出後會取消的場次" className="grid gap-1 text-sm text-ink-soft">
            {affectedStartAts.map((startAt) => (
              <li key={startAt.toISOString()}>{formatTaipeiShortDatetime(startAt)}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm leading-6 text-ink-soft">已經上過的紀錄會保留。退出後這一期不能再報整期。</p>
        <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
          <input className="mt-1 shrink-0" name="confirmWithdraw" required type="checkbox" value="yes" />
          我確認要退出這一期。
        </label>
        <button
          className="w-full rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 sm:w-auto"
          type="submit"
        >
          確認退出整期
        </button>
      </form>
    </details>
  );
}
