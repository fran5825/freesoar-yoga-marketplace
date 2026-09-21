"use client";

import { useEffect, useMemo, useState } from "react";

import { TagCheckbox } from "@/app/_components/tag-checkbox";

import {
  applicationSections,
  buildCheckboxGroupValue,
  fieldLabels,
  parseCheckboxGroupValue,
  requiredFields,
  type FormFieldName,
  type TextField,
} from "../_lib/application-fields";
import {
  getInitialTeacherProfileApplicationSnapshotAction,
  saveTeacherProfileDraftAction,
  submitTeacherProfileApplicationAction,
  type TeacherProfileApplicationSnapshotActionProfile,
  type TeacherProfileDraftSaveActionResult,
  type TeacherProfileSubmitActionResult,
} from "../actions";

type TeacherApplicationFormState = {
  displayName: string;
  bio: string;
  teachingStyle: string;
  experienceYears: string;
  certifications: string;
  specialties: string;
  serviceAreas: string;
  teachingFormats: string;
  priceRange: string;
  profilePhotoUrl: string;
  preferredSessionLengthMinutes: string;
  preferredFrequency: string;
  preferredLocationType: string;
  preferenceNotes: string;
};

const optionalFieldNames = applicationSections
  .flatMap((section) => section.fields)
  .filter((field) => field.requirement === "optionalRecommended")
  .map((field) => field.name);

type HydratedTeacherProfileStatus =
  TeacherProfileApplicationSnapshotActionProfile["status"];

type DraftSaveFeedback = {
  kind: "success" | "error";
  message: string;
  result?: Extract<TeacherProfileDraftSaveActionResult, { ok: false }>;
  showSignInLink?: boolean;
};

type SubmitFeedback = {
  kind: "success" | "error";
  message: string;
  result?: Extract<TeacherProfileSubmitActionResult, { ok: false }>;
  showSignInLink?: boolean;
};

// teacher-join-gated-application Slice 3（G3）：帶上 callbackUrl，讓登入完成後導回
// 這一頁，而不是掉回 /sign-in 沒帶 callbackUrl 時的既有預設值 /account。
const signInHref = `/sign-in?callbackUrl=${encodeURIComponent("/teachers/join")}`;

const collaborationPrinciples = [
  "尊重老師的時間安排與教學界線。",
  "讓團主的需求被清楚整理，老師能被正確理解，回應真正適合自己的團課機會。",
  "透過審核與清楚流程，守住課程品質與平台信任。",
];

const draftSaveRequestTimeoutMs = 10000;

const initialFormState: TeacherApplicationFormState = {
  displayName: "",
  bio: "",
  teachingStyle: "",
  experienceYears: "",
  certifications: "",
  specialties: "",
  serviceAreas: "",
  teachingFormats: "",
  priceRange: "",
  profilePhotoUrl: "",
  preferredSessionLengthMinutes: "",
  preferredFrequency: "",
  preferredLocationType: "",
  preferenceNotes: "",
};

const mutationBlockedStatusLabels: Record<
  Exclude<HydratedTeacherProfileStatus, "draft" | "rejected">,
  {
    notice: string;
    saveButton: string;
    submitButton: string;
  }
> = {
  submitted: {
    notice:
      "已送出審核，接下來會等待平台確認。審核期間暫時不需要再儲存草稿或重複送出。",
    saveButton: "已送出審核",
    submitButton: "已送出審核",
  },
  approved: {
    notice:
      "老師資料已通過審核，後續資料調整會走正式編輯流程。此加入表單暫時不開放更新或重新送出。",
    saveButton: "已通過審核",
    submitButton: "已通過審核",
  },
  suspended: {
    notice:
      "帳號目前暫停中，暫時不能更新或送出老師申請。若需要協助，請聯繫平台管理者。",
    saveButton: "帳號暫停中",
    submitButton: "帳號暫停中",
  },
};

function isBlank(value: string) {
  return value.trim().length === 0;
}

function hasExperienceYears(value: string) {
  if (isBlank(value)) {
    return false;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0;
}

function getMissingRequiredFields(formState: TeacherApplicationFormState) {
  return requiredFields.filter((fieldName) => {
    if (fieldName === "experienceYears") {
      return !hasExperienceYears(formState.experienceYears);
    }

    return isBlank(formState[fieldName]);
  });
}

function getReadinessMessage(fieldName: FormFieldName) {
  if (fieldName === "experienceYears") {
    return "請補上 0 或以上的教學年資，讓平台理解你的團課經驗階段。";
  }

  if (
    fieldName === "specialties" ||
    fieldName === "serviceAreas" ||
    fieldName === "teachingFormats"
  ) {
    return `請在「${fieldLabels[fieldName]}」至少補上一項，方便後續判斷適合的團課需求。`;
  }

  return `請補上「${fieldLabels[fieldName]}」，讓申請內容更完整、也更容易被理解。`;
}

function getDraftSaveErrorMessage(
  result: Extract<TeacherProfileDraftSaveActionResult, { ok: false }>,
) {
  switch (result.code) {
    case "authentication_required":
      return "請先登入後再儲存草稿。登入後，你可以回到這裡繼續整理老師申請資料。";
    case "draft_validation_failed":
      return "有些草稿資料格式需要調整後才能儲存。請依提示慢慢修正即可。";
    case "submitted_profile_cannot_save_draft":
      return "你的申請已送審，目前先不開放修改草稿。我們會在審核流程中提供下一步說明。";
    case "approved_profile_cannot_save_draft":
      return "你的老師資料已通過審核，後續會走正式資料編輯流程。";
    case "suspended_profile_cannot_save_draft":
      return "此帳號目前暫時無法儲存老師申請草稿。若需要協助，請聯繫平台管理者。";
    case "draft_save_failed":
      return "草稿暫時無法儲存，請稍後再試。你目前畫面中的內容仍會保留。";
  }
}

function getSubmitErrorMessage(
  result: Extract<TeacherProfileSubmitActionResult, { ok: false }>,
) {
  switch (result.code) {
    case "authentication_required":
      return "請先登入後再送出老師申請。登入後，你可以回到這裡確認內容並送出審核。";
    case "teacher_profile_draft_required":
      return "請先儲存老師申請草稿，再送出審核。這能讓平台確認你的申請資料已建立。";
    case "submit_validation_failed":
      return "送出審核前，還需要補齊以下欄位。你可以慢慢調整，畫面中的內容會保留。";
    case "submitted_profile_cannot_submit_again":
      return "老師申請已送審，不能重複送出。接下來請等待平台確認。";
    case "approved_profile_cannot_submit_again":
      return "你的老師資料已通過審核，不需要重新送出申請。後續資料調整會走正式編輯流程。";
    case "suspended_profile_cannot_submit":
      return "此帳號目前暫時無法送出老師申請。若需要協助，請聯繫平台管理者。";
    case "teacher_profile_submit_failed":
      return "老師申請暫時無法送出，請稍後再試。你目前畫面中的內容仍會保留。";
  }
}

function formatLastSavedAt(value: string) {
  const savedAt = new Date(value);

  if (Number.isNaN(savedAt.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(savedAt);
}

function createDraftSaveTimeout() {
  return new Promise<"timeout">((resolve) => {
    window.setTimeout(() => resolve("timeout"), draftSaveRequestTimeoutMs);
  });
}

function toTeacherApplicationFormState(
  profile: TeacherProfileApplicationSnapshotActionProfile,
): TeacherApplicationFormState {
  return {
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    teachingStyle: profile.teachingStyle ?? "",
    experienceYears:
      typeof profile.experienceYears === "number"
        ? String(profile.experienceYears)
        : "",
    certifications: profile.certifications.join("\n"),
    specialties: profile.specialties.join("\n"),
    serviceAreas: profile.serviceAreas.join("\n"),
    teachingFormats: profile.teachingFormats.join("\n"),
    priceRange: profile.priceRange ?? "",
    profilePhotoUrl: profile.profilePhotoUrl ?? "",
    preferredSessionLengthMinutes:
      typeof profile.preferredSessionLengthMinutes === "number"
        ? String(profile.preferredSessionLengthMinutes)
        : "",
    preferredFrequency: profile.preferredFrequency ?? "",
    preferredLocationType: profile.preferredLocationType ?? "",
    preferenceNotes: profile.preferenceNotes ?? "",
  };
}

function RequirementBadge({
  requirement,
}: {
  requirement: TextField["requirement"];
}) {
  if (requirement === "submitRequired") {
    return (
      <span className="rounded-full bg-sage px-3 py-1 text-xs font-medium text-pine">
        送審必填
      </span>
    );
  }

  return (
    <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-clay">
      建議，可留空
    </span>
  );
}

const controlClassName =
  "mt-3 w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:cursor-not-allowed disabled:bg-[#efece4] disabled:text-ink-soft";

function FieldControl({
  field,
  value,
  onChange,
  disabled,
  inputId,
  showReminder,
}: {
  field: TextField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  inputId: string;
  showReminder: boolean;
}) {
  const describedBy = showReminder ? `${inputId}-reminder` : undefined;

  if (field.kind === "textarea") {
    return (
      <textarea
        aria-describedby={describedBy}
        className={`${controlClassName} min-h-28`}
        disabled={disabled}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        value={value}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <select
        aria-describedby={describedBy}
        className={controlClassName}
        disabled={disabled}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">請選擇</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === "checkboxGroup") {
    const { selectedValues, otherText } = parseCheckboxGroupValue(
      value,
      field.groups,
    );
    const flatOptions = field.groups.flatMap((group) => group.options);

    function toggleOption(optionValue: string) {
      const nextSelected = selectedValues.includes(optionValue)
        ? selectedValues.filter((item) => item !== optionValue)
        : [...selectedValues, optionValue];
      onChange(buildCheckboxGroupValue(nextSelected, otherText));
    }

    return (
      <div aria-describedby={describedBy} className="mt-3 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {flatOptions.map((option) => (
            <TagCheckbox
              checked={selectedValues.includes(option.value)}
              disabled={disabled}
              key={option.value}
              label={option.label}
              onChange={() => toggleOption(option.value)}
            />
          ))}
        </div>
        <input
          className={controlClassName}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              buildCheckboxGroupValue(selectedValues, event.target.value),
            )
          }
          placeholder={field.otherPlaceholder}
          value={otherText}
        />
      </div>
    );
  }

  return (
    <input
      aria-describedby={describedBy}
      className={controlClassName}
      disabled={disabled}
      id={inputId}
      inputMode={field.inputMode}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      type="text"
      value={value}
    />
  );
}

export function TeacherApplicationForm() {
  const [formState, setFormState] =
    useState<TeacherApplicationFormState>(initialFormState);
  const [hasCheckedReadiness, setHasCheckedReadiness] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveFeedback, setDraftSaveFeedback] =
    useState<DraftSaveFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(
    null,
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hydratedProfileStatus, setHydratedProfileStatus] =
    useState<HydratedTeacherProfileStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateOwnTeacherProfile() {
      const profile =
        await getInitialTeacherProfileApplicationSnapshotAction();

      if (!isMounted || !profile) {
        return;
      }

      setFormState(toTeacherApplicationFormState(profile));
      setHydratedProfileStatus(profile.status);
      setRejectionReason(profile.rejectionReason);
      setLastSavedAt(profile.updatedAt);
    }

    void hydrateOwnTeacherProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const missingRequiredFields = useMemo(
    () => getMissingRequiredFields(formState),
    [formState],
  );
  const missingRequiredFieldSet = useMemo(
    () => new Set<FormFieldName>(missingRequiredFields),
    [missingRequiredFields],
  );
  const optionalFieldsWithValue = useMemo(
    () =>
      optionalFieldNames.filter((fieldName) => !isBlank(formState[fieldName]))
        .length,
    [formState],
  );
  const isReadyForFutureSubmit = missingRequiredFields.length === 0;
  const lastSavedAtLabel = lastSavedAt ? formatLastSavedAt(lastSavedAt) : null;
  const isRejectedProfile = hydratedProfileStatus === "rejected";
  const mutationBlockedStatus =
    hydratedProfileStatus &&
    hydratedProfileStatus !== "draft" &&
    hydratedProfileStatus !== "rejected"
      ? hydratedProfileStatus
      : null;
  const mutationBlockedCopy = mutationBlockedStatus
    ? mutationBlockedStatusLabels[mutationBlockedStatus]
    : null;
  const isDraftSaveDisabled =
    isSavingDraft || isSubmitting || mutationBlockedStatus !== null;
  const isSubmitDisabled =
    isSubmitting || mutationBlockedStatus !== null || !isReadyForFutureSubmit;
  const statusBadge = mutationBlockedCopy
    ? {
        label: mutationBlockedCopy.saveButton,
        className:
          mutationBlockedStatus === "approved"
            ? "bg-emerald-100 text-emerald-800"
            : mutationBlockedStatus === "suspended"
              ? "bg-ink/10 text-ink-soft"
              : "bg-amber-100 text-amber-800",
      }
    : isRejectedProfile
      ? { label: "已退回，待修正", className: "bg-clay-tint text-clay-deep" }
      : { label: "草稿", className: "bg-sage text-pine" };

  function updateField(fieldName: FormFieldName, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [fieldName]: value,
    }));
    setIsConfirmingSubmit(false);
  }

  function handleReadinessCheck() {
    setHasCheckedReadiness(true);
    setDraftSaveFeedback(null);
    setSubmitFeedback(null);
  }

  async function handleSaveDraft() {
    if (isDraftSaveDisabled) {
      return;
    }

    setHasCheckedReadiness(false);
    setSubmitFeedback(null);
    setIsSavingDraft(true);
    setDraftSaveFeedback(null);

    try {
      const result = await Promise.race([
        saveTeacherProfileDraftAction(formState),
        createDraftSaveTimeout(),
      ]);

      if (result === "timeout") {
        setDraftSaveFeedback({
          kind: "error",
          message:
            "請先登入後再儲存草稿。登入後，你可以回到這裡繼續整理老師申請資料。你目前畫面中的內容仍會保留。",
          showSignInLink: true,
        });
        return;
      }

      if (result.ok) {
        setLastSavedAt(result.profile.updatedAt);
        setDraftSaveFeedback({
          kind: "success",
          message: isRejectedProfile
            ? "修正內容已儲存。你可以依退回說明慢慢調整，準備好後再重新送審。"
            : "草稿已儲存。這還不是正式送審，你可以慢慢調整內容。",
        });
        return;
      }

      setDraftSaveFeedback({
        kind: "error",
        message: getDraftSaveErrorMessage(result),
        result,
      });
    } catch {
      setDraftSaveFeedback({
        kind: "error",
        message: "草稿暫時無法儲存，請稍後再試。你目前畫面中的內容仍會保留。",
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleOpenSubmitConfirmation() {
    if (isSubmitDisabled) {
      return;
    }

    setDraftSaveFeedback(null);
    setSubmitFeedback(null);
    setIsConfirmingSubmit(true);
  }

  function handleCancelSubmitConfirmation() {
    if (isSubmitting) {
      return;
    }

    setIsConfirmingSubmit(false);
  }

  async function handleSubmitApplication() {
    if (isSubmitDisabled) {
      return;
    }

    setHasCheckedReadiness(false);
    setDraftSaveFeedback(null);
    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const result = await submitTeacherProfileApplicationAction(formState);

      if (result.ok) {
        setHydratedProfileStatus(result.profile.status);
        setIsConfirmingSubmit(false);
        setLastSavedAt(result.profile.updatedAt);
        setDraftSaveFeedback(null);
        setSubmitFeedback({
          kind: "success",
          message:
            "已送出審核，接下來會等待平台確認。審核期間暫時不需要再儲存草稿。",
        });
        return;
      }

      if (result.code === "submit_validation_failed") {
        setHasCheckedReadiness(true);
      }

      setSubmitFeedback({
        kind: "error",
        message: getSubmitErrorMessage(result),
        result,
        showSignInLink: result.code === "authentication_required",
      });
    } catch {
      setSubmitFeedback({
        kind: "error",
        message:
          "老師申請暫時無法送出，請稍後再試。你目前畫面中的內容仍會保留。",
      });
    } finally {
      // 失敗時也要收起確認框：確認框開著時 statusExtras 會把錯誤訊息藏起來。
      setIsConfirmingSubmit(false);
      setIsSubmitting(false);
    }
  }

  const statusPill = (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}
    >
      {statusBadge.label}
    </span>
  );

  const readinessSummary = hasCheckedReadiness ? (
    <div
      className={
        isReadyForFutureSubmit
          ? "rounded-xl border border-pine/15 bg-pine-tint px-4 py-3 text-sm leading-6 text-ink-soft"
          : "rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep"
      }
    >
      <p>
        {isReadyForFutureSubmit ? (
          "送審必填欄位都已有內容，正式送出前系統還會再確認一次。"
        ) : (
          <>
            <span className="font-medium">還有必填欄位尚未完成：</span>
            {missingRequiredFields
              .map((fieldName) => fieldLabels[fieldName])
              .join("、")}
          </>
        )}
      </p>
      <p className="mt-1">
        建議欄位已填 {optionalFieldsWithValue} / {optionalFieldNames.length} 項，可以之後再補。
      </p>
    </div>
  ) : null;

  const statusActionBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-ink/12 bg-white px-4 py-2.5">
      {statusPill}
      {mutationBlockedCopy ? (
        <p className="text-xs leading-5 text-ink-faint">
          {mutationBlockedCopy.notice}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-ink/20 px-4 py-2 text-sm font-medium text-ink"
            onClick={handleReadinessCheck}
            type="button"
          >
            檢查準備狀態
          </button>
          <button
            className="rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine disabled:cursor-not-allowed disabled:border-ink/15 disabled:text-ink-faint"
            disabled={isDraftSaveDisabled}
            onClick={handleSaveDraft}
            type="button"
          >
            {isRejectedProfile
              ? isSavingDraft
                ? "正在儲存..."
                : "儲存修正"
              : isSavingDraft
                ? "正在儲存..."
                : "儲存草稿"}
          </button>
          <button
            className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
            disabled={isSubmitDisabled}
            onClick={handleOpenSubmitConfirmation}
            type="button"
          >
            {isSubmitting
              ? "正在送出..."
              : isRejectedProfile
                ? "重新送出審核"
                : "送出審核"}
          </button>
        </div>
      )}
    </div>
  );

  const actionFeedback = (
    <div aria-live="polite" className="grid gap-3">
      {isSavingDraft ? (
        <p className="rounded-xl border border-pine/15 bg-pine-tint px-4 py-3 text-sm leading-6 text-pine-deep">
          正在儲存草稿...
        </p>
      ) : null}

      {draftSaveFeedback ? (
        <div
          className={
            draftSaveFeedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay"
          }
        >
          <p>{draftSaveFeedback.message}</p>
          {draftSaveFeedback.kind === "success" && lastSavedAtLabel ? (
            <p className="mt-2">上次儲存：{lastSavedAtLabel}</p>
          ) : null}
          {draftSaveFeedback.result?.code === "authentication_required" ||
          draftSaveFeedback.showSignInLink ? (
            <a
              className="mt-2 inline-flex font-medium text-ink underline underline-offset-4"
              href={signInHref}
            >
              前往登入
            </a>
          ) : null}
          {draftSaveFeedback.result?.validationErrors?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {draftSaveFeedback.result.validationErrors.map((error) => (
                <li key={`${error.field}-${error.code}`}>{error.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {isSubmitting ? (
        <p className="rounded-xl border border-pine/15 bg-pine-tint px-4 py-3 text-sm leading-6 text-pine-deep">
          正在送出審核...
        </p>
      ) : null}

      {submitFeedback ? (
        <div
          className={
            submitFeedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay"
          }
        >
          <p>{submitFeedback.message}</p>
          {submitFeedback.showSignInLink ? (
            <a
              className="mt-2 inline-flex font-medium text-ink underline underline-offset-4"
              href={signInHref}
            >
              前往登入
            </a>
          ) : null}
          {submitFeedback.result?.validationErrors?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {submitFeedback.result.validationErrors.map((error) => (
                <li key={`${error.field}-${error.code}`}>{error.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const submitConfirmation = isConfirmingSubmit ? (
    <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
      <p className="font-medium text-ink">確認送出審核</p>
      <p className="mt-2">
        {isRejectedProfile
          ? "重新送出後，這份老師申請會再次進入平台審核。請確認修正內容已準備好，再送出。"
          : "送出後，這份老師申請會進入平台審核。審核期間暫時不需要再儲存草稿；請確認主要資料已準備好，再送出。"}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
          disabled={isSubmitting}
          onClick={handleSubmitApplication}
          type="button"
        >
          {isSubmitting ? "正在送出..." : "確認送出審核"}
        </button>
        <button
          className="rounded-full border border-clay/40 bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:text-ink-faint"
          disabled={isSubmitting}
          onClick={handleCancelSubmitConfirmation}
          type="button"
        >
          先回來調整
        </button>
      </div>
    </div>
  ) : null;

  // 確認送出審核時，先把準備狀態跟儲存/送出的結果訊息收起來，只留確認框——避免三個
  // 提示框一起疊在畫面上，同一套內容也讓上下兩條狀態列的顯示邏輯完全一致。
  const statusExtras = isConfirmingSubmit ? (
    submitConfirmation
  ) : (
    <>
      {readinessSummary}
      {actionFeedback}
    </>
  );

  return (
    <>
      <section>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          一起建立清楚、安心的瑜伽團課合作
        </h1>
        <div className="mt-6 ml-6 max-w-2xl border-l-4 border-clay/50 pl-4">
          <p className="text-base leading-7 text-ink-soft">
            飛索重視老師的專業，也提供老師管理日常課程的工具：
          </p>
          <ul className="mt-4 space-y-3">
            {collaborationPrinciples.map((principle) => (
              <li className="flex items-start gap-3" key={principle}>
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-clay"
                />
                <span className="text-sm leading-6 text-ink-soft">
                  {principle}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {mutationBlockedCopy ? null : (
          <p className="mt-4 ml-6 text-sm leading-6 text-ink-faint">
            {isRejectedProfile
              ? "下方會顯示被退回的申請資料；你可以依修正方向調整後重新送審。"
              : "下方表單可手動儲存草稿；準備好後，請經過二次確認再正式送出審核。"}
          </p>
        )}
      </section>

      <section
        aria-labelledby="application-form-title"
        className="grid gap-6 border-y border-pine/15 bg-pine-tint/60 py-6"
      >
        <div>
          <h2
            className="text-2xl font-semibold tracking-tight text-ink"
            id="application-form-title"
          >
            老師申請資料準備區
          </h2>
          {mutationBlockedCopy ? null : isRejectedProfile ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
              這份申請已退回修正。你可以依平台提供的修正方向更新內容，儲存修正後再重新送出審核。
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
              你可以先在這裡整理申請需要的內容並手動儲存草稿；準備好後，正式送出審核前系統會再請你確認一次。
            </p>
          )}
        </div>

        {statusActionBar}
        {statusExtras}

        {isRejectedProfile ? (
          <div className="min-w-0 rounded-2xl border border-clay/25 bg-clay-tint p-4">
            <h3 className="text-sm font-medium text-clay-deep">
              平台的退回說明
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-clay">
              {rejectionReason && rejectionReason.trim().length > 0
                ? rejectionReason
                : "平台尚未提供具體說明。你可以先檢查必填欄位並補充教學經歷，準備好後再重新送審。"}
            </p>
          </div>
        ) : null}

        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleReadinessCheck();
          }}
        >
          {applicationSections.map((section) => (
            <section
              className="grid gap-5 border-t border-pine/15 pt-5 first:border-t-0 first:pt-0"
              key={section.title}
            >
              <div className="max-w-2xl">
                <h3 className="text-lg font-medium text-ink">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {section.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => {
                  const showReminder =
                    hasCheckedReadiness &&
                    missingRequiredFieldSet.has(field.name);
                  const inputId = `teacher-application-${field.name}`;

                  return (
                    <div
                      className="rounded-2xl border border-ink/12 bg-white p-4"
                      key={field.name}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <label
                            className="text-sm font-medium text-ink"
                            htmlFor={inputId}
                          >
                            {field.label}
                          </label>
                        </div>
                        <RequirementBadge requirement={field.requirement} />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-ink-soft">
                        {field.helper}
                      </p>

                      <FieldControl
                        disabled={mutationBlockedStatus !== null}
                        field={field}
                        inputId={inputId}
                        onChange={(value) => updateField(field.name, value)}
                        showReminder={showReminder}
                        value={formState[field.name]}
                      />

                      {showReminder ? (
                        <p
                          className="mt-2 rounded-xl border border-clay/25 bg-clay-tint px-3 py-2 text-sm leading-6 text-clay"
                          id={`${inputId}-reminder`}
                        >
                          {getReadinessMessage(field.name)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

        </form>

        {statusActionBar}
        {statusExtras}
      </section>
    </>
  );
}
