"use client";

import { useEffect, useMemo, useState } from "react";

import { TagCheckbox } from "@/app/_components/tag-checkbox";
import { useUnsavedChangesWarning } from "@/app/teacher/classes/new/_lib/use-unsaved-changes";

import {
  applicationSections,
  buildCheckboxGroupValue,
  fieldLabels,
  normalizePreferredLocationValue,
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
// 這一頁，而不是掉回 /sign-in 沒帶 callbackUrl 時的既有預設值（學員總覽）。
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
      "已送出審核，接下來會等待平台確認。審核完成後會在站內通知你，審核期間不需要再儲存草稿或重複送出。",
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

const allApplicationFields = applicationSections.flatMap(
  (section) => section.fields,
);

// 只能從選項清單勾選的欄位（例如服務地區）：舊資料若是自由輸入的文字，不在清單內就不算數。
function getChoiceOnlyField(fieldName: FormFieldName) {
  const field = allApplicationFields.find((item) => item.name === fieldName);

  return field?.kind === "checkboxGroup" && field.allowOther === false
    ? field
    : null;
}

function getMissingRequiredFields(formState: TeacherApplicationFormState) {
  return requiredFields.filter((fieldName) => {
    if (fieldName === "experienceYears") {
      return !hasExperienceYears(formState.experienceYears);
    }

    const choiceOnlyField = getChoiceOnlyField(fieldName);

    if (choiceOnlyField) {
      return (
        parseCheckboxGroupValue(formState[fieldName], choiceOnlyField.groups)
          .selectedValues.length === 0
      );
    }

    return isBlank(formState[fieldName]);
  });
}

// 只能勾選的欄位，把不在選項清單內的舊資料挑出來（可編輯時會從表單移除，並提醒老師改選）。
function splitLegacyChoiceValues(
  state: TeacherApplicationFormState,
): {
  cleanedState: TeacherApplicationFormState;
  legacyValues: Partial<Record<FormFieldName, string>>;
} {
  const cleanedState = { ...state };
  const legacyValues: Partial<Record<FormFieldName, string>> = {};

  for (const field of allApplicationFields) {
    if (field.kind !== "checkboxGroup" || field.allowOther !== false) {
      continue;
    }

    const { selectedValues, otherText } = parseCheckboxGroupValue(
      state[field.name],
      field.groups,
    );

    if (otherText.length > 0) {
      legacyValues[field.name] = otherText;
      cleanedState[field.name] = selectedValues.join("\n");
    }
  }

  return { cleanedState, legacyValues };
}

// teacher-usability-redesign 票 06：七項送審必填集中在一區（依 requiredFields 的順序），
// 選填收在「其他資料（可之後補）」。欄位定義與驗證沿用 application-fields，不增減。
const requiredFieldDefs = requiredFields
  .map((fieldName) => allApplicationFields.find((field) => field.name === fieldName))
  .filter((field): field is TextField => field !== undefined);
const optionalFieldDefs = allApplicationFields.filter(
  (field) => field.requirement === "optionalRecommended",
);

function isOptionalField(fieldName: string) {
  return optionalFieldDefs.some((field) => field.name === fieldName);
}

const unsavedApplicationMessage = "申請資料有尚未儲存的修改，離開後這些修改不會保留。確定要離開嗎？";

function getChoiceItems(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getFieldCardId(fieldName: FormFieldName) {
  return `teacher-application-${fieldName}-card`;
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
    preferredSessionLengthMinutes:
      typeof profile.preferredSessionLengthMinutes === "number"
        ? String(profile.preferredSessionLengthMinutes)
        : "",
    preferredFrequency: profile.preferredFrequency ?? "",
    preferredLocationType: normalizePreferredLocationValue(
      profile.preferredLocationType ?? "",
    ),
    preferenceNotes: profile.preferenceNotes ?? "",
  };
}

function getFieldDisplayValue(field: TextField, value: string) {
  if (field.kind === "select") {
    return (
      field.options.find((option) => option.value === value)?.label ?? value
    );
  }

  return value;
}

// 審核中（submitted）的唯讀摘要：核心欄位送審後不能編輯，所以只給老師「看」送出去的內容，
// 不再顯示一張可以填、但存不了的表單。
function SubmittedApplicationSummary({
  formState,
  lastSavedAtLabel,
}: {
  formState: TeacherApplicationFormState;
  lastSavedAtLabel: string | null;
}) {
  return (
    <section
      aria-labelledby="application-form-title"
      className="grid gap-6 border-y border-pine/15 bg-pine-tint/60 py-6"
    >
      <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            審核中
          </span>
          <h2
            className="text-2xl font-semibold tracking-tight text-ink"
            id="application-form-title"
          >
            你的老師申請正在審核
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-ink-soft">
          已送出審核，接下來會等待平台確認。審核完成後會在站內通知你，審核期間不需要再儲存草稿或重複送出。
        </p>
        {lastSavedAtLabel ? (
          <p className="text-xs text-ink-faint">最後更新：{lastSavedAtLabel}</p>
        ) : null}
        <div>
          <a
            className="inline-flex rounded-full border border-pine/40 bg-white px-4 py-2 text-sm font-medium text-pine"
            href="/teacher/dashboard"
          >
            回老師總覽
          </a>
        </div>
      </div>

      {applicationSections.map((section) => (
        <section
          className="grid gap-3 border-t border-pine/15 pt-5 first:border-t-0 first:pt-0"
          key={section.title}
        >
          <h3 className="text-lg font-medium text-ink">{section.title}</h3>
          <dl className="grid gap-3 md:grid-cols-2">
            {section.fields.map((field) => {
              const value = formState[field.name];
              const isChoiceList = field.kind === "checkboxGroup";
              const items = isChoiceList
                ? value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0)
                : [];

              return (
                <div
                  className="min-w-0 rounded-2xl border border-ink/12 bg-white p-4"
                  key={field.name}
                >
                  <dt className="text-sm font-medium text-ink">
                    {field.label}
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-ink-soft">
                    {isChoiceList ? (
                      items.length > 0 ? (
                        <span className="flex flex-wrap gap-2">
                          {items.map((item) => (
                            <span
                              className="rounded-full border border-ink/20 px-3 py-1 text-sm text-ink-soft"
                              key={item}
                            >
                              {item}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "未填寫"
                      )
                    ) : value.trim().length > 0 ? (
                      <span className="whitespace-pre-wrap break-words">
                        {getFieldDisplayValue(field, value)}
                      </span>
                    ) : (
                      "未填寫"
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </section>
  );
}

function SectionProgress({
  requiredCount,
  missingCount,
}: {
  requiredCount: number;
  missingCount: number;
}) {
  if (requiredCount === 0) {
    return (
      <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-clay">
        全部選填
      </span>
    );
  }

  if (missingCount === 0) {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
        必填已完成
      </span>
    );
  }

  return (
    <span className="rounded-full bg-clay-tint px-3 py-1 text-xs font-medium text-clay-deep">
      必填 {requiredCount - missingCount} / {requiredCount}
    </span>
  );
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
      選填，通過後再補也可以
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

    const allowOther = field.allowOther !== false;

    function toggleOption(optionValue: string) {
      const nextSelected = selectedValues.includes(optionValue)
        ? selectedValues.filter((item) => item !== optionValue)
        : [...selectedValues, optionValue];
      onChange(buildCheckboxGroupValue(nextSelected, allowOther ? otherText : ""));
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
        {allowOther ? (
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
        ) : null}
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
  // 最後一次「確定存進資料庫」的內容（載入的資料、儲存成功時送出的那份、送審成功的那份）。
  // 只有跟它不一樣才算有未儲存的修改；儲存途中又改的內容，因為跟送出的那份不同，仍算未儲存。
  const [savedSnapshotKey, setSavedSnapshotKey] = useState<string | null>(null);
  // 打開送審確認時的內容：確認框顯示的就是這一份，按確認也送這一份。
  const [confirmSnapshot, setConfirmSnapshot] = useState<TeacherApplicationFormState | null>(null);
  const [isOptionalOpen, setIsOptionalOpen] = useState(false);
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
  // 還沒拿到自己的申請資料前不顯示表單，避免審核中的老師先看到一張空表單再跳成摘要。
  const [isHydrated, setIsHydrated] = useState(false);
  // 舊資料裡不在選項清單內的內容（例如自由輸入的服務地區），用來提醒老師改選。
  const [legacyChoiceValues, setLegacyChoiceValues] = useState<
    Partial<Record<FormFieldName, string>>
  >({});

  useEffect(() => {
    let isMounted = true;

    async function hydrateOwnTeacherProfile() {
      try {
        const profile =
          await getInitialTeacherProfileApplicationSnapshotAction();

        if (!isMounted) {
          return;
        }

        if (!profile) {
          setSavedSnapshotKey(JSON.stringify(initialFormState));
          return;
        }

        const loadedState = toTeacherApplicationFormState(profile);

        // 審核中、已通過、已暫停只是唯讀顯示，保留原樣；可編輯（草稿、被退回）才清掉舊的自由輸入內容。
        // 載入與整理後的內容當作基準，不算使用者改動。
        if (profile.status === "draft" || profile.status === "rejected") {
          const { cleanedState, legacyValues } =
            splitLegacyChoiceValues(loadedState);

          setFormState(cleanedState);
          setLegacyChoiceValues(legacyValues);
          setSavedSnapshotKey(JSON.stringify(cleanedState));
          setIsOptionalOpen(
            optionalFieldDefs.some((field) => legacyValues[field.name] !== undefined),
          );
        } else {
          setFormState(loadedState);
          setSavedSnapshotKey(JSON.stringify(loadedState));
        }

        setHydratedProfileStatus(profile.status);
        setRejectionReason(profile.rejectionReason);
        setLastSavedAt(profile.updatedAt);
        // 被退回的申請一進來就標出還缺哪些必填欄位，不用老師再按「檢查準備狀態」。
        setHasCheckedReadiness(profile.status === "rejected");
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
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
  // 缺項時送審按鈕仍可按：按下會標出缺項並帶到第一個，不會打開確認。
  const isSubmitDisabled = isSubmitting || mutationBlockedStatus !== null;
  const isEditable =
    isHydrated && mutationBlockedStatus === null && hydratedProfileStatus !== "submitted";
  const hasUnsavedChanges =
    savedSnapshotKey !== null && JSON.stringify(formState) !== savedSnapshotKey;
  useUnsavedChangesWarning(isEditable && hasUnsavedChanges, unsavedApplicationMessage);
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

  // 把畫面帶到某個欄位並聚焦（勾選類欄位聚焦第一個選項）。
  function focusField(fieldName: FormFieldName) {
    const card = document.getElementById(getFieldCardId(fieldName));

    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    const control =
      document.getElementById(`teacher-application-${fieldName}`) ??
      card?.querySelector<HTMLElement>("input, select, textarea");
    control?.focus({ preventScroll: true });
  }

  function handleJumpToFix() {
    const firstMissing = missingRequiredFields[0];

    if (firstMissing) {
      setHasCheckedReadiness(true);
      focusField(firstMissing);
      return;
    }

    document
      .getElementById("application-form-title")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSaveDraft() {
    if (isDraftSaveDisabled) {
      return;
    }

    setSubmitFeedback(null);
    setIsSavingDraft(true);
    setDraftSaveFeedback(null);
    // 送出的這一份才是這次要存的內容；儲存途中再改的內容不算在這次儲存裡。
    const sentState = formState;

    try {
      const result = await Promise.race([
        saveTeacherProfileDraftAction(sentState),
        createDraftSaveTimeout(),
      ]);

      // 逾時只代表畫面等太久，不代表伺服器取消了請求：不能說已儲存，也不能說沒存到。
      if (result === "timeout") {
        setDraftSaveFeedback({
          kind: "error",
          message:
            "儲存一直沒有回應，目前無法確定是否已經存好。畫面中的內容仍會保留，請稍後再按一次「儲存」。",
        });
        return;
      }

      if (result.ok) {
        setSavedSnapshotKey(JSON.stringify(sentState));
        setLastSavedAt(result.profile.updatedAt);
        setDraftSaveFeedback({
          kind: "success",
          message: isRejectedProfile
            ? "修正內容已儲存。你可以依退回說明慢慢調整，準備好後再重新送審。"
            : "草稿已儲存。這還不是正式送審，你可以慢慢調整內容。",
        });
        return;
      }

      if (result.validationErrors?.some((error) => isOptionalField(error.field))) {
        setIsOptionalOpen(true);
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

    // 還有缺項：標出缺項、帶到第一個，不打開確認。
    if (!isReadyForFutureSubmit) {
      setHasCheckedReadiness(true);
      focusField(missingRequiredFields[0]);
      return;
    }

    setConfirmSnapshot(formState);
    setIsConfirmingSubmit(true);
  }

  function handleCancelSubmitConfirmation() {
    if (isSubmitting) {
      return;
    }

    setIsConfirmingSubmit(false);
  }

  async function handleSubmitApplication() {
    if (isSubmitDisabled || !confirmSnapshot) {
      return;
    }

    setDraftSaveFeedback(null);
    setIsSubmitting(true);
    setSubmitFeedback(null);
    const sentState = confirmSnapshot;

    try {
      const result = await submitTeacherProfileApplicationAction(sentState);

      if (result.ok) {
        // 唯讀摘要要顯示實際送出的內容。
        setFormState(sentState);
        setSavedSnapshotKey(JSON.stringify(sentState));
        setHydratedProfileStatus(result.profile.status);
        setIsConfirmingSubmit(false);
        setLastSavedAt(result.profile.updatedAt);
        setDraftSaveFeedback(null);
        setSubmitFeedback({
          kind: "success",
          message:
            "已送出審核，接下來會等待平台確認。審核完成後會在站內通知你，審核期間不需要再儲存草稿。",
        });
        return;
      }

      if (result.code === "submit_validation_failed") {
        setHasCheckedReadiness(true);

        if (result.validationErrors?.some((error) => isOptionalField(error.field))) {
          setIsOptionalOpen(true);
        }
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

  function renderFieldCard(field: TextField) {
    const showReminder =
      hasCheckedReadiness && missingRequiredFieldSet.has(field.name);
    const inputId = `teacher-application-${field.name}`;

    return (
      <div
        className="scroll-mt-24 rounded-2xl border border-ink/12 bg-white p-4"
        id={getFieldCardId(field.name)}
        key={field.name}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <label className="text-sm font-medium text-ink" htmlFor={inputId}>
              {field.label}
            </label>
          </div>
          <RequirementBadge requirement={field.requirement} />
        </div>

        <p className="mt-3 text-sm leading-6 text-ink-soft">{field.helper}</p>

        {field.kind === "textarea" && field.example ? (
          <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-sm leading-6 text-ink-soft">
            <span className="font-medium text-ink">參考寫法：</span>
            {field.example}
          </p>
        ) : null}

        <FieldControl
          // 送審中鎖住欄位，避免畫面跟實際送出的內容不一致。
          disabled={mutationBlockedStatus !== null || isSubmitting}
          field={field}
          inputId={inputId}
          onChange={(value) => updateField(field.name, value)}
          showReminder={showReminder}
          value={formState[field.name]}
        />

        {legacyChoiceValues[field.name] ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
            你先前填寫的「{legacyChoiceValues[field.name]}
            」不在選項內，這次不會保留，請改從上方勾選。
          </p>
        ) : null}

        {field.kind === "textarea" && field.requirement === "submitRequired" ? (
          <p className="mt-1 text-right text-xs text-ink-faint">
            已輸入 {formState[field.name].trim().length} 字
          </p>
        ) : null}

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
  }

  const statusPill = (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}
    >
      {statusBadge.label}
    </span>
  );

  // 比照團主開需求表單：不用先按「檢查準備狀態」，缺幾項、缺哪些隨時看得到，點名稱可跳到該欄位。
  const readinessSummary = mutationBlockedCopy ? null : isReadyForFutureSubmit ? (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
      <p>必填欄位都填好了，可以送出審核。</p>
      <p className="mt-1 text-emerald-800">
        選填欄位已填 {optionalFieldsWithValue} / {optionalFieldNames.length} 項，通過後再補也可以。
      </p>
    </div>
  ) : (
    <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
      <p>
        <span className="font-medium">
          還缺 {missingRequiredFields.length} 項才能送審：
        </span>
        {missingRequiredFields.map((fieldName, index) => (
          <span key={fieldName}>
            {index > 0 ? "、" : null}
            <a
              className="underline underline-offset-4"
              href={`#${getFieldCardId(fieldName)}`}
              onClick={(event) => {
                event.preventDefault();
                setHasCheckedReadiness(true);
                focusField(fieldName);
              }}
            >
              {fieldLabels[fieldName]}
            </a>
          </span>
        ))}
      </p>
      <p className="mt-1">
        選填欄位已填 {optionalFieldsWithValue} / {optionalFieldNames.length} 項，通過後再補也可以。
      </p>
    </div>
  );

  const statusActionBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/12 bg-white px-4 py-2.5 sm:rounded-full">
      <div className="flex flex-wrap items-center gap-2">
        {statusPill}
        {!mutationBlockedCopy && hasUnsavedChanges ? (
          <span className="text-xs text-ink-faint">有尚未儲存的修改</span>
        ) : null}
      </div>
      {mutationBlockedCopy ? (
        <p className="text-xs leading-5 text-ink-faint">
          {mutationBlockedCopy.notice}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="min-h-11 rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine disabled:cursor-not-allowed disabled:border-ink/15 disabled:text-ink-faint"
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
            className="min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
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

  const submitConfirmation = isConfirmingSubmit && confirmSnapshot ? (
    <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
      <p className="font-medium text-ink">確認送出審核</p>
      <p className="mt-2">
        {isRejectedProfile
          ? "重新送出後，這份老師申請會再次進入平台審核。以下是這次會送出的內容，送審期間不能修改。"
          : "送出後，這份老師申請會進入平台審核。以下是這次會送出的內容，送審期間不能修改。"}
      </p>
      <dl
        aria-label="這次送出的申請內容"
        className="mt-3 grid gap-2 rounded-xl border border-ink/10 bg-white p-3 text-ink-soft sm:grid-cols-[8rem_1fr]"
      >
        {requiredFieldDefs.map((field) => {
          const value = confirmSnapshot[field.name];
          const display =
            field.kind === "checkboxGroup"
              ? getChoiceItems(value).join("、")
              : getFieldDisplayValue(field, value).trim();

          return (
            <div className="contents" key={field.name}>
              <dt className="font-medium text-ink">{field.label}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words">{display}</dd>
            </div>
          );
        })}
        <div className="contents">
          <dt className="font-medium text-ink">其他資料</dt>
          <dd>
            已填 {optionalFieldDefs.filter((field) => !isBlank(confirmSnapshot[field.name])).length} /{" "}
            {optionalFieldDefs.length} 項
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          className="min-h-11 rounded-full bg-pine px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
          disabled={isSubmitting}
          onClick={handleSubmitApplication}
          type="button"
        >
          {isSubmitting ? "正在送出..." : "確認送出審核"}
        </button>
        <button
          className="min-h-11 rounded-full border border-clay/40 bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:text-ink-faint"
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

  const rejectedBanner = isRejectedProfile ? (
    <section
      aria-labelledby="rejected-banner-title"
      className="min-w-0 rounded-2xl border border-clay/25 bg-clay-tint p-5"
    >
      <h2
        className="text-xl font-semibold tracking-tight text-clay-deep"
        id="rejected-banner-title"
      >
        這份申請需要修正
      </h2>
      <h3 className="mt-3 text-sm font-medium text-clay-deep">
        平台的退回說明
      </h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-clay">
        {rejectionReason && rejectionReason.trim().length > 0
          ? rejectionReason
          : "平台尚未提供具體說明。你可以先檢查必填欄位並補充教學經歷，準備好後再重新送審。"}
      </p>
      <button
        className="mt-4 min-h-11 rounded-full bg-pine px-5 py-2 text-left text-sm font-medium text-white"
        onClick={handleJumpToFix}
        type="button"
      >
        {missingRequiredFields.length > 0
          ? `從第一個缺項開始修正（還缺 ${missingRequiredFields.length} 項）`
          : "前往修改申請內容"}
      </button>
    </section>
  ) : null;

  return (
    <>
      {rejectedBanner}
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
              : "填好下方 7 項必填就能直接送出審核，不需要先儲存草稿；想分次填寫也可以先儲存。"}
          </p>
        )}
      </section>

      {!isHydrated ? (
        <p
          className="border-y border-pine/15 bg-pine-tint/60 py-6 text-sm text-ink-soft"
          role="status"
        >
          正在載入你的申請資料…
        </p>
      ) : hydratedProfileStatus === "submitted" ? (
        <SubmittedApplicationSummary
          formState={formState}
          lastSavedAtLabel={lastSavedAtLabel}
        />
      ) : (
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
              7 項必填填好就能送審；其他資料可以之後再補。正式送出前會請你核對一次送出的內容。
            </p>
          )}
        </div>

        {statusActionBar}
        {statusExtras}

        <form
          className="grid gap-5"
          onSubmit={(event) => {
            // 不靠按 Enter 送審：送審一律走上方的「送出審核」與確認。
            event.preventDefault();
          }}
        >
          <section className="grid gap-5" aria-labelledby="required-fields-title">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-lg font-medium text-ink" id="required-fields-title">
                  送審必填（{requiredFieldDefs.length} 項）
                </h3>
                <SectionProgress
                  missingCount={missingRequiredFields.length}
                  requiredCount={requiredFieldDefs.length}
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                這幾項讓平台與團主認識你；填好就能送審，不需要先儲存草稿。
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {requiredFieldDefs.map((field) => renderFieldCard(field))}
            </div>
          </section>

          <details
            className="rounded-2xl border border-ink/12 bg-white/60 px-4"
            onToggle={(event) => setIsOptionalOpen(event.currentTarget.open)}
            open={isOptionalOpen}
          >
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-3 text-lg font-medium text-ink">
              其他資料（可之後補）
              <span className="text-sm font-normal text-ink-soft">
                已填 {optionalFieldsWithValue} / {optionalFieldNames.length} 項，不填也能送審
              </span>
            </summary>
            <div className="grid gap-4 pb-4 md:grid-cols-2">
              {optionalFieldDefs.map((field) => renderFieldCard(field))}
            </div>
          </details>
        </form>

        {statusActionBar}
        {statusExtras}
      </section>
      )}
    </>
  );
}
