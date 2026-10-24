"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import type { TeacherGetStarted } from "@/domain/teacher-profile/get-started";

// teacher-first-run 票 08：總覽最上方的「開始使用」。要不要顯示、每步完成與否都由 domain 層
// （buildTeacherGetStarted）判斷，這裡只負責顯示與「先不用」。
// 「先不用」只記在這個瀏覽器（localStorage，不存進資料庫）；讀不到（私密視窗、被封鎖）就照常顯示。
const storageKeyPrefix = "freesoar:teacher-get-started-dismissed:";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readDismissed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "yes";
  } catch {
    return false;
  }
}

export function GetStartedCard({ getStarted }: { getStarted: TeacherGetStarted }) {
  const storageKey = `${storageKeyPrefix}${getStarted.teacherProfileId}`;
  // 伺服器畫面一律先顯示，掛載後才讀瀏覽器記憶，避免伺服器與瀏覽器第一次畫面不一致。
  const storedDismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(storageKey),
    () => false,
  );
  // 存不了（私密視窗）時，這次畫面仍然收起。
  const [dismissedNow, setDismissedNow] = useState(false);

  if (storedDismissed || dismissedNow) {
    return null;
  }

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "yes");
    } catch {
      // 存不了也照樣收起這次的畫面。
    }
    setDismissedNow(true);
    listeners.forEach((listener) => listener());
  }

  return (
    <section
      aria-labelledby="get-started-title"
      className="grid gap-4 rounded-2xl border border-gold/30 bg-gold-tint p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-ink" id="get-started-title">
          開始使用
        </h2>
        <button
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-ink-soft transition hover:text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          onClick={dismiss}
          type="button"
        >
          先不用
        </button>
      </div>
      <p className="text-sm leading-6 text-ink-soft">
        通過審核了，歡迎加入飛索。照下面的順序完成，學員就能報名你的課。
      </p>
      <ol className="grid gap-3">
        {getStarted.steps.map((step) => (
          <li
            className="flex min-w-0 flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            data-step={step.key}
            key={step.key}
          >
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                  step.done ? "border-pine bg-pine text-white" : "border-ink/25 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {step.label}
                  {step.optional ? <span className="ml-2 text-xs font-normal text-ink-faint">可跳過</span> : null}
                  <span className="sr-only">{step.done ? "（已完成）" : "（還沒完成）"}</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{step.message}</p>
              </div>
            </div>
            {step.done ? (
              <span className="shrink-0 text-sm font-medium text-pine sm:pl-3">已完成</span>
            ) : (
              <Link
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                href={step.href}
              >
                {step.actionLabel}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="text-sm leading-6 text-ink-soft">
        除了自己開課，也可以回應團主發起的團體課需求。
        <Link className="ml-1 font-medium text-pine underline underline-offset-4" href="/teacher/demands">
          看看團體需求
        </Link>
      </p>
    </section>
  );
}
