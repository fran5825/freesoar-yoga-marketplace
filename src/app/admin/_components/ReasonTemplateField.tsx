"use client";

import { useState } from "react";

export type ReasonTemplate = { label: string; text: string };

// admin-usability 票 05：退回原因輸入框，上方附幾個常用原因，點一下帶入輸入框，帶入後仍可修改。
// 範本只是幫忙填字，送出的仍是輸入框裡的最終文字，驗證規則（長度）由呼叫端傳進來、伺服器端照舊再驗一次。
export function ReasonTemplateField({
  id,
  name,
  label,
  hint,
  placeholder,
  templates,
  minLength,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  templates: ReasonTemplate[];
  minLength: number;
  maxLength: number;
}) {
  const [value, setValue] = useState("");

  return (
    <div>
      <label className="text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p>
      {templates.length > 0 ? (
        <div aria-label="常用原因" className="mt-2 flex flex-wrap gap-2" role="group">
          {templates.map((template) => (
            <button
              className="rounded-full border border-ink/25 px-3 py-1 text-xs text-ink-soft transition hover:border-ink/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              key={template.label}
              onClick={() => setValue(template.text)}
              type="button"
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
        id={id}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        required
        value={value}
      />
      <p className="mt-1 text-xs text-ink-faint">
        已輸入 {value.trim().length} 字（{minLength}–{maxLength} 字）
      </p>
    </div>
  );
}
