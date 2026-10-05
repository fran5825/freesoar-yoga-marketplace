import { notFound, redirect } from "next/navigation";

import {
  proposalStatusLabels,
  proposalStatusToneClasses,
} from "@/app/organizer/class-proposals/_components/page-helpers";
import { ProposalSummary } from "@/app/organizer/class-proposals/_components/ProposalSummary";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getProposalForTeacher } from "@/domain/organizer-class-proposal/service";
import { getCurrentUser } from "@/lib/auth/session";

import { confirmProposalAction, declineProposalAction } from "./actions";
import { TeacherProposalActions } from "./TeacherProposalActions";

type TeacherProposalPageProps = {
  params: Promise<{ proposalId: string }>;
};

// organizer-usability-redesign 票 05／06：受邀老師查看自己收到的合作邀請最新內容，並確認或附原因婉拒。
// 不是自己的邀請、或團主還沒送出的草稿，一律 404。確認授課不會給老師團主課程的開放、取消或名單管理權；
// 未確認的邀請不會出現在「我的課程」。
export default async function TeacherProposalPage({ params }: TeacherProposalPageProps) {
  const [currentUser, { proposalId }] = await Promise.all([getCurrentUser(), params]);

  if (!currentUser) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/teacher/class-proposals/${proposalId}`)}`);
  }

  const proposal = await getProposalForTeacher(proposalId);
  if (!proposal) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${proposalStatusToneClasses[proposal.status]}`}
        >
          {proposalStatusLabels[proposal.status]}
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          {proposal.title ?? "合作邀請"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {proposal.organization.name} 邀請你授課。這份安排在你確認之前不會成為正式課程，也不會開放報名。
        </p>
      </header>

      {proposal.status === "pending_confirmation" ? (
        <TeacherProposalActions
          onConfirm={confirmProposalAction}
          onDecline={declineProposalAction}
          organizationName={proposal.organization.name}
          proposalId={proposal.id}
          version={proposal.version}
        />
      ) : (
        <section
          aria-live="polite"
          className="rounded-2xl border border-ink/15 bg-white p-5 text-sm leading-6 text-ink [overflow-wrap:anywhere]"
        >
          {proposal.status === "confirmed" ? (
            <p>
              你已確認授課
              {proposal.confirmedAt ? `（${formatTaipeiDatetime(proposal.confirmedAt)}）` : ""}
              ，這個時段已保留給這堂課。下一步由團主開放報名。
            </p>
          ) : proposal.status === "declined" ? (
            <p>
              你已婉拒這份邀請。你提供的原因：{proposal.declineReason ?? "（未填寫）"}
              。如果團主調整後再邀請你，會看到新的內容。
            </p>
          ) : proposal.status === "withdrawn" ? (
            <p>團主已撤回這份邀請，不需要再處理。</p>
          ) : (
            <p>這堂課已經開放報名。</p>
          )}
        </section>
      )}

      <ProposalSummary proposal={proposal} />
    </div>
  );
}
