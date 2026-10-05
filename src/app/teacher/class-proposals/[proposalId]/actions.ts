"use server";

import { revalidatePath } from "next/cache";

import {
  confirmProposalAsTeacher,
  declineProposalAsTeacher,
  type RespondAsTeacherResult,
} from "@/domain/organizer-class-proposal/service";

// organizer-usability-redesign 票 06：受邀老師確認或婉拒。身分、資格、version 與撞課都由 domain 驗證。
export async function confirmProposalAction(
  proposalId: string,
  expectedVersion: number,
): Promise<RespondAsTeacherResult> {
  const result = await confirmProposalAsTeacher(proposalId, expectedVersion);
  if (result.ok) {
    revalidatePath(`/teacher/class-proposals/${proposalId}`);
  }
  return result;
}

export async function declineProposalAction(
  proposalId: string,
  expectedVersion: number,
  reason: string,
): Promise<RespondAsTeacherResult> {
  const result = await declineProposalAsTeacher(proposalId, expectedVersion, reason);
  if (result.ok) {
    revalidatePath(`/teacher/class-proposals/${proposalId}`);
  }
  return result;
}
