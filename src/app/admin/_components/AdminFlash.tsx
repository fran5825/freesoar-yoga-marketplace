// admin-usability 票 04：審核、取消等操作完成後顯示在頁面上方的結果提示。
// Server Action 導回時用 ?result=success|error&message=... 帶過來（沿用既有做法）。
import Link from "next/link";

export type AdminFlashParams = { result?: string; message?: string; item?: string };

export function AdminFlash({ result, message, detailHref, detailLabel }: AdminFlashParams & { detailHref?: string; detailLabel?: string }) {
  if (!result || !message) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      className={
        result === "success"
          ? "min-w-0 wrap-anywhere rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
          : "min-w-0 wrap-anywhere rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
      }
    >
      {message}
      {detailHref ? <Link className="ml-2 wrap-anywhere font-medium underline underline-offset-4" href={detailHref}>{detailLabel ?? "查看剛處理的資料"}</Link> : null}
    </section>
  );
}
