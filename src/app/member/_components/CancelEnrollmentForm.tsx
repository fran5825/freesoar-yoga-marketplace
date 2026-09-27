// 學員取消報名的確認表單（課程詳情頁與「我的報名」共用）。只在報名為處理中／已報名、
// 且課程尚未開始時顯示；真正的規則與本人檢查仍在 cancelOwnEnrollment（service layer）。
// 取消後同一堂課無法再次報名（Enrollment 對 classSession＋user 唯一），所以確認文字要講清楚。
export function CancelEnrollmentForm({
  action,
  enrollmentId,
  classSessionId,
}: {
  action: (formData: FormData) => Promise<void>;
  enrollmentId: string;
  classSessionId?: string;
}) {
  return (
    <details className="relative z-10 rounded-xl border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
        取消報名…
      </summary>
      <form action={action} className="grid gap-3 border-t border-amber-100 p-4">
        <input name="enrollmentId" type="hidden" value={enrollmentId} />
        {classSessionId ? (
          <input name="classSessionId" type="hidden" value={classSessionId} />
        ) : null}
        <p className="text-sm font-medium leading-6 text-amber-900">
          取消後無法再次報名此課程。
        </p>
        <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
          <input
            className="mt-1 shrink-0"
            name="confirmCancel"
            required
            type="checkbox"
            value="yes"
          />
          我確認要取消這則報名。
        </label>
        <button
          className="w-full rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 sm:w-auto"
          type="submit"
        >
          確認取消
        </button>
      </form>
    </details>
  );
}
