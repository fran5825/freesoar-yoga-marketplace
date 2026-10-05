import type { OrganizerClassProposalStatus, OrganizationType } from "@prisma/client";

import { formatTaipeiDatetimeLocal } from "@/domain/class-session/timezone";
import { isOrganizationContactComplete } from "@/domain/demand-request/validation";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  reviseProposalCore,
  withdrawProposalCore,
  WITHDRAW_REASON_MAX_LENGTH,
  type ReviseProposalErrorCode,
} from "./__internal__/revise-core";
import {
  confirmProposalCore,
  declineProposalCore,
  DECLINE_REASON_MAX_LENGTH,
  type RespondToProposalErrorCode,
} from "./__internal__/respond-core";
import { getProposalSubmitIssues } from "./submit-issues";
import {
  type ProposalFormInput,
  type ProposalValidationError,
  validateProposalDraft,
} from "./validation";

export { getProposalSubmitIssues };

// organizer-usability-redesign 票 05（spec 13.2–13.4）：合作邀請的草稿與送出。
// 所有讀寫都由 server 從登入者解析身分：團主看 organizerProfileId，受邀老師看 teacherProfile.userId；
// 不是自己的一律回 proposal_not_found，不揭露存在性。送出邀請不建立正式課程、不占老師時段。

export type ProposalErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "proposal_not_found"
  | "organization_not_found"
  | "organization_contact_incomplete"
  | "teacher_not_approved"
  | "proposal_incomplete"
  | "proposal_starts_in_past"
  | "proposal_version_stale"
  | "proposal_invalid_status"
  | "validation_failed"
  | "organization_locked"
  | "withdraw_reason_invalid"
  | "proposal_save_failed";

export type ProposalFailure = {
  ok: false;
  code: ProposalErrorCode;
  message: string;
  validationErrors?: ProposalValidationError[];
};

export type ProposalTeacherCard = {
  teacherProfileId: string;
  displayName: string;
  specialties: string[];
  serviceAreas: string[];
  profilePhotoUrl: string | null;
};

export type ProposalDetail = {
  id: string;
  status: OrganizerClassProposalStatus;
  version: number;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  teacher: ProposalTeacherCard | null;
  title: string | null;
  description: string | null;
  serviceTypes: string[];
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  capacity: number | null;
  isPublic: boolean;
  submittedAt: Date | null;
  declineReason: string | null;
  withdrawReason: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const teacherCardSelect = {
  id: true,
  displayName: true,
  specialties: true,
  serviceAreas: true,
  profilePhotoUrl: true,
} as const;

const proposalDetailSelect = {
  id: true,
  status: true,
  version: true,
  title: true,
  description: true,
  serviceTypes: true,
  startAt: true,
  endAt: true,
  location: true,
  capacity: true,
  isPublic: true,
  submittedAt: true,
  declineReason: true,
  withdrawReason: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      type: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
    },
  },
  teacherProfile: { select: teacherCardSelect },
} as const;

type TeacherCardRow = {
  id: string;
  displayName: string | null;
  specialties: string[];
  serviceAreas: string[];
  profilePhotoUrl: string | null;
};

function toTeacherCard(row: TeacherCardRow): ProposalTeacherCard {
  return {
    teacherProfileId: row.id,
    displayName: row.displayName ?? "（未命名老師）",
    specialties: row.specialties,
    serviceAreas: row.serviceAreas,
    profilePhotoUrl: row.profilePhotoUrl,
  };
}

function toDetail(row: {
  id: string;
  status: OrganizerClassProposalStatus;
  version: number;
  title: string | null;
  description: string | null;
  serviceTypes: string[];
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  capacity: number | null;
  isPublic: boolean;
  submittedAt: Date | null;
  declineReason: string | null;
  withdrawReason: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization: ProposalDetail["organization"];
  teacherProfile: TeacherCardRow | null;
}): ProposalDetail {
  const { teacherProfile, ...rest } = row;
  return { ...rest, teacher: teacherProfile ? toTeacherCard(teacherProfile) : null };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}

function failure(code: ProposalErrorCode, message: string, validationErrors?: ProposalValidationError[]): ProposalFailure {
  return validationErrors ? { ok: false, code, message, validationErrors } : { ok: false, code, message };
}

const NOT_FOUND = () => failure("proposal_not_found", "找不到這份合作邀請，或你沒有權限查看。");

async function getOwnOrganizerProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

// ---------- 讀取 ----------

export async function getOwnProposalForOrganizer(proposalId: string): Promise<ProposalDetail | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return null;
  }
  const organizerProfileId = await getOwnOrganizerProfileId(currentUser.id);
  if (!organizerProfileId) {
    return null;
  }
  const row = await prisma.organizerClassProposal.findFirst({
    where: { id: proposalId, organizerProfileId },
    select: proposalDetailSelect,
  });
  return row ? toDetail(row) : null;
}

// 受邀老師只看得到已送出過的邀請（草稿不給老師看）；不需要 approved 也能看自己收到的既有邀請。
export async function getProposalForTeacher(proposalId: string): Promise<ProposalDetail | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return null;
  }
  const row = await prisma.organizerClassProposal.findFirst({
    where: {
      id: proposalId,
      teacherProfile: { userId: currentUser.id },
      status: { not: "draft" },
    },
    select: proposalDetailSelect,
  });
  return row ? toDetail(row) : null;
}

// 只查 approved 老師的公開名片欄位，不使用 admin 查詢，不回傳 email、電話或審核資料。
export async function searchApprovedTeacherCards(query: string): Promise<ProposalTeacherCard[]> {
  await requireUser();
  const trimmed = query.trim().slice(0, 50);
  const rows = await prisma.teacherProfile.findMany({
    where: {
      status: "approved",
      ...(trimmed ? { displayName: { contains: trimmed, mode: "insensitive" as const } } : {}),
    },
    select: teacherCardSelect,
    orderBy: { displayName: "asc" },
    take: 20,
  });
  return rows.map(toTeacherCard);
}

export async function getApprovedTeacherCard(teacherProfileId: string): Promise<ProposalTeacherCard | null> {
  const row = await prisma.teacherProfile.findFirst({
    where: { id: teacherProfileId, status: "approved" },
    select: teacherCardSelect,
  });
  return row ? toTeacherCard(row) : null;
}

// 表單初始值：把存好的資料轉回表單欄位（時間轉成 Asia/Taipei 的 datetime-local 字串）。
export function toProposalFormInput(detail: ProposalDetail): ProposalFormInput {
  return {
    organizationId: detail.organization.id,
    teacherProfileId: detail.teacher?.teacherProfileId ?? null,
    title: detail.title ?? "",
    description: detail.description ?? "",
    serviceTypes: detail.serviceTypes,
    startAt: detail.startAt ? formatTaipeiDatetimeLocal(detail.startAt) : "",
    endAt: detail.endAt ? formatTaipeiDatetimeLocal(detail.endAt) : "",
    location: detail.location ?? "",
    capacity: detail.capacity === null ? "" : String(detail.capacity),
    isPublic: detail.isPublic,
  };
}

// ---------- 草稿存檔 ----------

export type SaveProposalResult =
  | { ok: true; proposalId: string; version: number; status: OrganizerClassProposalStatus }
  | ProposalFailure;

export async function saveOwnProposalDraft(
  input: ProposalFormInput,
  proposalId?: string,
  expectedVersion?: number,
): Promise<SaveProposalResult> {
  const validation = validateProposalDraft(input);
  if (!validation.valid) {
    return failure("validation_failed", "有些欄位需要調整後才能儲存。", validation.errors);
  }

  try {
    const currentUser = await requireUser();
    const organizerProfileId = await getOwnOrganizerProfileId(currentUser.id);
    if (!organizerProfileId) {
      return failure("organizer_profile_required", "請先建立團主資料，再安排課程。");
    }

    const organization = await prisma.organization.findFirst({
      where: { id: input.organizationId, ownerOrganizerProfileId: organizerProfileId },
      select: { id: true },
    });
    if (!organization) {
      return failure("organization_not_found", "找不到這個團體，或你沒有權限使用。");
    }

    if (input.teacherProfileId && !(await getApprovedTeacherCard(input.teacherProfileId))) {
      return failure("teacher_not_approved", "這位老師目前無法接受邀請，請選擇其他老師。");
    }

    const data = {
      ...validation.normalized,
      organizationId: organization.id,
      teacherProfileId: input.teacherProfileId,
    };

    if (!proposalId) {
      // owner 一律由 server 寫入；第一次寫入也算一次成功寫入（transitionSeq = 1）。
      const created = await prisma.organizerClassProposal.create({
        data: { ...data, organizerProfileId, transitionSeq: 1 },
        select: { id: true, version: true, status: true },
      });
      return { ok: true, proposalId: created.id, version: created.version, status: created.status };
    }

    // 修改既有邀請一定要帶上畫面上看到的 version；沒帶就不寫入，避免舊內容覆蓋新內容。
    if (expectedVersion === undefined) {
      return failure("proposal_version_stale", REVISE_MESSAGES.proposal_version_stale);
    }
    // 票 07：draft／pending／declined／confirmed 都可以修改，依狀態套用 spec 13.3 的規則（見 revise-core）。
    const revised = await reviseProposalCore(organizerProfileId, proposalId, expectedVersion, data);
    if (!revised.ok) {
      return failure(revised.code === "revise_failed" ? "proposal_save_failed" : revised.code, REVISE_MESSAGES[revised.code], revised.validationErrors);
    }
    return { ok: true, proposalId, version: revised.version, status: revised.status };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return failure("authentication_required", "請先登入後再安排課程。");
    }
    return failure("proposal_save_failed", "課程安排暫時無法儲存，請稍後再試。");
  }
}

// ---------- 送出資格 ----------

export function getProposalSubmitIssuesForDetail(detail: ProposalDetail) {
  return getProposalSubmitIssues({
    teacherProfileId: detail.teacher?.teacherProfileId ?? null,
    title: detail.title,
    description: detail.description,
    serviceTypes: detail.serviceTypes,
    startAt: detail.startAt,
    endAt: detail.endAt,
    location: detail.location,
    capacity: detail.capacity,
    isPublic: detail.isPublic,
  });
}

// ---------- 送出邀請 ----------

export type SubmitProposalResult = { ok: true; proposalId: string } | ProposalFailure;

export async function submitOwnProposal(
  proposalId: string,
  expectedVersion: number,
): Promise<SubmitProposalResult> {
  try {
    const currentUser = await requireUser();
    const organizerProfileId = await getOwnOrganizerProfileId(currentUser.id);
    if (!organizerProfileId) {
      return failure("organizer_profile_required", "請先建立團主資料，再安排課程。");
    }

    const proposal = await prisma.organizerClassProposal.findFirst({
      where: { id: proposalId, organizerProfileId },
      select: {
        status: true,
        version: true,
        submittedAt: true,
        teacherProfileId: true,
        title: true,
        description: true,
        serviceTypes: true,
        startAt: true,
        endAt: true,
        location: true,
        capacity: true,
        isPublic: true,
        organization: {
          select: {
            ownerOrganizerProfileId: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
      },
    });
    if (!proposal) {
      return NOT_FOUND();
    }
    // 草稿送出；或老師婉拒後「不修改直接重送」（spec 13.3：declined → pending_confirmation，version 不變）。
    if (proposal.status !== "draft" && proposal.status !== "declined") {
      return failure("proposal_invalid_status", "這份邀請目前的狀態不能送出，請重新整理確認。");
    }
    if (proposal.version !== expectedVersion) {
      return failure("proposal_version_stale", "這份邀請剛剛在別處被修改過，請重新整理後再送出。");
    }
    if (proposal.organization.ownerOrganizerProfileId !== organizerProfileId) {
      return failure("organization_not_found", "找不到這個團體，或你沒有權限使用。");
    }
    if (!isOrganizationContactComplete(proposal.organization)) {
      return failure("organization_contact_incomplete", "這個團體的聯絡資料還沒補齊，請先補齊聯絡資料再送出邀請。");
    }
    const issues = getProposalSubmitIssues(proposal);
    if (issues.errors.length > 0) {
      return issues.startsInPast
        ? failure("proposal_starts_in_past", "開始時間已經過了，請修改時間後再送出。", issues.errors)
        : failure("proposal_incomplete", "送出邀請前，請先補齊以下欄位。", issues.errors);
    }
    if (!(await getApprovedTeacherCard(proposal.teacherProfileId as string))) {
      return failure("teacher_not_approved", "這位老師目前無法接受邀請，請選擇其他老師。");
    }

    const updated = await prisma.organizerClassProposal.updateMany({
      where: {
        id: proposalId,
        organizerProfileId,
        status: { in: ["draft", "declined"] },
        version: expectedVersion,
      },
      data: {
        status: "pending_confirmation",
        // 第一次送出時寫入、之後永遠不清空（spec 13.3 換團體規則的依據）。
        ...(proposal.submittedAt ? {} : { submittedAt: new Date() }),
        declineReason: null,
        transitionSeq: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      return failure("proposal_version_stale", "這份邀請剛剛在別處被修改過，請重新整理後再送出。");
    }
    return { ok: true, proposalId };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return failure("authentication_required", "請先登入後再送出邀請。");
    }
    return failure("proposal_save_failed", "邀請暫時無法送出，請稍後再試。");
  }
}

// ---------- 受邀老師確認／婉拒（票 06）----------

const RESPOND_MESSAGES: Record<RespondToProposalErrorCode, string> = {
  proposal_not_found: "找不到這份合作邀請，或你沒有權限處理。",
  proposal_version_stale: "團主剛剛修改了這份邀請，請重新整理後確認最新內容。",
  proposal_invalid_status: "這份邀請目前不需要你確認（可能已經確認、婉拒或撤回），請重新整理查看最新狀態。",
  teacher_not_approved: "你的老師資格目前不是已通過審核的狀態，暫時不能確認授課。",
  proposal_starts_in_past: "這堂課的開始時間已經過了，無法確認。可以請團主修改時間後再邀請你。",
  proposal_incomplete: "這份邀請的內容還不完整，無法確認。可以請團主補齊後再邀請你。",
  schedule_conflict: "這個時段你已經有其他課程或已確認的合作，無法確認。可以請團主調整時間。",
  decline_reason_invalid: `請填寫婉拒原因（${DECLINE_REASON_MAX_LENGTH} 字以內），讓團主知道怎麼調整。`,
  respond_failed: "暫時無法處理，請稍後再試。",
};

export type RespondAsTeacherResult =
  | { ok: true }
  | { ok: false; code: RespondToProposalErrorCode | "authentication_required"; message: string };

async function resolveTeacher(): Promise<{ userId: string; teacherProfileId: string } | null> {
  const currentUser = await requireUser();
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });
  return teacherProfile ? { userId: currentUser.id, teacherProfileId: teacherProfile.id } : null;
}

function toRespondResult(result: Awaited<ReturnType<typeof confirmProposalCore>>): RespondAsTeacherResult {
  return result.ok ? result : { ok: false, code: result.code, message: RESPOND_MESSAGES[result.code] };
}

export async function confirmProposalAsTeacher(
  proposalId: string,
  expectedVersion: number,
): Promise<RespondAsTeacherResult> {
  try {
    const teacher = await resolveTeacher();
    if (!teacher) {
      return { ok: false, code: "proposal_not_found", message: RESPOND_MESSAGES.proposal_not_found };
    }
    return toRespondResult(
      await confirmProposalCore(teacher.teacherProfileId, teacher.userId, proposalId, expectedVersion),
    );
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return { ok: false, code: "authentication_required", message: "請先登入後再處理邀請。" };
    }
    return { ok: false, code: "respond_failed", message: RESPOND_MESSAGES.respond_failed };
  }
}

export async function declineProposalAsTeacher(
  proposalId: string,
  expectedVersion: number,
  reason: string,
): Promise<RespondAsTeacherResult> {
  try {
    const teacher = await resolveTeacher();
    if (!teacher) {
      return { ok: false, code: "proposal_not_found", message: RESPOND_MESSAGES.proposal_not_found };
    }
    return toRespondResult(
      await declineProposalCore(teacher.teacherProfileId, proposalId, expectedVersion, reason),
    );
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return { ok: false, code: "authentication_required", message: "請先登入後再處理邀請。" };
    }
    return { ok: false, code: "respond_failed", message: RESPOND_MESSAGES.respond_failed };
  }
}

// ---------- 團主修改／撤回（票 07）----------

const REVISE_MESSAGES: Record<ReviseProposalErrorCode, string> = {
  proposal_not_found: "找不到這份合作邀請，或你沒有權限查看。",
  proposal_version_stale: "這份邀請剛剛在別處被修改或被老師回覆了，請重新整理後再操作。",
  proposal_invalid_status: "這份邀請目前的狀態不能修改或撤回（可能已撤回或已開放報名），請重新整理查看。",
  organization_locked: "已送出過的邀請不能更換團體，請撤回後另外建立。",
  teacher_not_approved: "這位老師目前無法接受邀請，請選擇其他老師。",
  proposal_incomplete: "老師正在確認這份邀請，修改後的內容仍需完整，請補齊以下欄位。",
  proposal_starts_in_past: "開始時間已經過了，請修改時間。",
  withdraw_reason_invalid: `撤回原因請在 ${WITHDRAW_REASON_MAX_LENGTH} 字以內。`,
  revise_failed: "暫時無法處理，請稍後再試。",
};

export type WithdrawProposalResult = { ok: true } | ProposalFailure;

export async function withdrawOwnProposal(
  proposalId: string,
  expectedVersion: number,
  reason: string,
): Promise<WithdrawProposalResult> {
  try {
    const currentUser = await requireUser();
    const organizerProfileId = await getOwnOrganizerProfileId(currentUser.id);
    if (!organizerProfileId) {
      return NOT_FOUND();
    }
    const result = await withdrawProposalCore(organizerProfileId, proposalId, expectedVersion, reason);
    if (!result.ok) {
      return failure(result.code === "revise_failed" ? "proposal_save_failed" : result.code, REVISE_MESSAGES[result.code]);
    }
    return { ok: true };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return failure("authentication_required", "請先登入後再操作。");
    }
    return failure("proposal_save_failed", REVISE_MESSAGES.revise_failed);
  }
}
