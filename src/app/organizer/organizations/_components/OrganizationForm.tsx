"use client";

import { useActionState } from "react";

import { ORGANIZATION_TYPE_OPTIONS } from "@/domain/organizer-profile/organization-type-labels";

import type { OrganizerFormState } from "../../profile/actions";
import {
  OrganizerField,
  organizerInputClassName,
  organizerInputMissingClassName,
} from "../../profile/_components/organizer-fields";
import { saveOrganizationAction } from "../actions";

type OrganizationFormValues = {
  name: string;
  type: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

// organizer-usability-redesign 票 03：新增與編輯團體共用的表單。
// 名稱與類型必填；聯絡資料可以先留空，送出需求或合作邀請前才需要補齊，缺的欄位用陶土色標出。
export function OrganizationForm({
  organizationId,
  initialValues,
  returnTo,
  submitLabel,
}: {
  organizationId: string | null;
  initialValues: OrganizationFormValues;
  returnTo: string | null;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<OrganizerFormState, FormData>(
    saveOrganizationAction,
    { status: "idle", message: null, values: {} },
  );

  // 驗證失敗時用使用者剛送出的值，不退回資料庫裡的舊值。
  const values: OrganizationFormValues =
    state.status === "error"
      ? { ...initialValues, ...(state.values as Partial<OrganizationFormValues>) }
      : initialValues;
  const contactClassName = (value: string) =>
    value.trim().length === 0 ? organizerInputMissingClassName : organizerInputClassName;

  return (
    <form action={formAction} className="grid gap-6">
      {organizationId ? (
        <input name="organizationId" type="hidden" value={organizationId} />
      ) : null}
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}

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
        <legend className="text-base font-semibold text-ink">團體資料</legend>
        <OrganizerField
          hint="你所代表的公司、社團、社區或親友揪團名稱。"
          label="組織名稱"
        >
          <input
            className={organizerInputClassName}
            defaultValue={values.name}
            name="name"
            placeholder="例如：陽光科技股份有限公司"
            required
            type="text"
          />
        </OrganizerField>
        <OrganizerField hint="幫助平台理解這個團體的性質。" label="組織類型">
          {/* 失敗回傳後 React 會 reset 表單，而已掛載的 select 不會套用新的 defaultValue；
              用 key 讓它依回傳值重新掛載，保留使用者剛選的類型。 */}
          <select
            className={organizerInputClassName}
            defaultValue={values.type}
            key={`type-${state.status}-${values.type}`}
            name="type"
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
          可以先留空；用這個團體送出需求或合作邀請前，需要補齊這三項。
        </p>
        <OrganizerField label="聯絡窗口姓名">
          <input
            className={contactClassName(values.contactName)}
            defaultValue={values.contactName}
            name="contactName"
            placeholder="例如：王小明"
            type="text"
          />
        </OrganizerField>
        <OrganizerField label="聯絡信箱">
          <input
            className={contactClassName(values.contactEmail)}
            defaultValue={values.contactEmail}
            name="contactEmail"
            placeholder="例如：organizer@example.com"
            type="email"
          />
        </OrganizerField>
        <OrganizerField label="聯絡電話">
          <input
            className={contactClassName(values.contactPhone)}
            defaultValue={values.contactPhone}
            name="contactPhone"
            placeholder="例如：0912-345-678"
            type="tel"
          />
        </OrganizerField>
      </fieldset>

      <button
        className="w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep disabled:opacity-60 sm:w-auto sm:justify-self-start"
        disabled={isPending}
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
