"use client";

import { useActionState, useState } from "react";

import { ORGANIZATION_TYPE_OPTIONS } from "@/domain/organizer-profile/organization-type-labels";

import { createOrganizerProfileAction, type OrganizerFormState } from "../actions";
import { OrganizerField, organizerInputClassName } from "./organizer-fields";

// 票 04：一頁式團主註冊。信箱與姓名預填登入資料；「團主顯示名稱」與「聯絡窗口姓名」
// 多半是同一個人，所以預設同步，使用者手動改過聯絡窗口姓名後就不再跟著變。
export function OrganizerSignupForm({
  defaultName,
  defaultEmail,
  next,
}: {
  defaultName: string;
  defaultEmail: string;
  next: string | null;
}) {
  const [state, formAction, isPending] = useActionState<OrganizerFormState, FormData>(
    createOrganizerProfileAction,
    { status: "idle", message: null, values: {} },
  );
  const [displayName, setDisplayName] = useState(defaultName);
  const [contactName, setContactName] = useState(defaultName);
  const [isContactNameEdited, setIsContactNameEdited] = useState(false);
  // 票 03：伺服器驗證失敗時留在原頁，未受控欄位用回傳的值當預設值，不清空使用者的輸入。
  const values = state.values;

  return (
    <form action={formAction} className="grid gap-6">
      {next ? <input name="next" type="hidden" value={next} /> : null}

      {state.status === "error" && state.message ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <fieldset className="grid gap-4">
        <legend className="text-base font-semibold text-ink">你是誰</legend>
        <OrganizerField
          hint="讓老師與平台知道怎麼稱呼你或你的團隊窗口。"
          label="團主顯示名稱"
        >
          <input
            className={organizerInputClassName}
            name="displayName"
            onChange={(event) => {
              setDisplayName(event.target.value);

              if (!isContactNameEdited) {
                setContactName(event.target.value);
              }
            }}
            placeholder="例如：王小明"
            required
            type="text"
            value={displayName}
          />
        </OrganizerField>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="text-base font-semibold text-ink">
          你代表的團體
        </legend>
        <OrganizerField
          hint="你所代表的公司、社團、社區或親友揪團名稱。"
          label="組織名稱"
        >
          <input
            className={organizerInputClassName}
            defaultValue={values.organizationName ?? ""}
            name="organizationName"
            placeholder="例如：陽光科技股份有限公司"
            required
            type="text"
          />
        </OrganizerField>
        <OrganizerField hint="幫助平台理解這個團體的性質。" label="組織類型">
          <select
            className={organizerInputClassName}
            defaultValue={values.organizationType ?? ""}
            key={`organizationType-${values.organizationType ?? ""}`}
            name="organizationType"
            required
          >
            <option disabled value="">
              請選擇組織類型
            </option>
            {ORGANIZATION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </OrganizerField>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="text-base font-semibold text-ink">聯絡方式</legend>
        <p className="-mt-2 text-xs leading-5 text-ink-soft">
          送出需求審核時，平台會用這些方式聯絡你；現在填好就不用之後再補。
        </p>
        <OrganizerField label="聯絡窗口姓名">
          <input
            className={organizerInputClassName}
            name="contactName"
            onChange={(event) => {
              setContactName(event.target.value);
              setIsContactNameEdited(true);
            }}
            placeholder="例如：王小明"
            required
            type="text"
            value={contactName}
          />
        </OrganizerField>
        <OrganizerField label="聯絡信箱">
          <input
            className={organizerInputClassName}
            defaultValue={values.contactEmail ?? defaultEmail}
            name="contactEmail"
            placeholder="例如：organizer@example.com"
            required
            type="email"
          />
        </OrganizerField>
        <OrganizerField label="聯絡電話">
          <input
            className={organizerInputClassName}
            defaultValue={values.contactPhone ?? ""}
            name="contactPhone"
            placeholder="例如：0912-345-678"
            required
            type="tel"
          />
        </OrganizerField>
      </fieldset>

      <button
        className="w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep disabled:opacity-60 sm:w-auto sm:justify-self-start"
        disabled={isPending}
        type="submit"
      >
        建立團主資料並開始整理需求
      </button>
    </form>
  );
}
