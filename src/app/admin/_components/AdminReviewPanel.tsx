"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import { idleAdminActionState, type AdminActionState } from "../_lib/action-state";
import { AdminActionError, AdminStaleNotice, findStaleState } from "./AdminActionFeedback";
import { ReasonTemplateField, type ReasonTemplate } from "./ReasonTemplateField";

type ReviewAction = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

// 第二批票 05／06：老師申請與需求共用的審核操作。
// - 核准（通過／公開）一鍵送出；退回先展開原因，再明確送出。
// - 任一個送出中，兩個按鈕都停用，避免連點或同時送出互斥的決定。
// - 失敗時留在本頁，原因保留在本頁表單狀態（不放 URL、不另存），修正後可重試；
//   資格已變時改成停用操作並提供重新載入／回列表，原因仍留在畫面上。
// 用 onSubmit 自己送出而不是讓 <form action> 接手，因為 React 在 action 結束後會清空表單，
// 失敗時管理員填好的原因會被洗掉。
export function AdminReviewPanel({
  idField,
  id,
  returnTo,
  detailHref,
  approveAction,
  rejectAction,
  labels,
  reasonHint,
  reasonPlaceholder,
  templates,
}: {
  idField: string;
  id: string;
  returnTo: string;
  detailHref: string;
  approveAction: ReviewAction;
  rejectAction: ReviewAction;
  labels: {
    approve: string;
    approvePending: string;
    approveRetry: string;
    rejectOpen: string;
    rejectPending: string;
    backToList: string;
  };
  reasonHint: string;
  reasonPlaceholder: string;
  templates: ReasonTemplate[];
}) {
  const [approveState, approveFormAction, approvePending] = useActionState(approveAction, idleAdminActionState);
  const [rejectState, rejectFormAction, rejectPending] = useActionState(rejectAction, idleAdminActionState);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  // 說明一律取自回報資格變動的那次結果，不沿用另一個表單先前的暫時失敗訊息。
  const staleState = findStaleState([approveState, rejectState]);
  const stale = staleState?.stale;
  const busy = approvePending || rejectPending || Boolean(stale);

  function submitWith(action: (formData: FormData) => void) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) return;
      const formData = new FormData(event.currentTarget);
      startTransition(() => action(formData));
    };
  }

  return (
    <div className="grid gap-4">
      {staleState?.stale ? (
        <AdminStaleNotice
          backToListLabel={labels.backToList}
          detailHref={detailHref}
          keptInputNote="這頁的審核操作已停用；如果已填退回原因，內容仍保留在下方，需要的話可以先複製。"
          kind={staleState.stale}
          message={staleState.message}
          returnTo={returnTo}
        />
      ) : null}
      <form action={approveFormAction} onSubmit={submitWith(approveFormAction)}>
        <input name="returnTo" type="hidden" value={returnTo} />
        <input name={idField} type="hidden" value={id} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            className="w-full rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={busy}
            type="submit"
          >
            {approvePending ? labels.approvePending : labels.approve}
          </button>
          {isRejectOpen ? null : (
            <button
              aria-controls="reject-form"
              aria-expanded={false}
              className="w-full rounded-full border border-rose-300 px-5 py-2 text-sm font-medium text-rose-800 transition hover:border-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={busy}
              onClick={() => setIsRejectOpen(true)}
              type="button"
            >
              {labels.rejectOpen}
            </button>
          )}
        </div>
        <AdminActionError hidden={Boolean(stale)} nextStep={labels.approveRetry} state={approveState} />
      </form>

      {isRejectOpen ? (
        <form
          action={rejectFormAction}
          className="grid gap-3 rounded-xl border border-rose-200 bg-white p-4"
          id="reject-form"
          onSubmit={submitWith(rejectFormAction)}
        >
          <input name={idField} type="hidden" value={id} />
          <input name="confirmReject" type="hidden" value="yes" />
          <input name="returnTo" type="hidden" value={returnTo} />
          <ReasonTemplateField
            autoFocus
            hint={reasonHint}
            id="reject-reason"
            label="退回原因"
            maxLength={1000}
            minLength={10}
            name="rejectionReason"
            placeholder={reasonPlaceholder}
            templates={templates}
          />
          <AdminActionError hidden={Boolean(stale)} nextStep="已填的原因仍保留，修正後可以再送出一次。" state={rejectState} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="w-full rounded-full bg-rose-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={busy}
              type="submit"
            >
              {rejectPending ? labels.rejectPending : "送出退回"}
            </button>
            <button
              className="w-full rounded-full border border-ink/30 px-5 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={busy}
              onClick={() => setIsRejectOpen(false)}
              type="button"
            >
              先不退回
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

