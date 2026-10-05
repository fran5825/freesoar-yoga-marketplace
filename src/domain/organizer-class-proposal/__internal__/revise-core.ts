// __internal__：不是通用 API。只給 service.ts 的 auth-resolving 外層與 Playwright 併發測試直接呼叫。
// 擁有權（團主本人）寫在鎖定與查詢的 WHERE 裡，被誤用也不會改到別人的邀請。
//
// organizer-usability-redesign 票 07（spec 13.3、13.5）：團主修改或撤回尚未轉成正式課程的合作邀請。
// 鎖順序與確認相同：先鎖相關老師（目前的與要換成的，依 id 由小到大）→ 再鎖邀請，
// 鎖內重驗老師沒變、version 與狀態，所以與老師確認、另一次修改或撤回同時發生時只會有一個成功。

import type { OrganizerClassProposalStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ConflictLockHooks } from "@/domain/class-session/conflict-check";

import { getProposalSubmitIssues } from "../submit-issues";
import type { NormalizedProposalDraft, ProposalValidationError } from "../validation";

export const WITHDRAW_REASON_MAX_LENGTH = 500;

export type ReviseProposalErrorCode =
  | "proposal_not_found"
  | "proposal_version_stale"
  | "proposal_invalid_status"
  | "organization_locked"
  | "teacher_not_approved"
  | "proposal_incomplete"
  | "proposal_starts_in_past"
  | "withdraw_reason_invalid"
  | "revise_failed";

export type ReviseProposalResult =
  | { ok: true; version: number; status: OrganizerClassProposalStatus }
  | { ok: false; code: ReviseProposalErrorCode; validationErrors?: ProposalValidationError[] };

export type ProposalRevision = NormalizedProposalDraft & {
  organizationId: string;
  teacherProfileId: string | null;
};

const EDITABLE_STATUSES: OrganizerClassProposalStatus[] = ["draft", "pending_confirmation", "declined", "confirmed"];

class ReviseError extends Error {
  constructor(
    readonly code: ReviseProposalErrorCode,
    readonly validationErrors?: ProposalValidationError[],
  ) {
    super(code);
    this.name = "ReviseError";
  }
}

async function lockTeachersThenProposal(
  tx: Prisma.TransactionClient,
  organizerProfileId: string,
  proposalId: string,
  teacherIds: (string | null)[],
  hooks?: ConflictLockHooks,
) {
  const sortedTeacherIds = Array.from(new Set(teacherIds.filter((id): id is string => Boolean(id)))).sort();
  await hooks?.onBeforeLock?.();
  for (const teacherProfileId of sortedTeacherIds) {
    await tx.$queryRaw`SELECT "id" FROM "TeacherProfile" WHERE "id" = ${teacherProfileId} FOR UPDATE`;
  }
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "OrganizerClassProposal"
    WHERE "id" = ${proposalId} AND "organizerProfileId" = ${organizerProfileId}
    FOR UPDATE
  `;
  await hooks?.onLockAcquired?.();
  return locked.length > 0;
}

export async function reviseProposalCore(
  organizerProfileId: string,
  proposalId: string,
  expectedVersion: number,
  revision: ProposalRevision,
  hooks?: ConflictLockHooks,
): Promise<ReviseProposalResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const preview = await tx.organizerClassProposal.findFirst({
        where: { id: proposalId, organizerProfileId },
        select: { teacherProfileId: true },
      });
      if (!preview) {
        throw new ReviseError("proposal_not_found");
      }
      if (
        !(await lockTeachersThenProposal(
          tx,
          organizerProfileId,
          proposalId,
          [preview.teacherProfileId, revision.teacherProfileId],
          hooks,
        ))
      ) {
        throw new ReviseError("proposal_not_found");
      }

      const current = await tx.organizerClassProposal.findUniqueOrThrow({
        where: { id: proposalId },
        select: { status: true, version: true, teacherProfileId: true, organizationId: true, submittedAt: true },
      });
      // 鎖到之前老師被換掉了：鎖的不是現在這位老師，請對方重新整理。
      if (current.teacherProfileId !== preview.teacherProfileId) {
        throw new ReviseError("proposal_version_stale");
      }
      if (!EDITABLE_STATUSES.includes(current.status)) {
        throw new ReviseError("proposal_invalid_status");
      }
      if (current.version !== expectedVersion) {
        throw new ReviseError("proposal_version_stale");
      }
      if (current.submittedAt && current.organizationId !== revision.organizationId) {
        throw new ReviseError("organization_locked");
      }

      let switchedToSelf = false;
      if (revision.teacherProfileId && revision.teacherProfileId !== current.teacherProfileId) {
        const teacher = await tx.teacherProfile.findUnique({
          where: { id: revision.teacherProfileId },
          select: { status: true, userId: true },
        });
        if (teacher?.status !== "approved") {
          throw new ReviseError("teacher_not_approved");
        }
        const organizer = await tx.organizerProfile.findUniqueOrThrow({
          where: { id: organizerProfileId },
          select: { userId: true },
        });
        // 票 08：改成由團主自己授課時不寄邀請給自己。等待確認中的邀請退回草稿，
        // 原本的受邀老師不再看得到，團主接著用「由我授課並確認」。
        switchedToSelf = teacher.userId === organizer.userId;
      }

      // 等待老師確認中的邀請：修改後老師看到的就是新內容，所以必須仍然完整、時間在未來。
      if (current.status === "pending_confirmation" && !switchedToSelf) {
        const issues = getProposalSubmitIssues(revision);
        if (issues.errors.length > 0) {
          throw new ReviseError(
            issues.startsInPast ? "proposal_starts_in_past" : "proposal_incomplete",
            issues.errors,
          );
        }
      }

      // spec 13.3：pending 修改維持 pending；declined 與 confirmed 修改回 draft（confirmed 的確認失效、時段釋放）。
      const nextStatus: OrganizerClassProposalStatus =
        current.status === "pending_confirmation" && !switchedToSelf ? "pending_confirmation" : "draft";

      const updated = await tx.organizerClassProposal.update({
        where: { id: proposalId },
        data: {
          ...revision,
          status: nextStatus,
          version: { increment: 1 },
          transitionSeq: { increment: 1 },
          ...(current.status === "confirmed"
            ? { confirmedVersion: null, confirmedAt: null, confirmedByUserId: null }
            : {}),
        },
        select: { version: true, status: true },
      });
      return { ok: true as const, version: updated.version, status: updated.status };
    });
  } catch (error) {
    if (error instanceof ReviseError) {
      return error.validationErrors
        ? { ok: false, code: error.code, validationErrors: error.validationErrors }
        : { ok: false, code: error.code };
    }
    return { ok: false, code: "revise_failed" };
  }
}

export async function withdrawProposalCore(
  organizerProfileId: string,
  proposalId: string,
  expectedVersion: number,
  reason: string,
  hooks?: ConflictLockHooks,
): Promise<ReviseProposalResult> {
  const trimmed = reason.trim();
  if (trimmed.length > WITHDRAW_REASON_MAX_LENGTH) {
    return { ok: false, code: "withdraw_reason_invalid" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const preview = await tx.organizerClassProposal.findFirst({
        where: { id: proposalId, organizerProfileId },
        select: { teacherProfileId: true },
      });
      if (!preview) {
        throw new ReviseError("proposal_not_found");
      }
      if (!(await lockTeachersThenProposal(tx, organizerProfileId, proposalId, [preview.teacherProfileId], hooks))) {
        throw new ReviseError("proposal_not_found");
      }

      const current = await tx.organizerClassProposal.findUniqueOrThrow({
        where: { id: proposalId },
        select: { status: true, version: true, teacherProfileId: true },
      });
      if (current.teacherProfileId !== preview.teacherProfileId) {
        throw new ReviseError("proposal_version_stale");
      }
      // withdrawn、converted 是終局狀態；撤回後不能再被改回其他狀態。
      if (!EDITABLE_STATUSES.includes(current.status)) {
        throw new ReviseError("proposal_invalid_status");
      }
      if (current.version !== expectedVersion) {
        throw new ReviseError("proposal_version_stale");
      }

      const updated = await tx.organizerClassProposal.update({
        where: { id: proposalId },
        data: {
          status: "withdrawn",
          withdrawReason: trimmed.length > 0 ? trimmed : null,
          transitionSeq: { increment: 1 },
          // 從草稿撤回：目前這個版本從沒送給任何老師（可能是從未送出，或修改後換了老師還沒重送），
          // 清掉受邀老師，讓沒收過這份邀請的老師讀不到內容與團體聯絡資料。
          ...(current.status === "draft" ? { teacherProfileId: null } : {}),
        },
        select: { version: true, status: true },
      });
      return { ok: true as const, version: updated.version, status: updated.status };
    });
  } catch (error) {
    if (error instanceof ReviseError) {
      return { ok: false, code: error.code };
    }
    return { ok: false, code: "revise_failed" };
  }
}
