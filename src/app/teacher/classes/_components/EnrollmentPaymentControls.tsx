import { PAYMENT_NOTE_MAX_LENGTH } from "@/domain/enrollment/payment-limits";

import { markEnrollmentPaidAction, markEnrollmentRefundedAction } from "../actions";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

// lightweight-payment-v0（付款計畫 P2、P3）：老師名單上每筆報名的付款狀態與標記按鈕。
// 報名狀態與付款狀態是兩個獨立的標籤，不合併成一個字串；金錢不經過飛索，這裡只記錄。

type PaymentStatus = "unpaid" | "paid" | "refunded";

const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: "待付款",
  paid: "已收款",
  refunded: "已退款",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const className =
    status === "paid"
      ? "bg-emerald-50 text-emerald-900"
      : status === "refunded"
        ? "bg-ink/10 text-ink-soft"
        : "bg-amber-50 text-amber-900";

  return (
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      付款：{paymentLabels[status]}
    </span>
  );
}

const triggerClassName =
  "min-h-11 rounded-full border border-pine/40 bg-white px-4 py-2 text-sm font-medium text-pine transition hover:bg-pine-tint";

export function EnrollmentPaymentControls({
  enrollmentId,
  classSessionId,
  memberName,
  enrollmentStatus,
  paymentStatus,
  transferNote,
  paymentNote,
  refundReason,
  hiddenReturnFields = {},
}: {
  enrollmentId: string;
  classSessionId: string;
  memberName: string;
  enrollmentStatus: string;
  paymentStatus: PaymentStatus;
  transferNote: string | null;
  paymentNote: string | null;
  refundReason: string | null;
  hiddenReturnFields?: Record<string, string>;
}) {
  const hiddenFields = { enrollmentId, classSessionId, ...hiddenReturnFields };
  const cancelled = enrollmentStatus === "cancelled";

  return (
    <div className="mt-2 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={paymentStatus} />
        {cancelled ? <span className="text-xs text-ink-faint">報名已取消</span> : null}
      </div>
      {transferNote ? (
        <p className="min-w-0 break-words text-ink-soft">
          <span className="text-ink-faint">學員的轉帳備註：</span>
          {transferNote}
        </p>
      ) : null}
      {paymentNote ? (
        <p className="min-w-0 break-words text-ink-soft">
          <span className="text-ink-faint">收款備註：</span>
          {paymentNote}
        </p>
      ) : null}
      {paymentStatus === "refunded" && refundReason ? (
        <p className="min-w-0 break-words text-ink-soft">
          <span className="text-ink-faint">退款說明：</span>
          {refundReason}
        </p>
      ) : null}

      {paymentStatus === "unpaid" && !cancelled ? (
        <div>
          <ConfirmActionDialog
            action={markEnrollmentPaidAction}
            confirmClassName="min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
            confirmLabel="標記為已收款"
            hiddenFields={hiddenFields}
            textField={{
              name: "note",
              label: "收款備註（選填）",
              placeholder: "例如：已收到，備註王小明",
              maxLength: PAYMENT_NOTE_MAX_LENGTH,
            }}
            title="標記為已收款？"
            triggerAriaLabel={`標記 ${memberName} 為已收款`}
            triggerClassName={triggerClassName}
            triggerLabel="標記已收款"
          >
            <p>
              學員：<span className="break-words font-medium text-ink">{memberName}</span>
            </p>
            <p>這只是記錄你已經收到款項，飛索不會經手任何金錢。</p>
          </ConfirmActionDialog>
        </div>
      ) : null}

      {paymentStatus === "paid" ? (
        <div>
          <ConfirmActionDialog
            action={markEnrollmentRefundedAction}
            confirmLabel="標記為已退款"
            hiddenFields={hiddenFields}
            textField={{
              name: "note",
              label: "退款說明（選填，學員看得到）",
              placeholder: "例如：課程異動，全額退費",
              maxLength: PAYMENT_NOTE_MAX_LENGTH,
            }}
            title="標記為已退款？"
            triggerAriaLabel={`標記 ${memberName} 為已退款`}
            triggerClassName="min-h-11 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-cream"
            triggerLabel="標記已退款"
          >
            <p>
              學員：<span className="break-words font-medium text-ink">{memberName}</span>
            </p>
            <p>請先在你的銀行 App 完成退款，再回來標記。飛索不會替你轉帳。</p>
          </ConfirmActionDialog>
        </div>
      ) : null}
    </div>
  );
}
