// admin-usability 票 04：審核、取消等操作完成後顯示在頁面上方的結果提示。
// Server Action 導回時用 ?result=success|error&message=... 帶過來（沿用既有做法）。
export type AdminFlashParams = { result?: string; message?: string };

export function AdminFlash({ result, message }: AdminFlashParams) {
  if (!result || !message) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      className={
        result === "success"
          ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
          : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
      }
    >
      {message}
    </section>
  );
}
