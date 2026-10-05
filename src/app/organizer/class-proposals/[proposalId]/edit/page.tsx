import { notFound, redirect } from "next/navigation";

import { pickInitialOrganizationId } from "@/app/organizer/demands/_components/organization-options";
import { listOwnOrganizations } from "@/domain/organization/service";
import {
  getOwnProposalForOrganizer,
  getOwnTeacherProfileId,
  getProposalSubmitIssuesForDetail,
  toProposalFormInput,
} from "@/domain/organizer-class-proposal/service";
import { getCurrentUser } from "@/lib/auth/session";

import {
  saveAndSelfConfirmProposalAction,
  saveAndSubmitProposalAction,
  saveProposalDraftAction,
  searchTeacherCardsAction,
} from "../../actions";
import { ProposalForm } from "../../_components/ProposalForm";
import {
  toProposalFlash,
  toProposalOrganizationOptions,
  withOrganizationParam,
} from "../../_components/page-helpers";

type EditProposalPageProps = {
  params: Promise<{ proposalId: string }>;
  searchParams?: Promise<{ organizationId?: string; flash?: string }>;
};

// organizer-usability-redesign 票 05／07：編輯自己的合作邀請。不是自己的一律 404；
// 草稿、等待確認、已婉拒、已確認都可以修改（效果依狀態不同，見 revise-core）；已撤回或已開放報名導回詳情。
export default async function EditProposalPage({ params, searchParams }: EditProposalPageProps) {
  const [currentUser, { proposalId }, resolvedSearchParams] = await Promise.all([
    getCurrentUser(),
    params,
    searchParams,
  ]);

  if (!currentUser) {
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(
        withOrganizationParam(`/organizer/class-proposals/${proposalId}/edit`, resolvedSearchParams?.organizationId),
      )}`,
    );
  }

  const proposal = await getOwnProposalForOrganizer(proposalId);
  if (!proposal) {
    notFound();
  }
  if (proposal.status === "withdrawn" || proposal.status === "converted") {
    redirect(`/organizer/class-proposals/${proposalId}`);
  }

  const [organizations, selfTeacherProfileId] = await Promise.all([listOwnOrganizations(), getOwnTeacherProfileId()]);
  const organizationLocked = proposal.submittedAt !== null;
  const initialOrganizationId = organizationLocked
    ? proposal.organization.id
    : pickInitialOrganizationId(organizations, resolvedSearchParams?.organizationId, proposal.organization.id);
  if (!initialOrganizationId) {
    redirect("/organizer/organizations");
  }

  // 已送出過、團體已鎖定時，即使團體的擁有權有異動也只列出這個團體，不能換。
  const options = toProposalOrganizationOptions(organizations);
  const organizationOptions = organizationLocked
    ? options.filter((option) => option.id === proposal.organization.id)
    : options;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          繼續安排：{proposal.title ?? "尚未命名的課程"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          準備好後送出邀請，老師確認後你就能開放報名。
        </p>
      </header>

      <ProposalForm
        declineReason={proposal.declineReason}
        initialFeedback={withSubmitIssues(toProposalFlash(resolvedSearchParams?.flash), proposal)}
        initialStatus={proposal.status}
        initialProposalId={proposal.id}
        initialTeacher={proposal.teacher}
        initialValues={{ ...toProposalFormInput(proposal), organizationId: initialOrganizationId }}
        initialVersion={proposal.version}
        onSaveDraft={saveProposalDraftAction}
        onSearchTeachers={searchTeacherCardsAction}
        onSelfConfirm={saveAndSelfConfirmProposalAction}
        onSubmit={saveAndSubmitProposalAction}
        organizationLocked={organizationLocked}
        selfTeacherProfileId={selfTeacherProfileId}
        organizations={organizationOptions}
        savedOrganizationId={proposal.organization.id}
      />
    </div>
  );
}

// 送出失敗後換到這一頁時，依資料庫裡的草稿重新算出欄位錯誤，讓錯誤訊息仍可點擊定位。
function withSubmitIssues(
  flash: ReturnType<typeof toProposalFlash>,
  proposal: Parameters<typeof getProposalSubmitIssuesForDetail>[0],
) {
  if (!flash || flash.kind !== "error") {
    return flash;
  }
  const issues = getProposalSubmitIssuesForDetail(proposal);
  return issues.errors.length > 0 ? { ...flash, validationErrors: issues.errors } : flash;
}
