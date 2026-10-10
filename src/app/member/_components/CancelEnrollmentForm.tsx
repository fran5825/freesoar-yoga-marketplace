// 學員取消報名的確認表單（課程詳情頁與「我的報名」共用）。只在報名為處理中／已報名、
// 且課程尚未開始時顯示；真正的規則與本人檢查仍在 cancelOwnEnrollment（service layer）。
// 單堂取消後，開課前可以重新報名（ADR 0006）；名額被報滿就不能，所以確認文字要講清楚。
export function CancelEnrollmentForm({
  action,
  enrollmentId,
  classSessionId,
  variant = "cancel",
  termMode = null,
  returnTo,
  summaryLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  enrollmentId: string;
  classSessionId?: string;
  // teacher-class-scheduling 票 09：整期學員取消其中一堂就是「請假」，其他堂照常。
  variant?: "cancel" | "leave";
  // enrollment-re-enrollment 票 03：請假的說明依期班報名方式不同（只收整期保留名額，整期和單堂都收則釋出給單堂）。
  termMode?: "term_only" | "term_and_single" | null;
  // inline-member-actions 票 01：就地操作做完要回到哪一頁（共用的 term-row action 讀這個欄位）。
  returnTo?: string;
  // 列上的按鈕用短標籤（例如「請假」），預設沿用原本的文字。
  summaryLabel?: string;
}) {
  const isLeave = variant === "leave";

  return (
    <details className="relative z-10 rounded-xl border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
        {summaryLabel ?? (isLeave ? "請假這一堂…" : "取消報名…")}
      </summary>
      <form action={action} className="grid gap-3 border-t border-amber-100 p-4">
        <input name="enrollmentId" type="hidden" value={enrollmentId} />
        {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
        {classSessionId ? (
          <input name="classSessionId" type="hidden" value={classSessionId} />
        ) : null}
        {isLeave ? <input name="leave" type="hidden" value="yes" /> : null}
        <p className="text-sm font-medium leading-6 text-amber-900">
          {isLeave
            ? termMode === "term_only"
              ? "請假後，這一堂會標示為請假；整期的其他堂照常。開課前可以取消請假。"
              : "請假後，這一堂的名額會開放給單堂報名；整期的其他堂照常。開課前、名額還在時可以取消請假。"
            : "取消後，開課前可以重新報名；名額被報滿則不能。"}
        </p>
        <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
          <input
            className="mt-1 shrink-0"
            name="confirmCancel"
            required
            type="checkbox"
            value="yes"
          />
          {isLeave ? "我確認這一堂要請假。" : "我確認要取消這則報名。"}
        </label>
        <button
          className="w-full rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 sm:w-auto"
          type="submit"
        >
          {isLeave ? "確認請假" : "確認取消"}
        </button>
      </form>
    </details>
  );
}
