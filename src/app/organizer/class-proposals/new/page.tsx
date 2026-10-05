import { redirect } from "next/navigation";

import { pickInitialOrganizationId } from "@/app/organizer/demands/_components/organization-options";
import { listOwnOrganizations } from "@/domain/organization/service";
import { getOwnTeacherProfileId } from "@/domain/organizer-class-proposal/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import {
  saveAndSelfConfirmProposalAction,
  saveAndSubmitProposalAction,
  saveProposalDraftAction,
  searchTeacherCardsAction,
} from "../actions";
import { ProposalForm } from "../_components/ProposalForm";
import { toProposalOrganizationOptions, withOrganizationParam } from "../_components/page-helpers";

type NewProposalPageProps = {
  searchParams?: Promise<{ organizationId?: string }>;
};

// organizer-usability-redesign 票 05：「我已有合作老師」的新課程安排。
// 票 10：入口頁、總覽與「我的課程」的「已有合作老師」捷徑由 DIRECT_CLASS_ENTRY_PUBLIC 控制，
// 目前尚未公開（等票 09 老師端 origin guards）；intent=direct_class 與直接開網址仍可用。
export default async function NewProposalPage({ searchParams }: NewProposalPageProps) {
  const [currentUser, resolvedSearchParams] = await Promise.all([getCurrentUser(), searchParams]);

  if (!currentUser) {
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(withOrganizationParam("/organizer/class-proposals/new", resolvedSearchParams?.organizationId))}`,
    );
  }

  const organizerContext = await getOwnOrganizerContext();
  if (!organizerContext) {
    // 票 10：第一次使用先建立團主資料，建立後回到這個表單（保留直接開團的意圖）。
    redirect(`/organizer/profile?next=${encodeURIComponent("/organizer/class-proposals/new")}`);
  }

  const [organizations, selfTeacherProfileId] = await Promise.all([listOwnOrganizations(), getOwnTeacherProfileId()]);
  const initialOrganizationId = pickInitialOrganizationId(
    organizations,
    resolvedSearchParams?.organizationId,
    null,
  );
  if (!initialOrganizationId) {
    redirect(`/organizer/organizations/new?returnTo=${encodeURIComponent("/organizer/class-proposals/new")}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">安排合作老師的課程</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          填好課程內容後送出邀請，老師確認後你就能開放報名。可以先儲存草稿，之後再回來完成。
        </p>
      </header>

      <ProposalForm
        initialProposalId={null}
        initialTeacher={null}
        initialValues={{
          organizationId: initialOrganizationId,
          teacherProfileId: null,
          title: "",
          description: "",
          serviceTypes: [],
          startAt: "",
          endAt: "",
          location: "",
          capacity: "",
          isPublic: false,
        }}
        initialVersion={null}
        onSaveDraft={saveProposalDraftAction}
        onSearchTeachers={searchTeacherCardsAction}
        onSelfConfirm={saveAndSelfConfirmProposalAction}
        onSubmit={saveAndSubmitProposalAction}
        organizationLocked={false}
        selfTeacherProfileId={selfTeacherProfileId}
        organizations={toProposalOrganizationOptions(organizations)}
      />
    </div>
  );
}
