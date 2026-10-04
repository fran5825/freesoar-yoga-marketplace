import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getOwnProposalForOrganizer } from "@/domain/organizer-class-proposal/service";
import { getCurrentUser } from "@/lib/auth/session";

import { ProposalSummary } from "../_components/ProposalSummary";
import { proposalStatusLabels, proposalStatusToneClasses } from "../_components/page-helpers";

type ProposalDetailPageProps = {
  params: Promise<{ proposalId: string }>;
  searchParams?: Promise<{ flash?: string }>;
};

// organizer-usability-redesign 票 05：團主的單筆合作邀請。顯示目前狀態、下一位處理者與完整安排；
// 不是自己的一律 404。送出後等老師確認，不暗示時段已保留，也還不能開放報名。
export default async function ProposalDetailPage({ params, searchParams }: ProposalDetailPageProps) {
  const [currentUser, { proposalId }, resolvedSearchParams] = await Promise.all([
    getCurrentUser(),
    params,
    searchParams,
  ]);

  if (!currentUser) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/organizer/class-proposals/${proposalId}`)}`);
  }

  const proposal = await getOwnProposalForOrganizer(proposalId);
  if (!proposal) {
    notFound();
  }

  const justSubmitted = resolvedSearchParams?.flash === "submitted" && proposal.status === "pending_confirmation";
  const nextStep =
    proposal.status === "draft"
      ? { actor: "你", text: "繼續完成課程安排，準備好後送出邀請給老師確認。" }
      : proposal.status === "pending_confirmation"
        ? {
            actor: "老師",
            text: `等待 ${proposal.teacher?.displayName ?? "老師"} 確認這份安排。老師確認前還不會保留老師的時間，也還不能開放報名。`,
          }
        : { actor: "—", text: "這份邀請的後續操作會在之後的版本開放。" };

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${proposalStatusToneClasses[proposal.status]}`}
        >
          {proposalStatusLabels[proposal.status]}
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          {proposal.title ?? "尚未命名的課程"}
        </h1>
      </header>

      {justSubmitted ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
        >
          邀請已送出，老師確認後你就能開放報名。
        </p>
      ) : null}

      <section aria-label="下一步" className="rounded-2xl border border-pine/20 bg-pine-tint p-5">
        <p className="text-xs font-medium text-pine">下一步：{nextStep.actor}</p>
        <p className="mt-1 text-sm leading-6 text-ink">{nextStep.text}</p>
        {proposal.status === "draft" ? (
          <Link
            className="mt-3 inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
            href={`/organizer/class-proposals/${proposal.id}/edit`}
          >
            繼續編輯
          </Link>
        ) : null}
      </section>

      <ProposalSummary proposal={proposal} />
    </div>
  );
}
