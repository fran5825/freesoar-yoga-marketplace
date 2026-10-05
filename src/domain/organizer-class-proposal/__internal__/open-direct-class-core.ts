// __internal__：不是通用 API。只給 service.ts 的 auth-resolving 外層與 Playwright 併發測試直接呼叫。
// 擁有權（團主本人）寫在鎖定與查詢的 WHERE 裡。
//
// organizer-usability-redesign 票 09（spec 13.5、13.6）：老師已確認的合作邀請，由團主一次完成「建立正式課程＋開放報名」。
// 同一個 transaction：鎖老師（撞課檢查只排除這筆邀請自己的預留）→ 鎖邀請 → 重驗 → 建立 organizer_direct 課程
// （直接 open_for_enrollment）→ 邀請改為 converted 並指向這堂課。不先建 draft 再到另一個 transaction 開放。
// 重試：鎖到邀請時已經 converted 就回傳同一堂課；任何失敗整個 rollback，邀請維持 confirmed、預留不變。

import { prisma } from "@/lib/prisma";
import { lockTeacherScheduleAndCheckConflict, type ConflictLockHooks } from "@/domain/class-session/conflict-check";
import { notifyUsers } from "@/domain/notification/create";

import { getProposalSubmitIssues } from "../submit-issues";

export type OpenDirectClassErrorCode =
  | "proposal_not_found"
  | "proposal_invalid_status"
  | "proposal_version_stale"
  | "teacher_not_approved"
  | "proposal_starts_in_past"
  | "proposal_incomplete"
  | "schedule_conflict"
  | "open_failed";

export type OpenDirectClassResult =
  | { ok: true; classSessionId: string }
  | { ok: false; code: OpenDirectClassErrorCode };

class OpenError extends Error {
  constructor(readonly code: OpenDirectClassErrorCode) {
    super(code);
    this.name = "OpenError";
  }
}

export type OpenDirectClassHooks = ConflictLockHooks & {
  // 供測試在「課程已建立、邀請尚未標記 converted」時拋錯，驗證整個 transaction rollback。
  onClassSessionCreated?: () => void | Promise<void>;
};

export async function openDirectClassFromProposalCore(
  organizerProfileId: string,
  proposalId: string,
  expectedVersion: number,
  hooks?: OpenDirectClassHooks,
): Promise<OpenDirectClassResult> {
  let createdForTeacher: { teacherUserId: string; organizerUserId: string; title: string } | null = null;

  try {
    const classSessionId = await prisma.$transaction(async (tx) => {
      const preview = await tx.organizerClassProposal.findFirst({
        where: { id: proposalId, organizerProfileId },
        select: { teacherProfileId: true, startAt: true, endAt: true, status: true, classSessionId: true },
      });
      if (!preview) {
        throw new OpenError("proposal_not_found");
      }
      // 重試：已經轉成正式課程，直接回傳同一堂課。
      if (preview.status === "converted" && preview.classSessionId) {
        return preview.classSessionId;
      }
      if (!preview.teacherProfileId || !preview.startAt || !preview.endAt) {
        throw new OpenError("proposal_invalid_status");
      }

      const conflict = await lockTeacherScheduleAndCheckConflict(
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
        throw new OpenError("proposal_not_found");
      }

      const proposal = await tx.organizerClassProposal.findUniqueOrThrow({
        where: { id: proposalId },
        select: {
          status: true,
          version: true,
          confirmedVersion: true,
          classSessionId: true,
          teacherProfileId: true,
          organizationId: true,
          title: true,
          description: true,
          serviceType: true,
          serviceTypes: true,
          yogaStyles: true,
          startAt: true,
          endAt: true,
          location: true,
          capacity: true,
          isPublic: true,
          organizerProfile: { select: { userId: true } },
          teacherProfile: { select: { userId: true, status: true } },
        },
      });
      // 等鎖期間另一個請求已經開放：回傳同一堂課，不建立第二堂。
      if (proposal.status === "converted" && proposal.classSessionId) {
        return proposal.classSessionId;
      }
      if (proposal.status !== "confirmed") {
        throw new OpenError("proposal_invalid_status");
      }
      // 開放的必須是老師確認過的那個版本，也是團主畫面上看到的版本。
      if (proposal.confirmedVersion !== proposal.version || proposal.version !== expectedVersion) {
        throw new OpenError("proposal_version_stale");
      }
      if (
        proposal.teacherProfileId !== preview.teacherProfileId ||
        proposal.startAt?.getTime() !== preview.startAt.getTime() ||
        proposal.endAt?.getTime() !== preview.endAt.getTime()
      ) {
        throw new OpenError("proposal_version_stale");
      }
      const teacherProfile = proposal.teacherProfile;
      if (!teacherProfile || teacherProfile.status !== "approved") {
        throw new OpenError("teacher_not_approved");
      }
      const issues = getProposalSubmitIssues(proposal);
      if (issues.errors.length > 0) {
        throw new OpenError(issues.startsInPast ? "proposal_starts_in_past" : "proposal_incomplete");
      }
      if (conflict) {
        throw new OpenError("schedule_conflict");
      }

      const classSession = await tx.classSession.create({
        data: {
          origin: "organizer_direct",
          status: "open_for_enrollment",
          requiresApproval: false,
          teacherProfileId: preview.teacherProfileId,
          organizerProfileId,
          organizationId: proposal.organizationId,
          demandRequestId: null,
          title: proposal.title as string,
          description: proposal.description,
          serviceType: proposal.serviceType ?? proposal.serviceTypes[0] ?? null,
          serviceTypes: proposal.serviceTypes,
          yogaStyles: proposal.yogaStyles,
          startAt: proposal.startAt as Date,
          endAt: proposal.endAt as Date,
          location: proposal.location as string,
          capacity: proposal.capacity as number,
          isPublic: proposal.isPublic,
        },
        select: { id: true },
      });

      await hooks?.onClassSessionCreated?.();

      await tx.organizerClassProposal.update({
        where: { id: proposalId },
        data: { status: "converted", classSessionId: classSession.id, transitionSeq: { increment: 1 } },
      });

      createdForTeacher = {
        teacherUserId: teacherProfile.userId,
        organizerUserId: proposal.organizerProfile.userId,
        title: proposal.title as string,
      };
      return classSession.id;
    });

    // 通知在 commit 之後才發，失敗不影響開放結果；本人授課不通知自己（spec 13.7）。
    const created = createdForTeacher as { teacherUserId: string; organizerUserId: string; title: string } | null;
    if (created && created.teacherUserId !== created.organizerUserId) {
      try {
        await notifyUsers("class_session_created", [{ userId: created.teacherUserId, role: "counterpart" }], {
          classSessionTitle: created.title,
        });
      } catch (notifyError) {
        console.error("[notification] class_session_created (organizer_direct) failed", notifyError);
      }
    }

    return { ok: true, classSessionId };
  } catch (error) {
    if (error instanceof OpenError) {
      return { ok: false, code: error.code };
    }
    // 同一份邀請不會建出第二堂課，靠的是鎖與鎖內「已 converted」的重驗；classSessionId @unique 防的是
    // 多份邀請指向同一堂課。這裡只是保險：若交易失敗時邀請其實已被另一個請求轉成課程，就回傳那一堂。
    const existing = await prisma.organizerClassProposal.findFirst({
      where: { id: proposalId, organizerProfileId, status: "converted" },
      select: { classSessionId: true },
    });
    if (existing?.classSessionId) {
      return { ok: true, classSessionId: existing.classSessionId };
    }
    return { ok: false, code: "open_failed" };
  }
}
