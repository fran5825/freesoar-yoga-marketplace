"use server";

import { revalidatePath } from "next/cache";

import {
  saveOwnProposalDraft,
  selfConfirmOwnProposal,
  withdrawOwnProposal,
  searchApprovedTeacherCards,
  submitOwnProposal,
  type ProposalErrorCode,
  type ProposalTeacherCard,
} from "@/domain/organizer-class-proposal/service";
import type { ProposalFormInput, ProposalValidationError } from "@/domain/organizer-class-proposal/validation";

export type ProposalActionFailure = {
  ok: false;
  code: ProposalErrorCode;
  message: string;
  validationErrors?: ProposalValidationError[];
  // 先存檔再送出時，存檔成功但送出失敗：回傳這筆的 id 與最新 version，表單沿用同一筆。
  proposalId?: string;
  version?: number;
};

export type SaveProposalActionResult =
  | { ok: true; proposalId: string; version: number; status: EditableProposalStatus }
  | ProposalActionFailure;

// 表單能處理的狀態（withdrawn／converted 不能修改）。
export type EditableProposalStatus = "draft" | "pending_confirmation" | "declined" | "confirmed";
export type SubmitProposalActionResult = { ok: true; proposalId: string } | ProposalActionFailure;

// organizer-usability-redesign 票 05：合作邀請表單的 server actions。owner、團體、老師資格都由 service 驗證。
export async function saveProposalDraftAction(
  input: ProposalFormInput,
  proposalId?: string,
  expectedVersion?: number,
): Promise<SaveProposalActionResult> {
  const result = await saveOwnProposalDraft(input, proposalId, expectedVersion);
  if (!result.ok) {
    return result;
  }
  return { ...result, status: result.status as EditableProposalStatus };
}

export async function withdrawProposalAction(
  proposalId: string,
  expectedVersion: number,
  reason: string,
): Promise<{ ok: true } | ProposalActionFailure> {
  const result = await withdrawOwnProposal(proposalId, expectedVersion, reason);
  if (result.ok) {
    revalidatePath(`/organizer/class-proposals/${proposalId}`);
  }
  return result;
}

// 送出前一律先存檔（同一筆），再以存檔後的 version 送出，確保老師看到的就是畫面上的內容。
export async function saveAndSubmitProposalAction(
  input: ProposalFormInput,
  proposalId?: string,
  expectedVersion?: number,
): Promise<SubmitProposalActionResult> {
  const saved = await saveOwnProposalDraft(input, proposalId, expectedVersion);
  if (!saved.ok) {
    return saved;
  }
  const submitted = await submitOwnProposal(saved.proposalId, saved.version);
  if (!submitted.ok) {
    return { ...submitted, proposalId: saved.proposalId, version: saved.version };
  }
  return submitted;
}

// 票 08：授課老師是自己時，先存檔再明確確認由自己授課（不寄邀請給自己）。
export async function saveAndSelfConfirmProposalAction(
  input: ProposalFormInput,
  proposalId?: string,
  expectedVersion?: number,
): Promise<SubmitProposalActionResult> {
  const saved = await saveOwnProposalDraft(input, proposalId, expectedVersion);
  if (!saved.ok) {
    return saved;
  }
  const confirmed = await selfConfirmOwnProposal(saved.proposalId, saved.version);
  if (!confirmed.ok) {
    return { ...confirmed, proposalId: saved.proposalId, version: saved.version };
  }
  return confirmed;
}

// 票 07：老師婉拒後不修改內容、直接再邀請一次（version 不變）。
export async function resubmitProposalAction(
  proposalId: string,
  expectedVersion: number,
): Promise<SubmitProposalActionResult> {
  const result = await submitOwnProposal(proposalId, expectedVersion);
  if (result.ok) {
    revalidatePath(`/organizer/class-proposals/${proposalId}`);
  }
  return result;
}

export async function searchTeacherCardsAction(query: string): Promise<ProposalTeacherCard[]> {
  return searchApprovedTeacherCards(query);
}
