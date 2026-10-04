import type { AdminActionState, AdminStaleKind } from "../_lib/action-state";

// 第二批票 05–07：操作失敗時的兩種提示，審核（通過／退回）與老師狀態（暫停／恢復）共用。

// 找出回報資格變動的那次結果；說明一律取自它，不沿用其他表單先前的暫時失敗訊息。
export function findStaleState(states: AdminActionState[]) {
  return states.find(
    (state): state is Extract<AdminActionState, { status: "error" }> =>
      state.status === "error" && Boolean(state.stale),
  );
}

// 資格已變：這頁的操作已停用，提供重新載入（已被處理）或回列表（已不存在）。
export function AdminStaleNotice({
  kind,
  message,
  detailHref,
  returnTo,
  backToListLabel,
  keptInputNote,
}: {
  kind: AdminStaleKind;
  message: string;
  detailHref: string;
  returnTo: string;
  backToListLabel: string;
  keptInputNote: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-ink" role="alert">
      <p>
        {message}
        {keptInputNote}
      </p>
      {/* 用一般 <a> 整頁載入，確保拿到最新狀態，不沿用這頁的舊畫面。 */}
      <a className="mt-2 inline-block font-medium text-clay underline underline-offset-4" href={kind === "changed" ? detailHref : returnTo}>
        {kind === "changed" ? "重新載入，查看目前狀態" : backToListLabel}
      </a>
    </div>
  );
}

// 可重試的失敗（原因不足、暫時失敗）。任一操作回報資格已變時隱藏，整頁改由 AdminStaleNotice 說明。
export function AdminActionError({ state, nextStep, hidden }: { state: AdminActionState; nextStep: string; hidden: boolean }) {
  if (hidden || state.status !== "error") return null;

  return (
    <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900" role="alert">
      {state.message}
      {nextStep}
    </p>
  );
}
