import type { ReactNode } from "react";

import { enrollRowId, type EnrollRow as EnrollRowData, type EnrollRowReason } from "@/domain/enrollment/session-enroll-rows";

import { SignInOptions } from "../../_components/sign-in-options";
import { CancelEnrollmentForm } from "../../member/_components/CancelEnrollmentForm";
import { EnrollmentStatusBadge } from "../../member/_components/EnrollmentStatusBadge";
import { TermRowAction, TermRowBadge } from "../../member/_components/TermRowControls";
import { cancelSingleRowAction, enrollRowAction, signInToEnrollRowAction } from "../_actions/enroll-row-actions";
import { OptionalNotes } from "./EnrollReveal";
import { RowExpander } from "./RowExpander";

// inline-member-enroll 票 06（spec 2.1–2.3）：三處列表共用的場次列。顯示什麼完全依 service layer 算好的 row.state。
// returnTo：做完要回到的「這一頁」（含這一頁自己的網址參數，例如來源與「看更多日期」）。

const reasonCopy: Record<EnrollRowReason, string> = {
  full: "已額滿",
  started: "已開始或已結束",
  closed: "目前不開放報名",
  teacher_unavailable: "這位老師目前無法接受新報名",
  term_only: "",
  blocked_teacher: "老師婉拒了這次報名，無法重新報名",
  blocked_admin: "這筆報名已由管理員取消，無法重新報名",
  blocked_other: "這筆報名已取消，無法再次報名",
  series_withdrawn: "你已退出這一期，這一堂無法再報名",
  series_declined: "老師婉拒了你的整期報名，這一堂無法再報名",
};

const submitClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:w-fit";

// message 為 null：只有 open／focus（例如登入回來要自動展開那一列），沒有結果訊息。
export type RowFeedback = { success: boolean; message: string | null; focus: string | null; open: string | null };

export function EnrollRow({
  row,
  main,
  signedIn,
  returnTo,
  feedback,
}: {
  row: EnrollRowData;
  // 列左側：日期連結與這一場的時間／地點註記。
  main: ReactNode;
  signedIn: boolean;
  returnTo: string;
  feedback: RowFeedback | null;
}) {
  const rowId = enrollRowId(row.classSessionId);
  // 失敗訊息顯示在這一列上方；成功訊息由頁面頂部顯示。
  const rowError = feedback?.message && !feedback.success && feedback.focus === rowId ? feedback.message : null;
  const keepOpen = feedback?.open === rowId;

  return (
    <li className="grid scroll-mt-6 gap-3 rounded-xl border border-ink/10 px-4 py-3 text-sm" id={rowId}>
      {rowError ? (
        <p aria-live="polite" className="rounded-xl border border-gold/25 bg-gold-tint px-3 py-2 text-sm leading-6 text-gold-deep">
          {rowError}
        </p>
      ) : null}
      <RowBody keepOpen={keepOpen} main={main} returnTo={returnTo} row={row} rowId={rowId} signedIn={signedIn} />
    </li>
  );
}

function RowBody({
  row,
  rowId,
  main,
  signedIn,
  returnTo,
  keepOpen,
}: {
  row: EnrollRowData;
  rowId: string;
  main: ReactNode;
  signedIn: boolean;
  returnTo: string;
  keepOpen: boolean;
}) {
  const state = row.state;

  if (state.kind === "enroll") {
    const label = state.reEnroll ? "重新報名" : row.requiresApproval ? "申請報名" : "報名";

    return (
      <RowExpander
        aside={state.reEnroll ? <span className="text-ink-soft">已取消</span> : <span className="text-pine">剩 {row.remainingSeats} 個名額</span>}
        buttonLabel={label}
        defaultOpen={keepOpen}
        main={main}
      >
        <PriceInfo row={row} />
        {signedIn ? (
          <form action={enrollRowAction} className="grid gap-4">
            <input name="classSessionId" type="hidden" value={row.classSessionId} />
            <input name="returnTo" type="hidden" value={returnTo} />
            {state.reEnroll ? <input name="reEnroll" type="hidden" value="1" /> : null}
            {row.requiresApproval ? <p className="text-sm leading-6 text-ink-soft">送出後會等待老師確認，結果會顯示在「通知」。</p> : null}
            <OptionalNotes id={`notes-${row.classSessionId}`} />
            <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
              <input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />
              我了解此課程非醫療行為，會依自身身體狀況參與。
            </label>
            <button className={submitClass} type="submit">
              {row.requiresApproval
                ? state.reEnroll ? "重新送出報名申請" : "送出報名申請"
                : state.reEnroll ? "重新報名" : "確認報名"}
            </button>
          </form>
        ) : (
          <>
            <p className="text-sm leading-6 text-ink-soft">
              登入後回到這裡，由你確認後才會送出報名。第一次使用會自動建立帳號。
            </p>
            <SignInOptions
              action={signInToEnrollRowAction}
              buttonClassName={submitClass}
              fields={{ classSessionId: row.classSessionId, returnTo }}
              label={(provider) => `使用 ${provider} 登入並報名`}
            />
          </>
        )}
      </RowExpander>
    );
  }

  if (state.kind === "single") {
    return (
      <>
        <RowLine aside={<EnrollmentStatusBadge status={state.status} />} main={main} />
        {state.canCancel && row.ownEnrollmentId ? (
          <CancelEnrollmentForm
            action={cancelSingleRowAction}
            classSessionId={row.classSessionId}
            enrollmentId={row.ownEnrollmentId}
            returnTo={returnTo}
            summaryLabel="取消報名"
            variant="cancel"
          />
        ) : null}
      </>
    );
  }

  if (state.kind === "term") {
    return (
      <>
        <RowLine aside={<TermRowBadge control={state.control} status={state.status} />} main={main} />
        {row.ownEnrollmentId ? (
          <TermRowAction
            classSessionId={row.classSessionId}
            control={state.control}
            enrollmentId={row.ownEnrollmentId}
            returnTo={returnTo}
            rowAnchor={rowId}
            termMode={row.termEnrollmentMode}
          />
        ) : null}
      </>
    );
  }

  if (state.kind === "status_only") {
    return <RowLine aside={<EnrollmentStatusBadge status={state.status} />} main={main} />;
  }

  return <RowLine aside={reasonCopy[state.reason] ? <span className="text-ink-soft">{reasonCopy[state.reason]}</span> : null} main={main} />;
}

function RowLine({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">{main}</div>
      {aside}
    </div>
  );
}

// spec 2.3：送出前看得到這一場實際適用的價格與繳費規則（沒填就不顯示）。
function PriceInfo({ row }: { row: EnrollRowData }) {
  if (!row.priceNote && !row.paymentRulesText) {
    return null;
  }

  return (
    <dl className="grid gap-2 rounded-xl bg-cream px-3 py-2 text-sm leading-6">
      {row.priceNote ? (
        <div>
          <dt className="font-medium text-ink">這一堂的價格</dt>
          <dd className="whitespace-pre-wrap break-words text-ink-soft">{row.priceNote}</dd>
        </div>
      ) : null}
      {row.paymentRulesText ? (
        <div>
          <dt className="font-medium text-ink">繳費與取消規則</dt>
          <dd className="whitespace-pre-wrap break-words text-ink-soft">{row.paymentRulesText}</dd>
        </div>
      ) : null}
    </dl>
  );
}

// 頁面頂部的結果訊息（成功；或不屬於任何列的失敗）。讀網址的 result、message、focus、open。
export function readRowFeedback(query: { result?: string; message?: string; focus?: string; open?: string } | undefined): RowFeedback | null {
  const hasResult = Boolean(query?.result && query.message);

  if (!hasResult && !query?.open && !query?.focus) {
    return null;
  }

  return {
    success: query?.result === "success",
    message: hasResult ? query!.message! : null,
    focus: query?.focus ?? null,
    open: query?.open ?? null,
  };
}

export function PageFeedback({ feedback }: { feedback: RowFeedback | null }) {
  // 屬於某一列的失敗訊息顯示在那一列上方，這裡不重複。
  if (!feedback?.message || (!feedback.success && feedback.focus?.startsWith("session-row-") && feedback.open === feedback.focus)) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      className={
        feedback.success
          ? "rounded-xl border border-pine/15 bg-pine-tint px-4 py-3 text-sm leading-6 text-pine-deep"
          : "rounded-xl border border-gold/25 bg-gold-tint px-4 py-3 text-sm leading-6 text-gold-deep"
      }
      id="action-feedback"
    >
      {feedback.message}
    </section>
  );
}
