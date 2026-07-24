"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import type { DemandRequestFormInput } from "@/domain/demand-request/input";
import {
  FREQUENCIES,
  PREFERRED_TIME_SLOTS,
  SERVICE_TYPES,
  TARGET_LEVELS,
} from "@/domain/demand-request/service-types";
import type {
  DemandRequestDraftSaveErrorCode,
  DemandRequestSubmitErrorCode,
} from "@/domain/demand-request/service";
import type { DemandRequestValidationError } from "@/domain/demand-request/validation";

export type DemandRequestFormValues = {
  title: string;
  serviceType: string;
  description: string;
  targetLevel: string;
  expectedParticipants: string;
  preferredAreas: string;
  preferredTimeSlots: string[];
  classLengthMinutes: string;
  frequency: string;
  preferredStartDate: string;
  budgetRange: string;
};

export type DemandRequestActionSnapshot = {
  id: string;
};

export type SaveDemandRequestDraftActionResult =
  | {
      ok: true;
      demandRequest: DemandRequestActionSnapshot;
    }
  | {
      ok: false;
      code: DemandRequestDraftSaveErrorCode;
      message: string;
      validationErrors?: DemandRequestValidationError[];
    };

export type SubmitDemandRequestActionResult =
  | {
      ok: true;
      demandRequest: DemandRequestActionSnapshot;
    }
  | {
      ok: false;
      code: DemandRequestSubmitErrorCode;
      message: string;
      validationErrors?: DemandRequestValidationError[];
    };

type DemandRequestFormProps = {
  initialDemandRequestId: string | null;
  initialValues: DemandRequestFormValues;
  onSaveDraft: (
    input: DemandRequestFormInput,
    demandRequestId?: string,
  ) => Promise<SaveDemandRequestDraftActionResult>;
  onSubmit: (
    input: DemandRequestFormInput,
    demandRequestId?: string,
  ) => Promise<SubmitDemandRequestActionResult>;
};

const serviceTypeLabels: Record<string, string> = {
  "Hatha Yoga": "哈達瑜伽",
  "Yin Yoga": "陰瑜伽",
  "Stretch Yoga": "伸展瑜伽",
  Breathwork: "呼吸練習",
  "Corporate Relaxation Yoga": "企業放鬆瑜伽",
  "Beginner Yoga": "初學瑜伽",
  "Parent-child Yoga": "親子瑜伽",
};

const targetLevelLabels: Record<string, string> = {
  beginner: "初學",
  general: "一般",
  advanced: "進階",
  mixed: "混合程度",
};

const frequencyLabels: Record<string, string> = {
  single: "單堂",
  weekly: "每週",
  biweekly: "雙週",
  monthly: "每月",
};

function toFormInput(values: DemandRequestFormValues): DemandRequestFormInput {
  return {
    ...values,
    preferredTimeSlots: values.preferredTimeSlots.join(","),
  };
}

function getDraftSaveErrorMessage(
  result: Extract<SaveDemandRequestDraftActionResult, { ok: false }>,
): string {
  switch (result.code) {
    case "authentication_required":
      return "請先登入後再儲存需求草稿。";
    case "organizer_profile_required":
      return "請先建立團主資料，才能建立需求草稿。";
    case "draft_validation_failed":
      return "有些草稿資料格式需要調整後才能儲存。";
    case "demand_request_not_found":
      return "找不到這筆需求草稿，或目前狀態不允許編輯。";
    case "draft_save_failed":
      return "需求草稿暫時無法儲存，請稍後再試。";
  }
}

function getSubmitErrorMessage(
  result: Extract<SubmitDemandRequestActionResult, { ok: false }>,
): string {
  switch (result.code) {
    case "authentication_required":
      return "請先登入後再送出需求。";
    case "organizer_profile_required":
      return "請先建立團主資料，才能送出需求。";
    case "demand_request_not_found":
      return "找不到這筆需求，或您沒有權限操作。";
    case "organization_contact_incomplete":
      return "請先至團主資料頁補齊組織聯絡資訊，才能送出需求。";
    case "submit_validation_failed":
      return "送出前，請先補齊以下必填欄位。";
    case "submitted_demand_cannot_resubmit":
      return "此需求已送出審核中，不能重複送出。";
    case "published_demand_cannot_resubmit":
      return "此需求已公開，不能重複送出。";
    case "rejected_demand_is_terminal":
      return "此需求已被退回，請建立新的需求重新提出。";
    case "demand_not_in_draft":
      return "此需求目前狀態不允許送出，請重新整理後確認狀態。";
    case "demand_request_submit_failed":
      return "需求暫時無法送出，請稍後再試。";
  }
}

export function DemandRequestForm({
  initialDemandRequestId,
  initialValues,
  onSaveDraft,
  onSubmit,
}: DemandRequestFormProps) {
  const [demandRequestId, setDemandRequestId] = useState(
    initialDemandRequestId,
  );
  const [formValues, setFormValues] =
    useState<DemandRequestFormValues>(initialValues);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState<{
    kind: "success" | "error";
    message: string;
    validationErrors?: DemandRequestValidationError[];
  } | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<{
    kind: "success" | "error";
    message: string;
    validationErrors?: DemandRequestValidationError[];
  } | null>(null);

  const isLocked = isSubmitted;

  function updateField<K extends keyof DemandRequestFormValues>(
    field: K,
    value: DemandRequestFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setIsConfirmingSubmit(false);
  }

  function toggleTimeSlot(slot: string) {
    setFormValues((current) => {
      const isSelected = current.preferredTimeSlots.includes(slot);

      return {
        ...current,
        preferredTimeSlots: isSelected
          ? current.preferredTimeSlots.filter((value) => value !== slot)
          : [...current.preferredTimeSlots, slot],
      };
    });
    setIsConfirmingSubmit(false);
  }

  async function handleSaveDraft() {
    if (isSavingDraft || isSubmitting || isLocked) {
      return;
    }

    setIsSavingDraft(true);
    setDraftFeedback(null);

    try {
      const result = await onSaveDraft(
        toFormInput(formValues),
        demandRequestId ?? undefined,
      );

      if (result.ok) {
        setDemandRequestId(result.demandRequest.id);
        setDraftFeedback({ kind: "success", message: "草稿已儲存。" });
        return;
      }

      setDraftFeedback({
        kind: "error",
        message: getDraftSaveErrorMessage(result),
        validationErrors: result.validationErrors,
      });
    } catch {
      setDraftFeedback({
        kind: "error",
        message: "需求草稿暫時無法儲存，請稍後再試。",
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleOpenSubmitConfirmation() {
    if (isSubmitting || isLocked) {
      return;
    }

    setSubmitFeedback(null);
    setIsConfirmingSubmit(true);
  }

  function handleCancelSubmitConfirmation() {
    if (isSubmitting) {
      return;
    }

    setIsConfirmingSubmit(false);
  }

  async function handleSubmit() {
    if (isSubmitting || isLocked) {
      return;
    }

    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const result = await onSubmit(
        toFormInput(formValues),
        demandRequestId ?? undefined,
      );

      if (result.ok) {
        setDemandRequestId(result.demandRequest.id);
        setIsSubmitted(true);
        setIsConfirmingSubmit(false);
        setDraftFeedback(null);
        setSubmitFeedback({
          kind: "success",
          message: "需求已收到，待平台審核後才會公開給合適的老師。",
        });
        return;
      }

      setSubmitFeedback({
        kind: "error",
        message: getSubmitErrorMessage(result),
        validationErrors: result.validationErrors,
      });
    } catch {
      setSubmitFeedback({
        kind: "error",
        message: "需求暫時無法送出，請稍後再試。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <FieldSet legend="團體與課程需求">
        <TextField
          disabled={isLocked}
          hint="用一句話說明這次需求，例如對象與主要目的（5–100 字）。"
          label="需求標題"
          maxLength={100}
          onChange={(value) => updateField("title", value)}
          placeholder="例如：週三晚間員工紓壓瑜伽課"
          value={formValues.title}
        />
        <SelectField
          disabled={isLocked}
          hint="請選擇最貼近需求的課程類型。"
          label="服務類型"
          onChange={(value) => updateField("serviceType", value)}
          options={SERVICE_TYPES.map((value) => ({
            value,
            label: serviceTypeLabels[value] ?? value,
          }))}
          value={formValues.serviceType}
        />
        <TextAreaField
          disabled={isLocked}
          hint="說明上課對象、目的與希望呈現的課程樣貌（20–2000 字）。"
          label="需求說明"
          onChange={(value) => updateField("description", value)}
          placeholder="例如：希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。"
          value={formValues.description}
        />
        <SelectField
          disabled={isLocked}
          hint="讓老師理解課程適合的程度。"
          label="適合對象"
          onChange={(value) => updateField("targetLevel", value)}
          options={TARGET_LEVELS.map((value) => ({
            value,
            label: targetLevelLabels[value] ?? value,
          }))}
          value={formValues.targetLevel}
        />
        <TextField
          disabled={isLocked}
          hint="預計參與人數（1–500 人）。"
          inputMode="numeric"
          label="預計參與人數"
          onChange={(value) => updateField("expectedParticipants", value)}
          placeholder="例如：15"
          type="number"
          value={formValues.expectedParticipants}
        />
      </FieldSet>

      <FieldSet legend="時間與地點">
        <TextAreaField
          disabled={isLocked}
          hint="可用逗號或換行分隔多個地區，最多 10 項，每項最多 50 字。"
          label="期望地區"
          onChange={(value) => updateField("preferredAreas", value)}
          placeholder="例如：台北市信義區、線上團課"
          value={formValues.preferredAreas}
        />

        <div>
          <span className="text-sm font-medium text-gray-950">期望時段</span>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            可複選，至少選擇一項。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PREFERRED_TIME_SLOTS.map((slot) => (
              <label
                className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                key={slot}
              >
                <input
                  checked={formValues.preferredTimeSlots.includes(slot)}
                  disabled={isLocked}
                  onChange={() => toggleTimeSlot(slot)}
                  type="checkbox"
                />
                {slot}
              </label>
            ))}
          </div>
        </div>

        <TextField
          disabled={isLocked}
          hint="單堂課程長度（30–240 分鐘）。"
          inputMode="numeric"
          label="單堂課程長度（分鐘）"
          onChange={(value) => updateField("classLengthMinutes", value)}
          placeholder="例如：60"
          type="number"
          value={formValues.classLengthMinutes}
        />
        <SelectField
          disabled={isLocked}
          hint="這次需求希望的上課頻率。"
          label="上課頻率"
          onChange={(value) => updateField("frequency", value)}
          options={FREQUENCIES.map((value) => ({
            value,
            label: frequencyLabels[value] ?? value,
          }))}
          value={formValues.frequency}
        />
        <TextField
          disabled={isLocked}
          hint="建議填寫，非必填；若填寫請選擇今天以後的日期。"
          label="期望開課日期"
          onChange={(value) => updateField("preferredStartDate", value)}
          type="date"
          value={formValues.preferredStartDate}
        />
      </FieldSet>

      <FieldSet legend="預算備註">
        <TextField
          disabled={isLocked}
          hint="建議填寫，非必填；僅作為溝通參考，不作低價比較。"
          label="預算參考"
          onChange={(value) => updateField("budgetRange", value)}
          placeholder="例如：依人數與時數討論"
          value={formValues.budgetRange}
        />
      </FieldSet>

      <div className="grid gap-4 rounded border border-gray-200 bg-white p-5">
        <div aria-live="polite">
          {draftFeedback ? (
            <FeedbackBanner
              kind={draftFeedback.kind}
              message={draftFeedback.message}
              validationErrors={draftFeedback.validationErrors}
            />
          ) : null}

          {submitFeedback ? (
            <FeedbackBanner
              kind={submitFeedback.kind}
              message={submitFeedback.message}
              validationErrors={submitFeedback.validationErrors}
            />
          ) : null}
        </div>

        {isConfirmingSubmit ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <p className="font-medium text-gray-950">確認送出需求</p>
            <p className="mt-2">
              送出後，這筆需求會進入平台審核；審核通過前不會公開給老師。請確認內容已準備好，再送出。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                disabled={isSubmitting}
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting ? "正在送出..." : "確認送出"}
              </button>
              <button
                className="rounded border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:text-gray-500"
                disabled={isSubmitting}
                onClick={handleCancelSubmitConfirmation}
                type="button"
              >
                先回來調整
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="w-full rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
            disabled={isSavingDraft || isSubmitting || isLocked}
            onClick={handleSaveDraft}
            type="button"
          >
            {isLocked
              ? "已送出審核"
              : isSavingDraft
                ? "正在儲存..."
                : "儲存草稿"}
          </button>
          <button
            className="w-full rounded border border-sky-700 bg-sky-700 px-5 py-3 text-center text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 sm:w-auto"
            disabled={isSubmitting || isLocked}
            onClick={handleOpenSubmitConfirmation}
            type="button"
          >
            {isLocked
              ? "已送出審核"
              : isSubmitting
                ? "正在送出..."
                : "送出審核"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackBanner({
  kind,
  message,
  validationErrors,
}: {
  kind: "success" | "error";
  message: string;
  validationErrors?: DemandRequestValidationError[];
}) {
  return (
    <div
      className={
        kind === "success"
          ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
          : "rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
      }
    >
      <p>{message}</p>
      {validationErrors && validationErrors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {validationErrors.map((error) => (
            <li key={`${error.field}-${error.code}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FieldSet({
  legend,
  children,
}: {
  legend: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-4 rounded border border-gray-200 bg-white p-5">
      <legend className="px-1 text-lg font-medium text-gray-950">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  disabled,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric";
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-950">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-gray-600">{hint}</p>
      ) : null}
      <input
        className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-gray-50"
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-950">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-gray-600">{hint}</p>
      ) : null}
      <textarea
        className="mt-2 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-gray-50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-950">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-gray-600">{hint}</p>
      ) : null}
      <select
        className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-gray-50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">請選擇</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
