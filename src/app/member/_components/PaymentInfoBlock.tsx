import { TRANSFER_NOTE_MAX_LENGTH } from "@/domain/enrollment/payment-limits";

// lightweight-payment-v0（付款計畫 P4、P5、P6、P8）：學員「我的報名」裡的付款方式區塊。
// 顯示的帳號、規則、聯絡方式與價格一律是報名當下的快照，不是老師現在的資料。
// 語氣溫和清楚，不用「立即付款」「逾期作廢」這類緊迫用語（voice-and-tone）。

export const paymentStatusLabels = {
  unpaid: "待付款",
  paid: "已收款",
  refunded: "已退款",
  partial: "部分已收款",
} as const;

export type PaymentBlockStatus = keyof typeof paymentStatusLabels;

type PaymentInfoBlockProps = {
  status: PaymentBlockStatus;
  priceNote: string | null;
  accountInfo: string | null;
  rulesText: string | null;
  contactInfo: string | null;
  transferNote: string | null;
  refundReason: string | null;
  // 報名仍有效且尚未付款時，學員才能填寫或修改轉帳備註。
  canEditTransferNote: boolean;
  // 單堂：kind = enrollment（enrollmentId）；整期：kind = term（seriesEnrollmentId）。
  target: { kind: "enrollment" | "term"; id: string };
  action: (formData: FormData) => void | Promise<void>;
  idSuffix: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium text-ink-faint">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}

export function PaymentInfoBlock({
  status,
  priceNote,
  accountInfo,
  rulesText,
  contactInfo,
  transferNote,
  refundReason,
  canEditTransferNote,
  target,
  action,
  idSuffix,
}: PaymentInfoBlockProps) {
  const badgeClass =
    status === "paid"
      ? "bg-emerald-50 text-emerald-900"
      : status === "refunded"
        ? "bg-ink/10 text-ink-soft"
        : "bg-amber-50 text-amber-900";

  return (
    <section
      aria-labelledby={`payment-heading-${idSuffix}`}
      className="relative z-10 grid gap-3 rounded-xl border border-ink/15 bg-cream/60 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-medium text-ink" id={`payment-heading-${idSuffix}`}>
          付款方式
        </h4>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
          付款：{paymentStatusLabels[status]}
        </span>
      </div>

      <dl className="grid gap-3">
        <Row label="金額" value={priceNote ?? "請與老師確認實際金額"} />
        <Row label="收款帳號" value={accountInfo ?? "請直接與老師確認付款方式"} />
        {contactInfo ? <Row label="老師的聯絡方式" value={contactInfo} /> : null}
        {rulesText ? <Row label="繳費與取消規則" value={rulesText} /> : null}
        {status === "refunded" && refundReason ? <Row label="退款說明" value={refundReason} /> : null}
      </dl>

      {canEditTransferNote ? (
        <form action={action} className="grid gap-2">
          <input name="kind" type="hidden" value={target.kind} />
          <input name="targetId" type="hidden" value={target.id} />
          <label className="text-sm font-medium text-ink" htmlFor={`transfer-note-${idSuffix}`}>
            轉帳後五碼或備註（選填）
          </label>
          <input
            className="w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
            defaultValue={transferNote ?? ""}
            id={`transfer-note-${idSuffix}`}
            maxLength={TRANSFER_NOTE_MAX_LENGTH}
            name="transferNote"
            placeholder="例如：帳號後五碼 12345"
            type="text"
          />
          <p className="text-xs leading-5 text-ink-faint">
            填寫只是方便老師對帳，不會改變付款狀態；老師確認收到款項後會標記為已收款。
          </p>
          <div>
            <button
              className="inline-flex min-h-11 items-center rounded-full border border-pine px-5 py-2 text-sm font-medium text-pine transition hover:bg-pine-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              type="submit"
            >
              儲存備註
            </button>
          </div>
        </form>
      ) : transferNote ? (
        <dl>
          <Row label="你填寫的轉帳備註" value={transferNote} />
        </dl>
      ) : null}

      <p className="text-xs leading-5 text-ink-faint">
        付款由你與老師直接完成，飛索目前不經手款項。
      </p>
    </section>
  );
}
