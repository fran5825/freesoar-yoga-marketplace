"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProposalActionFailure, SubmitProposalActionResult } from "../actions";

const WITHDRAW_REASON_MAX_LENGTH = 500;

type ManageableStatus = "draft" | "pending_confirmation" | "declined" | "confirmed";

// organizer-usability-redesign 票 07：團主在單筆邀請上的修改與撤回。
// 撤回前先說明影響（已確認的會釋放老師時段、撤回後不能恢復），原因選填。
export function ProposalManageActions({
  proposalId,
  version,
  status,
  onWithdraw,
  onResubmit,
}: {
  proposalId: string;
  version: number;
  status: ManageableStatus;
  onWithdraw: (proposalId: string, expectedVersion: number, reason: string) => Promise<{ ok: true } | ProposalActionFailure>;
  onResubmit: (proposalId: string, expectedVersion: number) => Promise<SubmitProposalActionResult>;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editLabel: Record<ManageableStatus, string> = {
    draft: "繼續編輯",
    pending_confirmation: "修改內容",
    declined: "修改並重新邀請",
    confirmed: "修改內容（確認會失效）",
  };

  async function handleResubmit() {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const result = await onResubmit(proposalId, version);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.message);
    } catch {
      setError("暫時無法重新邀請，請稍後再試。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleWithdraw() {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const result = await onWithdraw(proposalId, version, reason);
      if (result.ok) {
        setIsWithdrawing(false);
        router.refresh();
        return;
      }
      setError(result.message);
    } catch {
      setError("暫時無法撤回，請稍後再試。");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="mt-3 grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          className="inline-flex justify-center rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
          href={`/organizer/class-proposals/${proposalId}/edit`}
        >
          {editLabel[status]}
        </Link>
        {status === "declined" && !isWithdrawing ? (
          <button
            className="rounded-full border border-pine/40 bg-white px-5 py-2 text-sm font-medium text-pine disabled:cursor-not-allowed disabled:text-ink-faint"
            disabled={isBusy}
            onClick={handleResubmit}
            type="button"
          >
            {isBusy ? "處理中..." : "不修改，直接重新邀請"}
          </button>
        ) : null}
        {isWithdrawing ? null : (
          <button
            className="rounded-full border border-clay/40 bg-white px-5 py-2 text-sm font-medium text-clay-deep"
            onClick={() => setIsWithdrawing(true)}
            type="button"
          >
            撤回邀請
          </button>
        )}
      </div>

      {error ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {isWithdrawing ? (
        <div className="grid gap-3 rounded-xl border border-clay/25 bg-white p-4 text-sm">
          <p className="font-medium text-ink">確定要撤回這份邀請？</p>
          <p className="text-ink-soft">
            {status === "confirmed"
              ? "老師已確認的時段會釋放，"
              : ""}
            撤回後這份邀請就結束了，不能恢復；需要時可以另外建立新的安排。
          </p>
          <label className="font-medium text-ink" htmlFor={reasonId}>
            撤回原因（選填）
          </label>
          <textarea
            className="min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
            disabled={isBusy}
            id={reasonId}
            maxLength={WITHDRAW_REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="rounded-full bg-clay-deep px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15"
              disabled={isBusy}
              onClick={handleWithdraw}
              type="button"
            >
              {isBusy ? "處理中..." : "確認撤回"}
            </button>
            <button
              className="rounded-full border border-ink/20 px-5 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed"
              disabled={isBusy}
              onClick={() => setIsWithdrawing(false)}
              type="button"
            >
              先不要
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
