"use client";

import { useActionState } from "react";

import { saveOrganizerProfileAction, type OrganizerFormState } from "../actions";
import { OrganizerField, organizerInputClassName } from "./organizer-fields";

// organizer-usability-redesign 票 03：團主資料頁只編輯團主本人的顯示名稱；
// 失敗時留在原頁並保留輸入，成功時在原地顯示已儲存。
export function OrganizerNameForm({ displayName }: { displayName: string }) {
  const [state, formAction, isPending] = useActionState<OrganizerFormState, FormData>(
    saveOrganizerProfileAction,
    { status: "idle", message: null, values: {} },
  );
  const value = state.status === "error" ? state.values.displayName ?? displayName : displayName;

  return (
    <form action={formAction} className="grid gap-4">
      {state.message ? (
        <p
          aria-live="polite"
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <OrganizerField
        hint="讓老師與平台知道怎麼稱呼你或你的團隊窗口。"
        label="團主顯示名稱"
      >
        <input
          className={organizerInputClassName}
          defaultValue={value}
          name="displayName"
          required
          type="text"
        />
      </OrganizerField>

      <button
        className="w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep disabled:opacity-60 sm:w-auto sm:justify-self-start"
        disabled={isPending}
        type="submit"
      >
        儲存
      </button>
    </form>
  );
}
