import { notFound, redirect } from "next/navigation";

import {
  proposalStatusLabels,
  proposalStatusToneClasses,
} from "@/app/organizer/class-proposals/_components/page-helpers";
import { ProposalSummary } from "@/app/organizer/class-proposals/_components/ProposalSummary";
import { getProposalForTeacher } from "@/domain/organizer-class-proposal/service";
import { getCurrentUser } from "@/lib/auth/session";

type TeacherProposalPageProps = {
  params: Promise<{ proposalId: string }>;
};

// organizer-usability-redesign 票 05：受邀老師查看自己收到的合作邀請最新內容（唯讀）。
// 不是自己的邀請、或團主還沒送出的草稿，一律 404。確認與婉拒在票 06 開放；
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

      <ProposalSummary proposal={proposal} />
    </div>
  );
}
