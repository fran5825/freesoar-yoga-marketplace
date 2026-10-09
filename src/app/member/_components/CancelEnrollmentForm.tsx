// 學員取消報名的確認表單（課程詳情頁與「我的報名」共用）。只在報名為處理中／已報名、
// 且課程尚未開始時顯示；真正的規則與本人檢查仍在 cancelOwnEnrollment（service layer）。
// 取消後同一堂課無法再次報名（Enrollment 對 classSession＋user 唯一），所以確認文字要講清楚。
export function CancelEnrollmentForm({
  action,
  enrollmentId,
  classSessionId,
  variant = "cancel",
}: {
  action: (formData: FormData) => Promise<void>;
  enrollmentId: string;
  classSessionId?: string;
  // teacher-class-scheduling 票 09：整期學員取消其中一堂就是「請假」，其他堂照常。
  variant?: "cancel" | "leave";
}) {
  const isLeave = variant === "leave";

  return (
    <details className="relative z-10 rounded-xl border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
        {isLeave ? "請假這一堂…" : "取消報名…"}
      </summary>
      <form action={action} className="grid gap-3 border-t border-amber-100 p-4">
        <input name="enrollmentId" type="hidden" value={enrollmentId} />
        {classSessionId ? (
          <input name="classSessionId" type="hidden" value={classSessionId} />
        ) : null}
        {isLeave ? <input name="leave" type="hidden" value="yes" /> : null}
        <p className="text-sm font-medium leading-6 text-amber-900">
          {isLeave
            ? "請假後這一堂的名額會釋出，之後無法再報這一堂；整期的其他堂照常。"
            : "取消後無法再次報名此課程。"}
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
