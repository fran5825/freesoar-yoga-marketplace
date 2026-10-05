// __internal__：不是通用 API。只給 service.ts 的 auth-resolving 外層與 Playwright 併發測試直接呼叫。
// 擁有權（受邀老師本人）寫在查詢與鎖定的 WHERE 裡，被誤用也不會改到別人的邀請。
//
// organizer-usability-redesign 票 06（spec 13.3、13.5）：受邀老師確認或婉拒合作邀請。
// 確認：鎖老師（同時做撞課檢查）→ 鎖邀請 → 在鎖內重驗 version、狀態、老師資格、未來時間與完整度，
// 成功才把狀態改成 confirmed，從這一刻起占用老師時段。婉拒不占時段，只需要原子更新。

import { prisma } from "@/lib/prisma";
import { lockTeacherScheduleAndCheckConflict, type ConflictLockHooks } from "@/domain/class-session/conflict-check";

import { getProposalSubmitIssues } from "../submit-issues";

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
  | "respond_failed";

export type RespondToProposalResult =
  | { ok: true }
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
    await prisma.$transaction(async (tx) => {
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

      await tx.organizerClassProposal.update({
        where: { id: proposalId },
        data: {
          status: "confirmed",
          confirmedVersion: proposal.version,
          confirmedAt: new Date(),
          confirmedByUserId: teacherUserId,
          transitionSeq: { increment: 1 },
        },
      });
    });
    return { ok: true };
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
    const updated = await prisma.organizerClassProposal.updateMany({
      where: { id: proposalId, teacherProfileId, status: "pending_confirmation", version: expectedVersion },
      data: { status: "declined", declineReason: trimmed, transitionSeq: { increment: 1 } },
    });
    if (updated.count > 0) {
      return { ok: true };
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
