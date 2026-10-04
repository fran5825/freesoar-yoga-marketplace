import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import type { ProposalDetail } from "@/domain/organizer-class-proposal/service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";

// organizer-usability-redesign 票 05：合作邀請的完整安排，團主與受邀老師共用。
// 團體聯絡窗口也列出來：受邀老師需要知道怎麼聯絡團體（不含團主個人帳號資料）。
export function ProposalSummary({ proposal }: { proposal: ProposalDetail }) {
  const rows: { label: string; value: string }[] = [
    {
      label: "團體",
      value: `${proposal.organization.name}（${organizationTypeLabels[proposal.organization.type]}）`,
    },
    { label: "授課老師", value: proposal.teacher?.displayName ?? "尚未選擇" },
    { label: "課程名稱", value: proposal.title ?? "尚未填寫" },
    { label: "課程風格", value: proposal.serviceTypes.join("、") || "尚未選擇" },
    {
      label: "時間（台灣時間）",
      value:
        proposal.startAt && proposal.endAt
          ? `${formatTaipeiDatetime(proposal.startAt)} – ${formatTaipeiDatetime(proposal.endAt)}`
          : "尚未填寫",
    },
    { label: "地點", value: proposal.location ?? "尚未填寫" },
    { label: "名額", value: proposal.capacity === null ? "尚未填寫" : `${proposal.capacity} 人` },
    {
      label: "招募方式",
      value: proposal.isPublic ? "公開在課程列表，也可以分享連結" : "僅透過分享連結招募",
    },
    {
      label: "團體聯絡窗口",
      value:
        [proposal.organization.contactName, proposal.organization.contactEmail, proposal.organization.contactPhone]
          .filter(Boolean)
          .join("・") || "尚未填寫",
    },
  ];

  return (
    <section className="rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">課程安排</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        {rows.map((row) => (
          <div className="grid gap-1 sm:grid-cols-[9rem_1fr]" key={row.label}>
            <dt className="text-ink-soft">{row.label}</dt>
            <dd className="text-ink [overflow-wrap:anywhere]">{row.value}</dd>
          </div>
        ))}
      </dl>
      {proposal.description ? (
        <div className="mt-4 border-t border-ink/10 pt-4 text-sm">
          <h3 className="font-medium text-ink">課程說明</h3>
          <p className="mt-2 whitespace-pre-wrap leading-6 text-ink-soft [overflow-wrap:anywhere]">
            {proposal.description}
          </p>
        </div>
      ) : null}
    </section>
  );
}
