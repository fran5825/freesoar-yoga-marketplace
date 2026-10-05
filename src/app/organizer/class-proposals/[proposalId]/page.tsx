import { notFound, redirect } from "next/navigation";

import { getOwnProposalForOrganizer } from "@/domain/organizer-class-proposal/service";
import { getCurrentUser } from "@/lib/auth/session";

import { openDirectClassAction, resubmitProposalAction, withdrawProposalAction } from "../actions";
import { ProposalManageActions } from "../_components/ProposalManageActions";
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
  // 票 08：確認者就是團主本人（同一個帳號）時，是本人授課。
  const isSelfTaught = proposal.confirmedByUserId === currentUser.id;
  const nextStep =
    proposal.status === "draft"
      ? { actor: "你", text: "繼續完成課程安排，準備好後送出邀請給老師確認。" }
      : proposal.status === "pending_confirmation"
        ? {
            actor: "老師",
            text: `等待 ${proposal.teacher?.displayName ?? "老師"} 確認這份安排。老師確認前還不會保留老師的時間，也還不能開放報名。需要調整可以修改內容，老師會看到最新版本。`,
          }
        : proposal.status === "confirmed"
          ? {
              actor: "你",
              text: isSelfTaught
                ? "你已確認由自己授課，這個時段已保留給這堂課。現在可以開放報名。"
                : `${proposal.teacher?.displayName ?? "老師"} 已確認授課，這個時段已保留給這堂課。現在可以開放報名。`,
            }
          : proposal.status === "declined"
            ? {
                actor: "你",
                text: `${proposal.teacher?.displayName ?? "老師"} 婉拒了這份邀請。原因：${proposal.declineReason ?? "（未填寫）"}。你可以調整內容後重新邀請（也可以換老師），或撤回這份邀請。`,
              }
            : proposal.status === "withdrawn"
              ? {
                  actor: "—",
                  text: `你已撤回這份邀請${proposal.withdrawReason ? `（原因：${proposal.withdrawReason}）` : ""}，不需要再處理。需要時可以另外建立新的安排。`,
                }
              : { actor: "—", text: "這份邀請已結束，不需要再處理。" };

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

      {resolvedSearchParams?.flash === "self_confirmed" && proposal.status === "confirmed" && isSelfTaught ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
        >
          已確認由你自己授課，這個時段已保留給這堂課。
        </p>
      ) : null}

      <section aria-label="下一步" className="rounded-2xl border border-pine/20 bg-pine-tint p-5">
        <p className="text-xs font-medium text-pine">下一步：{nextStep.actor}</p>
        <p className="mt-1 text-sm leading-6 text-ink [overflow-wrap:anywhere]">{nextStep.text}</p>
        {proposal.status === "draft" ||
        proposal.status === "pending_confirmation" ||
        proposal.status === "declined" ||
        proposal.status === "confirmed" ? (
          <ProposalManageActions
            onOpen={openDirectClassAction}
            onResubmit={resubmitProposalAction}
            onWithdraw={withdrawProposalAction}
            proposalId={proposal.id}
            status={proposal.status}
            version={proposal.version}
          />
        ) : null}
      </section>

      <ProposalSummary proposal={proposal} />
    </div>
  );
}
