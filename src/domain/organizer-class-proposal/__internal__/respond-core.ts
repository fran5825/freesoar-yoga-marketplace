// __internal__：不是通用 API。只給 service.ts 的 auth-resolving 外層與 Playwright 併發測試直接呼叫。
// 擁有權（受邀老師本人）寫在查詢與鎖定的 WHERE 裡，被誤用也不會改到別人的邀請。
//
// organizer-usability-redesign 票 06（spec 13.3、13.5）：受邀老師確認或婉拒合作邀請。
// 確認：鎖老師（同時做撞課檢查）→ 鎖邀請 → 在鎖內重驗 version、狀態、老師資格、未來時間與完整度，
// 成功才把狀態改成 confirmed，從這一刻起占用老師時段。婉拒不占時段，只需要原子更新。

import { prisma } from "@/lib/prisma";
import { lockTeacherScheduleAndCheckConflict, type ConflictLockHooks } from "@/domain/class-session/conflict-check";

import { isOrganizationContactComplete } from "@/domain/demand-request/validation";

import { getProposalSubmitIssues } from "../submit-issues";
import type { ProposalTransitionEvent } from "./transition-event";

export const DECLINE_REASON_MAX_LENGTH = 500;

export type RespondToProposalErrorCode =
  | "proposal_not_found"
  | "proposal_version_stale"
  | "proposal_invalid_status"
  | "teacher_not_approved"
  | "proposal_starts_in_past"
  | "proposal_incomplete"
  | "schedule_conflict"
  | "decline_reason_invalid"
  | "not_self_teacher"
  | "organization_contact_incomplete"
  | "respond_failed";

// 票 12：成功時帶回這次轉換的資料（transitionSeq 與修改前後），由 service 在 commit 後發通知。
export type RespondToProposalResult =
  | { ok: true; event: ProposalTransitionEvent }
  | { ok: false; code: RespondToProposalErrorCode };

class RespondError extends Error {
  constructor(readonly code: RespondToProposalErrorCode) {
    super(code);
    this.name = "RespondError";
  }
}

export async function confirmProposalCore(
  teacherProfileId: string,
  teacherUserId: string,
  proposalId: string,
  expectedVersion: number,
  hooks?: ConflictLockHooks,
): Promise<RespondToProposalResult> {
  try {
    const event = await prisma.$transaction(async (tx) => {
      // 鎖外先讀出時間，用來在鎖老師時做撞課檢查；鎖到邀請後再以 version 確認內容沒變。
      const preview = await tx.organizerClassProposal.findFirst({
        where: { id: proposalId, teacherProfileId, status: { not: "draft" } },
        select: { startAt: true, endAt: true },
      });
      if (!preview) {
        throw new RespondError("proposal_not_found");
      }
      if (!preview.startAt || !preview.endAt) {
        throw new RespondError("proposal_incomplete");
      }

      let conflict = await lockTeacherScheduleAndCheckConflict(
        tx,
        teacherProfileId,
        preview.startAt,
        preview.endAt,
        undefined,
        hooks,
        { excludeProposalId: proposalId },
      );

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "OrganizerClassProposal"
        WHERE "id" = ${proposalId} AND "teacherProfileId" = ${teacherProfileId}
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new RespondError("proposal_not_found");
      }

      const proposal = await tx.organizerClassProposal.findUniqueOrThrow({
        where: { id: proposalId },
        select: {
          status: true,
          version: true,
          teacherProfileId: true,
          title: true,
          description: true,
          serviceTypes: true,
          startAt: true,
          endAt: true,
          location: true,
          capacity: true,
          isPublic: true,
        },
      });
      if (proposal.status !== "pending_confirmation") {
        throw new RespondError("proposal_invalid_status");
      }
      if (proposal.version !== expectedVersion) {
        throw new RespondError("proposal_version_stale");
      }

      // 撞課檢查用的是鎖外預讀的時間。若等待老師鎖期間內容被改了（時間不同），
      // 此時已持有老師鎖與邀請鎖，用鎖內最新的時間重新檢查一次，確認的時段一定是檢查過的時段。
      if (
        proposal.startAt &&
        proposal.endAt &&
        (proposal.startAt.getTime() !== preview.startAt.getTime() ||
          proposal.endAt.getTime() !== preview.endAt.getTime())
      ) {
        conflict = await lockTeacherScheduleAndCheckConflict(
          tx,
          teacherProfileId,
          proposal.startAt,
          proposal.endAt,
          undefined,
          undefined,
          { excludeProposalId: proposalId },
        );
      }

      // 老師資格在老師鎖內讀取，避免與管理員暫停老師的更新產生競態。
      const teacher = await tx.teacherProfile.findUniqueOrThrow({
        where: { id: teacherProfileId },
        select: { status: true },
      });
      if (teacher.status !== "approved") {
        throw new RespondError("teacher_not_approved");
      }

      const issues = getProposalSubmitIssues(proposal);
      if (issues.errors.length > 0) {
        throw new RespondError(issues.startsInPast ? "proposal_starts_in_past" : "proposal_incomplete");
      }
      if (conflict) {
        throw new RespondError("schedule_conflict");
      }

      const updated = await tx.organizerClassProposal.update({
        where: { id: proposalId },
        data: {
          status: "confirmed",
          confirmedVersion: proposal.version,
          confirmedAt: new Date(),
          confirmedByUserId: teacherUserId,
          transitionSeq: { increment: 1 },
        },
        select: { transitionSeq: true },
      });
      return {
        proposalId,
        transitionSeq: updated.transitionSeq,
        before: { status: proposal.status, teacherProfileId: proposal.teacherProfileId, title: proposal.title },
        after: { status: "confirmed" as const, teacherProfileId: proposal.teacherProfileId, title: proposal.title },
      };
    });
    return { ok: true, event };
  } catch (error) {
    if (error instanceof RespondError) {
      return { ok: false, code: error.code };
    }
    return { ok: false, code: "respond_failed" };
  }
}

export async function declineProposalCore(
  teacherProfileId: string,
  proposalId: string,
  expectedVersion: number,
  reason: string,
): Promise<RespondToProposalResult> {
  const trimmed = reason.trim();
  if (trimmed.length === 0 || trimmed.length > DECLINE_REASON_MAX_LENGTH) {
    return { ok: false, code: "decline_reason_invalid" };
  }

  try {
    // 狀態、version、受邀老師都寫進 WHERE：與確認或團主修改同時發生時只有一個會成功。
    // 票 12：同一個 transaction 內讀回 transitionSeq（更新後這一列仍被本 transaction 鎖住）。
    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.organizerClassProposal.updateMany({
        where: { id: proposalId, teacherProfileId, status: "pending_confirmation", version: expectedVersion },
        data: { status: "declined", declineReason: trimmed, transitionSeq: { increment: 1 } },
      });
      if (updated.count === 0) {
        return null;
      }
      const row = await tx.organizerClassProposal.findUniqueOrThrow({
        where: { id: proposalId },
        select: { transitionSeq: true, title: true },
      });
      return {
        proposalId,
        transitionSeq: row.transitionSeq,
        before: { status: "pending_confirmation" as const, teacherProfileId, title: row.title },
        after: { status: "declined" as const, teacherProfileId, title: row.title },
      };
    });
    if (event) {
      return { ok: true, event };
    }

    const current = await prisma.organizerClassProposal.findFirst({
      where: { id: proposalId, teacherProfileId, status: { not: "draft" } },
      select: { status: true, version: true },
    });
    if (!current) {
      return { ok: false, code: "proposal_not_found" };
    }
    if (current.status !== "pending_confirmation") {
      return { ok: false, code: "proposal_invalid_status" };
    }
    return { ok: false, code: "proposal_version_stale" };
  } catch {
    return { ok: false, code: "respond_failed" };
  }
}

// organizer-usability-redesign 票 08（spec 3.2、13.3）：approved 老師兼團主在團主表單明確確認由自己授課，
// 不必先邀請再用老師身分接受自己的邀請。資格、版本、完整度與撞課檢查與受邀老師確認相同；
// 鎖順序同樣是老師 → 邀請。成功時同時寫入 submittedAt（之後不能換團體）。
export async function selfConfirmProposalCore(
  organizerProfileId: string,
  userId: string,
  proposalId: string,
  expectedVersion: number,
  hooks?: ConflictLockHooks,
): Promise<RespondToProposalResult> {
  try {
    const event = await prisma.$transaction(async (tx) => {
      const preview = await tx.organizerClassProposal.findFirst({
        where: { id: proposalId, organizerProfileId },
        select: { startAt: true, endAt: true, teacherProfileId: true },
      });
      if (!preview) {
        throw new RespondError("proposal_not_found");
      }
      if (!preview.teacherProfileId) {
        throw new RespondError("not_self_teacher");
      }
      const teacherOwner = await tx.teacherProfile.findUnique({
        where: { id: preview.teacherProfileId },
        select: { userId: true },
      });
      // 只看 teacherProfileId 不能代表同意：必須是團主本人的老師資料。
      if (teacherOwner?.userId !== userId) {
        throw new RespondError("not_self_teacher");
      }
      if (!preview.startAt || !preview.endAt) {
        throw new RespondError("proposal_incomplete");
      }

      let conflict = await lockTeacherScheduleAndCheckConflict(
        tx,
        preview.teacherProfileId,
        preview.startAt,
        preview.endAt,
        undefined,
        hooks,
        { excludeProposalId: proposalId },
      );

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "OrganizerClassProposal"
        WHERE "id" = ${proposalId} AND "organizerProfileId" = ${organizerProfileId}
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new RespondError("proposal_not_found");
      }

      const proposal = await tx.organizerClassProposal.findUniqueOrThrow({
        where: { id: proposalId },
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
            select: { ownerOrganizerProfileId: true, contactName: true, contactEmail: true, contactPhone: true },
          },
        },
      });
      if (proposal.status !== "draft") {
        throw new RespondError("proposal_invalid_status");
      }
      if (proposal.version !== expectedVersion) {
        throw new RespondError("proposal_version_stale");
      }
      if (proposal.teacherProfileId !== preview.teacherProfileId) {
        throw new RespondError("proposal_version_stale");
      }
      if (proposal.organization.ownerOrganizerProfileId !== organizerProfileId) {
        throw new RespondError("proposal_not_found");
      }
      if (!isOrganizationContactComplete(proposal.organization)) {
        throw new RespondError("organization_contact_incomplete");
      }

      const teacher = await tx.teacherProfile.findUniqueOrThrow({
        where: { id: preview.teacherProfileId },
        select: { status: true },
      });
      if (teacher.status !== "approved") {
        throw new RespondError("teacher_not_approved");
      }

      const issues = getProposalSubmitIssues(proposal);
      if (issues.errors.length > 0) {
        throw new RespondError(issues.startsInPast ? "proposal_starts_in_past" : "proposal_incomplete");
      }
      if (
        proposal.startAt &&
        proposal.endAt &&
        (proposal.startAt.getTime() !== preview.startAt.getTime() ||
          proposal.endAt.getTime() !== preview.endAt.getTime())
      ) {
        conflict = await lockTeacherScheduleAndCheckConflict(
          tx,
          preview.teacherProfileId,
          proposal.startAt,
          proposal.endAt,
          undefined,
          undefined,
          { excludeProposalId: proposalId },
        );
      }
      if (conflict) {
        throw new RespondError("schedule_conflict");
      }

      const now = new Date();
      const updated = await tx.organizerClassProposal.update({
        where: { id: proposalId },
        data: {
          status: "confirmed",
          ...(proposal.submittedAt ? {} : { submittedAt: now }),
          declineReason: null,
          confirmedVersion: proposal.version,
          confirmedAt: now,
          confirmedByUserId: userId,
          transitionSeq: { increment: 1 },
        },
        select: { transitionSeq: true },
      });
      return {
        proposalId,
        transitionSeq: updated.transitionSeq,
        before: { status: proposal.status, teacherProfileId: proposal.teacherProfileId, title: proposal.title },
        after: { status: "confirmed" as const, teacherProfileId: proposal.teacherProfileId, title: proposal.title },
      };
    });
    return { ok: true, event };
  } catch (error) {
    if (error instanceof RespondError) {
      return { ok: false, code: error.code };
    }
    return { ok: false, code: "respond_failed" };
  }
}
