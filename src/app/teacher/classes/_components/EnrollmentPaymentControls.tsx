import type { ReactNode } from "react";

import { PAYMENT_NOTE_MAX_LENGTH } from "@/domain/enrollment/payment-limits";

import { markEnrollmentPaidAction, markEnrollmentRefundedAction } from "../actions";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

// lightweight-payment-v0（付款計畫 P2、P3）：老師名單上每筆報名的付款狀態與標記按鈕。
// 報名狀態與付款狀態是兩個獨立的標籤，不合併成一個字串；金錢不經過飛索，這裡只記錄。
// teacher-series-rollup 票 01（spec 2.4）：一位學員一排——姓名、付款標籤、轉帳備註在同一排，按鈕在最右邊；
// 手機寬度不夠時按鈕換到下一排。收款備註、退款說明、學員備註在下一行。

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

// 名單的一排：title（姓名與「單堂」等標籤）、inline（同一排的付款標籤與轉帳備註）、action（最右邊的按鈕），
// children 是下一行的補充說明。待確認名單、已報名名單、已取消但有付款紀錄、整期名單共用。
export function RosterRow({
  title,
  inline,
  action,
  children,
  tone = "default",
}: {
  title: ReactNode;
  inline?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  tone?: "default" | "pending";
}) {
  return (
    <li
      className={
        tone === "pending"
          ? "min-w-0 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm"
          : "min-w-0 rounded-2xl border border-ink/10 bg-cream p-3 text-sm"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 break-words font-medium text-ink">{title}</span>
          {inline}
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </li>
  );
}

// 「單堂」標籤：只在「整期和單堂都收」的期班、而且這筆是單堂報名時顯示（spec 2.4）。
export function SingleEnrollmentTag() {
  return <span className="rounded-full bg-pine-tint px-2 py-0.5 text-xs font-normal text-pine-deep">單堂</span>;
}

export function PaymentInline({
  paymentStatus,
  transferNote,
  cancelled = false,
}: {
  paymentStatus: PaymentStatus;
  transferNote: string | null;
  cancelled?: boolean;
}) {
  return (
    <>
      <PaymentStatusBadge status={paymentStatus} />
      {cancelled ? <span className="text-xs text-ink-faint">報名已取消</span> : null}
      {transferNote ? (
        <span className="min-w-0 break-words text-ink-soft">
          <span className="text-ink-faint">轉帳備註：</span>
          {transferNote}
        </span>
      ) : null}
    </>
  );
}

export function PaymentDetailLines({
  paymentStatus,
  paymentNote,
  refundReason,
  studentNotes,
}: {
  paymentStatus: PaymentStatus;
  paymentNote: string | null;
  refundReason: string | null;
  studentNotes?: string | null;
}) {
  if (!studentNotes && !paymentNote && !(paymentStatus === "refunded" && refundReason)) {
    return null;
  }

  return (
    <div className="mt-2 grid gap-1">
      {studentNotes ? <p className="min-w-0 whitespace-pre-wrap break-words text-ink-soft">{studentNotes}</p> : null}
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
    </div>
  );
}

export function PaymentActionButton({
  enrollmentId,
  classSessionId,
  memberName,
  enrollmentStatus,
  paymentStatus,
  hiddenReturnFields = {},
}: {
  enrollmentId: string;
  classSessionId: string;
  memberName: string;
  enrollmentStatus: string;
  paymentStatus: PaymentStatus;
  hiddenReturnFields?: Record<string, string>;
}) {
  const hiddenFields = { enrollmentId, classSessionId, ...hiddenReturnFields };

  if (paymentStatus === "unpaid" && enrollmentStatus !== "cancelled") {
    return (
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
    );
  }

  if (paymentStatus === "paid") {
    return (
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
    );
  }

  return null;
}
