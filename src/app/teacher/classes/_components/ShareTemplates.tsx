"use client";

import { useState, useSyncExternalStore } from "react";

import { ENROLL_URL_PLACEHOLDER } from "@/domain/class-session/share-templates";

// teacher-showcase-photos 票 08：可複製的分享文案（招募公告、課前提醒、課後感謝）。
// 文案由 domain 依課程資料套模板產生（不呼叫 AI）；報名連結的網域只有瀏覽器知道，這裡才換成完整網址。
// 老師可以直接複製，也可以先在文字框裡改幾個字再複製。
type Template = { key: string; label: string; text: string };

const subscribeNothing = () => () => {};
const readOrigin = () => window.location.origin;
const serverOrigin = () => "";

export function ShareTemplates({ templates, enrollPath }: { templates: Template[]; enrollPath: string }) {
  const origin = useSyncExternalStore(subscribeNothing, readOrigin, serverOrigin);
  const link = `${origin}${enrollPath}`;

  return (
    <div className="grid gap-3">
      {templates.map((template) => (
        <TemplateCard key={template.key} label={template.label} text={template.text.replaceAll(ENROLL_URL_PLACEHOLDER, link)} />
      ))}
    </div>
  );
}

function TemplateCard({ label, text }: { label: string; text: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  // 老師有改過文字就用改過的；沒改就跟著最新的模板（例如網域在 hydration 後才確定）。
  const value = draft ?? text;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <details className="rounded-xl border border-ink/15 bg-white px-4 py-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">{label}</summary>
      <div className="grid gap-2 pb-3">
        <label className="sr-only" htmlFor={`share-${label}`}>
          {label}
        </label>
        <textarea
          className="min-h-48 w-full rounded-xl border border-ink/25 bg-cream px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-pine focus:ring-2 focus:ring-pine/15"
          id={`share-${label}`}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus("idle");
          }}
          value={value}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="min-h-11 rounded-full border border-pine/40 bg-white px-4 py-2 text-sm font-medium text-pine transition hover:bg-pine-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            onClick={copy}
            type="button"
          >
            {status === "copied" ? "已複製" : "複製文字"}
          </button>
          <p aria-live="polite" className="text-xs leading-5 text-ink-soft">
            {status === "copied" ? "已複製，可以貼到 LINE 或 IG。" : null}
            {status === "failed" ? "無法自動複製，請在文字框裡全選後手動複製。" : null}
          </p>
        </div>
      </div>
    </details>
  );
}
