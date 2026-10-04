"use server";

import {
  saveOwnProposalDraft,
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

export type SaveProposalActionResult = { ok: true; proposalId: string; version: number } | ProposalActionFailure;
export type SubmitProposalActionResult = { ok: true; proposalId: string } | ProposalActionFailure;

// organizer-usability-redesign 票 05：合作邀請表單的 server actions。owner、團體、老師資格都由 service 驗證。
export async function saveProposalDraftAction(
  input: ProposalFormInput,
  proposalId?: string,
  expectedVersion?: number,
): Promise<SaveProposalActionResult> {
  return saveOwnProposalDraft(input, proposalId, expectedVersion);
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

export async function searchTeacherCardsAction(query: string): Promise<ProposalTeacherCard[]> {
  return searchApprovedTeacherCards(query);
}
