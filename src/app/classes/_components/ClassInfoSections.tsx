// teacher-class-scheduling 票 14（Q6，2026-10-09 產品主人決定）：課程說明、適合對象、準備事項
// 有填才顯示；沒填整張不顯示，取代學員流程票 03 原本的「尚未提供」。單堂頁與期班頁共用。
const sectionClass = "min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6";

export function ClassInfoSections({
  description,
  suitableFor,
  preparationNotes,
  priceNote = null,
  paymentRulesText = null,
  idPrefix = "",
}: {
  description: string | null;
  suitableFor: string | null;
  preparationNotes: string | null;
  // lightweight-payment-v0：價格說明與老師的繳費規則，同樣「有填才顯示」，報名前就看得到。
  priceNote?: string | null;
  paymentRulesText?: string | null;
  idPrefix?: string;
}) {
  const items = [
    { key: "price", title: "價格", value: priceNote },
    { key: "description", title: "課程說明", value: description },
    { key: "suitable-for", title: "適合對象", value: suitableFor },
    { key: "preparation", title: "準備事項", value: preparationNotes },
    { key: "payment-rules", title: "繳費與取消規則", value: paymentRulesText },
  ].filter((item) => item.value && item.value.trim().length > 0);

  return (
    <>
      {items.map((item) => (
        <section aria-labelledby={`${idPrefix}${item.key}-heading`} className={sectionClass} key={item.key}>
          <h2 className="text-lg font-medium text-ink" id={`${idPrefix}${item.key}-heading`}>
            {item.title}
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{item.value}</p>
        </section>
      ))}
    </>
  );
}
