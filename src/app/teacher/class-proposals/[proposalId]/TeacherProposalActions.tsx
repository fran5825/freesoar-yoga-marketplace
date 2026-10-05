"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import type { RespondAsTeacherResult } from "@/domain/organizer-class-proposal/service";

const DECLINE_REASON_MAX_LENGTH = 500;

// organizer-usability-redesign 票 06：受邀老師的確認／婉拒操作。
// 確認前先說明效果（保留時段、之後由團主開放報名）；婉拒必須附原因讓團主知道怎麼調整。
// 成功後重新載入頁面顯示最新狀態；失敗時留在原頁顯示原因，已填的婉拒原因不清空。
export function TeacherProposalActions({
  proposalId,
  version,
  organizationName,
  onConfirm,
  onDecline,
}: {
  proposalId: string;
  version: number;
  organizationName: string;
  onConfirm: (proposalId: string, expectedVersion: number) => Promise<RespondAsTeacherResult>;
  onDecline: (proposalId: string, expectedVersion: number, reason: string) => Promise<RespondAsTeacherResult>;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [mode, setMode] = useState<"idle" | "confirming" | "declining">("idle");
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<RespondAsTeacherResult>) {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.ok) {
        setMode("idle");
        router.refresh();
        return;
      }
      setError(result.message);
    } catch {
      setError("暫時無法處理，請稍後再試。");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section aria-label="回覆邀請" className="grid gap-4 rounded-2xl border border-pine/20 bg-pine-tint p-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">回覆這份邀請</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
          確認後這個時段會保留給這堂課，之後由 {organizationName} 開放報名；如果時間或內容不適合，可以附上原因婉拒。
        </p>
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

      {mode === "confirming" ? (
        <div className="grid gap-3 rounded-xl border border-pine/30 bg-white p-4 text-sm leading-6 text-ink">
          <p className="font-medium">確認由你授課？</p>
          <p className="text-ink-soft">確認的是目前頁面上的內容；團主之後若修改，會請你重新確認。</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
              disabled={isBusy}
              onClick={() => run(() => onConfirm(proposalId, version))}
              type="button"
            >
              {isBusy ? "處理中..." : "確認授課"}
            </button>
            <button
              className="rounded-full border border-ink/20 px-5 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed"
              disabled={isBusy}
              onClick={() => setMode("idle")}
              type="button"
            >
              先不要
            </button>
          </div>
        </div>
      ) : mode === "declining" ? (
        <div className="grid gap-3 rounded-xl border border-ink/15 bg-white p-4 text-sm">
          <label className="font-medium text-ink" htmlFor={reasonId}>
            婉拒原因
          </label>
          <p className="-mt-2 text-xs leading-5 text-ink-soft">
            團主會看到這段說明，例如時間衝突或希望調整的地方（{DECLINE_REASON_MAX_LENGTH} 字以內）。
          </p>
          <textarea
            className="min-h-24 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
            disabled={isBusy}
            id={reasonId}
            maxLength={DECLINE_REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="rounded-full bg-clay-deep px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
              disabled={isBusy || reason.trim().length === 0}
              onClick={() => run(() => onDecline(proposalId, version, reason))}
              type="button"
            >
              {isBusy ? "處理中..." : "送出婉拒"}
            </button>
            <button
              className="rounded-full border border-ink/20 px-5 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed"
              disabled={isBusy}
              onClick={() => setMode("idle")}
              type="button"
            >
              返回
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="rounded-full bg-pine px-5 py-2.5 text-sm font-medium text-white transition hover:bg-pine-deep"
            onClick={() => setMode("confirming")}
            type="button"
          >
            確認授課
          </button>
          <button
            className="rounded-full border border-clay/40 bg-white px-5 py-2.5 text-sm font-medium text-clay-deep"
            onClick={() => setMode("declining")}
            type="button"
          >
            婉拒並說明原因
          </button>
        </div>
      )}
    </section>
  );
}
