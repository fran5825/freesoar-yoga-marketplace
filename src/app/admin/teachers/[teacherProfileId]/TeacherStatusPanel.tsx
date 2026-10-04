"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import { AdminActionError, AdminStaleNotice, findStaleState } from "../../_components/AdminActionFeedback";
import { AdminConfirmButton } from "../../_components/AdminConfirmButton";
import { ReasonTemplateField } from "../../_components/ReasonTemplateField";
import { idleAdminActionState } from "../../_lib/action-state";
import { restoreTeacherProfileAction, suspendTeacherProfileAction } from "../actions";

// 第二批票 07：已通過老師的暫停，與已暫停老師的恢復。
// - 暫停：先填原因，原因有效才開確認視窗（顯示老師名稱與影響），確認後送出。
// - 恢復：一鍵送出，不加確認。
// - 失敗留在本頁、保留原因；資格已變時停用操作並提供重新載入／回列表。處理中停用、失敗後解除。
export function TeacherStatusPanel({
  teacherProfileId,
  name,
  status,
  returnTo,
  detailHref,
}: {
  teacherProfileId: string;
  name: string;
  status: "approved" | "suspended";
  returnTo: string;
  detailHref: string;
}) {
  const [suspendState, suspendFormAction, suspendPending] = useActionState(suspendTeacherProfileAction, idleAdminActionState);
  const [restoreState, restoreFormAction, restorePending] = useActionState(restoreTeacherProfileAction, idleAdminActionState);
  const staleState = findStaleState([suspendState, restoreState]);
  const stale = staleState?.stale;
  const busy = suspendPending || restorePending || Boolean(stale);

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
          backToListLabel="回老師列表"
          detailHref={detailHref}
          keptInputNote="這頁的狀態操作已停用；如果已填暫停原因，內容仍保留在下方，需要的話可以先複製。"
          kind={staleState.stale}
          message={staleState.message}
          returnTo={returnTo}
        />
      ) : null}

      {status === "approved" ? (
        // 不用 <form action>：React 在 action 結束後會清空表單，失敗時已填的原因會被洗掉。
        <form
          action={suspendFormAction}
          className="grid gap-3 rounded-xl border border-rose-200 bg-white p-4"
          onSubmit={submitWith(suspendFormAction)}
        >
          <input name="teacherProfileId" type="hidden" value={teacherProfileId} />
          <input name="confirmSuspend" type="hidden" value="yes" />
          <input name="returnTo" type="hidden" value={returnTo} />
          <ReasonTemplateField
            hint="老師會看到這段暫停原因，請具體、溫和地寫出暫停的原因（10–1000 字）。"
            id="suspend-reason"
            label="暫停原因"
            maxLength={1000}
            minLength={10}
            name="suspensionReason"
            placeholder="例如：近期收到多筆課程品質相關反映，需要先暫停接受新需求。"
            templates={[]}
          />
          <AdminActionError hidden={Boolean(stale)} nextStep="已填的原因仍保留，修正後可以再暫停一次。" state={suspendState} />
          <div>
            <AdminConfirmButton
              confirmLabel="確認暫停"
              // 影響依既有 domain 規則：公開課程只列 approved 老師的課、報名會檢查老師是 approved；暫停不會取消既有課程與報名。
              description={`暫停後，${name} 無法再被團主選定；這位老師的課程會從公開課程列表移除，也不能接受新報名。已建立的課程與既有報名不會自動取消。暫停原因會顯示給老師，之後可以在這裡恢復。`}
              pending={busy}
              pendingLabel={suspendPending ? "暫停處理中…" : undefined}
              title={`確定要暫停 ${name} 嗎？`}
              triggerLabel="暫停這位老師"
            />
          </div>
        </form>
      ) : (
        <form action={restoreFormAction} onSubmit={submitWith(restoreFormAction)}>
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="teacherProfileId" type="hidden" value={teacherProfileId} />
          <input name="confirmRestore" type="hidden" value="yes" />
          <button
            className="w-full rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={busy}
            type="submit"
          >
            {restorePending ? "恢復處理中…" : "恢復這位老師"}
          </button>
          <AdminActionError hidden={Boolean(stale)} nextStep="這位老師仍是暫停中，可以稍後再按一次恢復。" state={restoreState} />
        </form>
      )}
    </div>
  );
}
