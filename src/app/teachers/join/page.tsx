"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  saveTeacherProfileDraftAction,
  type TeacherProfileDraftSaveActionResult,
} from "./actions";

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
};

type FormFieldName = keyof TeacherApplicationFormState;

type DraftSaveFeedback = {
  kind: "success" | "error";
  message: string;
  result?: Extract<TeacherProfileDraftSaveActionResult, { ok: false }>;
  showSignInLink?: boolean;
};

type TextField = {
  name: FormFieldName;
  label: string;
  requirement: "submitRequired" | "optionalRecommended";
  helper: string;
  placeholder: string;
  inputMode?: "numeric" | "url";
  multiline?: boolean;
};

const collaborationPrinciples = [
  "尊重老師的教學風格、時間安排與專業界線。",
  "讓團主清楚表達需求，再由適合的老師回應合作機會。",
  "透過審核與清楚流程，守住課程品質與平台信任。",
];

const nextSteps = [
  "你可以先手動儲存草稿，讓申請內容不必一次完成。",
  "儲存草稿只會建立或更新 draft，不會送出審核，也不會進入 Admin review。",
  "正式 submit application 會在後續 slice 加上確認步驟，送出後才進入 Admin review。",
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
};

const requiredFields: FormFieldName[] = [
  "displayName",
  "bio",
  "teachingStyle",
  "experienceYears",
  "specialties",
  "serviceAreas",
  "teachingFormats",
];

const fieldLabels: Record<FormFieldName, string> = {
  displayName: "公開顯示名稱",
  bio: "老師簡介",
  teachingStyle: "教學風格",
  experienceYears: "教學年資",
  certifications: "證照或訓練背景",
  specialties: "擅長類型",
  serviceAreas: "可服務區域",
  teachingFormats: "授課形式",
  priceRange: "參考收費區間",
  profilePhotoUrl: "老師照片連結",
};

const applicationSections: {
  title: string;
  description: string;
  fields: TextField[];
}[] = [
  {
    title: "基本呈現",
    description:
      "先讓團主理解你的稱呼、教學經驗，以及你希望被看見的專業樣貌。",
    fields: [
      {
        name: "displayName",
        label: fieldLabels.displayName,
        requirement: "submitRequired",
        helper: "正式送審時必填。請填寫你希望在平台上被看見的名稱。",
        placeholder: "例如：林安瑜 / Anya Lin",
      },
      {
        name: "experienceYears",
        label: fieldLabels.experienceYears,
        requirement: "submitRequired",
        helper: "正式送審時必填。可填 0 或以上的教學年資。",
        placeholder: "例如：5",
        inputMode: "numeric",
      },
      {
        name: "profilePhotoUrl",
        label: fieldLabels.profilePhotoUrl,
        requirement: "optionalRecommended",
        helper: "建議欄位，可稍後補上。此 slice 先以圖片連結表示，尚未實作上傳。",
        placeholder: "例如：https://example.com/profile.jpg",
        inputMode: "url",
      },
    ],
  },
  {
    title: "教學風格與背景",
    description:
      "用清楚、溫和的方式描述你如何帶領練習，而不是把老師壓縮成標籤。",
    fields: [
      {
        name: "bio",
        label: fieldLabels.bio,
        requirement: "submitRequired",
        helper: "正式送審時必填。可以簡短說明你的練習背景、服務對象與教學關懷。",
        placeholder:
          "例如：我長期陪伴初學者與企業團體練習，重視呼吸、身體覺察與安全調整。",
        multiline: true,
      },
      {
        name: "teachingStyle",
        label: fieldLabels.teachingStyle,
        requirement: "submitRequired",
        helper: "正式送審時必填。請描述你的帶領方式、節奏與課堂氛圍。",
        placeholder: "例如：穩定、細緻，重視呼吸與身體覺察。",
        multiline: true,
      },
      {
        name: "certifications",
        label: fieldLabels.certifications,
        requirement: "optionalRecommended",
        helper: "建議欄位，可留空。可用逗號或換行分隔不同訓練。",
        placeholder: "例如：RYT 200、陰瑜伽培訓、孕產瑜伽進修",
        multiline: true,
      },
    ],
  },
  {
    title: "服務範圍與合作形式",
    description:
      "協助平台判斷哪些團課需求真正適合你，避免倉促媒合或不清楚的合作期待。",
    fields: [
      {
        name: "specialties",
        label: fieldLabels.specialties,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。可用逗號或換行分隔。",
        placeholder: "例如：哈達、陰瑜伽、伸展、企業放鬆課",
        multiline: true,
      },
      {
        name: "serviceAreas",
        label: fieldLabels.serviceAreas,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。請填寫你可服務的城市、行政區或線上形式。",
        placeholder: "例如：台北市、新北市、線上團課",
        multiline: true,
      },
      {
        name: "teachingFormats",
        label: fieldLabels.teachingFormats,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。V1 以實體團課優先，也可補充其他形式。",
        placeholder: "例如：實體團課、企業內訓、線上課",
        multiline: true,
      },
      {
        name: "priceRange",
        label: fieldLabels.priceRange,
        requirement: "optionalRecommended",
        helper: "建議欄位，可留空。此資訊只作為合作溝通參考，不作低價競標或排序。",
        placeholder: "例如：依課程長度與地點討論，團課每堂 NT$3,000 起",
      },
    ],
  },
];

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
    case "rejected_profile_policy_not_decided":
      return "退回後的重新整理流程尚未開放。之後會提供清楚的補件與重新送審方式。";
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

function RequirementBadge({
  requirement,
}: {
  requirement: TextField["requirement"];
}) {
  if (requirement === "submitRequired") {
    return (
      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
        送審必填
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
      建議，可留空
    </span>
  );
}

export default function TeacherJoinPage() {
  const [formState, setFormState] =
    useState<TeacherApplicationFormState>(initialFormState);
  const [hasCheckedReadiness, setHasCheckedReadiness] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveFeedback, setDraftSaveFeedback] =
    useState<DraftSaveFeedback | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

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
      (["certifications", "priceRange", "profilePhotoUrl"] as FormFieldName[])
        .filter((fieldName) => !isBlank(formState[fieldName])).length,
    [formState],
  );
  const isReadyForFutureSubmit = missingRequiredFields.length === 0;
  const lastSavedAtLabel = lastSavedAt ? formatLastSavedAt(lastSavedAt) : null;

  function updateField(fieldName: FormFieldName, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [fieldName]: value,
    }));
  }

  function handleReadinessCheck() {
    setHasCheckedReadiness(true);
  }

  async function handleSaveDraft() {
    if (isSavingDraft) {
      return;
    }

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
          message:
            "草稿已儲存。這還不是正式送審，你可以慢慢調整內容。",
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-amber-700">
            Free Soar Yoga teacher community
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">
            與我們一起建立更清楚、更安心的瑜伽團課合作
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
            Free Soar Yoga 重視老師的專業、風格與教學界線。我們希望讓團主的需求被清楚整理，也讓老師能被正確理解，回應真正適合自己的團課機會。
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              className="rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white"
              href="/sign-in"
            >
              登入並準備加入
            </a>
            <Link
              className="rounded border border-gray-300 px-5 py-3 text-center text-sm font-medium text-gray-900"
              href="/"
            >
              回到首頁
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            下方表單可手動儲存草稿，但不會正式送審，也不會進入 Admin review；正式 submit application 會在後續 slice 實作。
          </p>
        </div>

        <div className="rounded border border-amber-100 bg-amber-50/60 p-5">
          <h2 className="text-lg font-medium text-gray-950">
            我們尋找的不是可被比較的商品，而是能共同照顧練習品質的合作夥伴。
          </h2>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            平台會以審核、需求整理與清楚的溝通流程，支持老師與團主建立信任，而不是用低價競標或倉促媒合推動合作。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {collaborationPrinciples.map((principle) => (
          <article
            className="rounded border border-gray-200 bg-white p-5"
            key={principle}
          >
            <p className="text-sm leading-6 text-gray-700">{principle}</p>
          </article>
        ))}
      </section>

      <section
        aria-labelledby="application-form-title"
        className="grid gap-6 border-y border-sky-100 bg-sky-50/60 py-6"
      >
        <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <div>
            <p className="text-sm font-medium text-sky-700">
              Local-only application form
            </p>
            <h2
              className="mt-2 text-2xl font-semibold tracking-tight text-gray-950"
              id="application-form-title"
            >
              老師申請資料準備區
            </h2>
          </div>
          <div className="text-sm leading-6 text-gray-600">
            <p>
              你可以先在這裡整理 Phase 1 TeacherProfile 需要的內容，並在登入後手動儲存草稿。儲存草稿只會建立或更新 draft，不會送出審核，也不會進入 Admin review。
            </p>
            <p className="mt-2">
              按下「檢查準備狀態」只會顯示溫和提醒，幫助你看見正式送審前還可以補充的地方。
            </p>
          </div>
        </div>

        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleReadinessCheck();
          }}
        >
          {applicationSections.map((section) => (
            <section
              className="grid gap-5 border-t border-sky-100 pt-5 first:border-t-0 first:pt-0"
              key={section.title}
            >
              <div className="max-w-2xl">
                <h3 className="text-lg font-medium text-gray-950">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
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
                      className="rounded border border-gray-200 bg-white p-4"
                      key={field.name}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <label
                            className="text-sm font-medium text-gray-950"
                            htmlFor={inputId}
                          >
                            {field.label}
                          </label>
                          <p className="mt-1 font-mono text-xs text-gray-500">
                            {field.name}
                          </p>
                        </div>
                        <RequirementBadge requirement={field.requirement} />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-gray-600">
                        {field.helper}
                      </p>

                      {field.multiline ? (
                        <textarea
                          aria-describedby={
                            showReminder ? `${inputId}-reminder` : undefined
                          }
                          className="mt-3 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          id={inputId}
                          onChange={(event) =>
                            updateField(field.name, event.target.value)
                          }
                          placeholder={field.placeholder}
                          value={formState[field.name]}
                        />
                      ) : (
                        <input
                          aria-describedby={
                            showReminder ? `${inputId}-reminder` : undefined
                          }
                          className="mt-3 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          id={inputId}
                          inputMode={field.inputMode}
                          min={
                            field.name === "experienceYears" ? 0 : undefined
                          }
                          onChange={(event) =>
                            updateField(field.name, event.target.value)
                          }
                          placeholder={field.placeholder}
                          type={
                            field.name === "experienceYears"
                              ? "number"
                              : "text"
                          }
                          value={formState[field.name]}
                        />
                      )}

                      {showReminder ? (
                        <p
                          className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
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

          <div className="grid gap-4 rounded border border-gray-200 bg-white p-5 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-950">準備狀態</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                「檢查準備狀態」不是正式送出；「儲存草稿」也不會送審。這裡只是協助你用低壓方式整理 Phase 1 申請內容。
              </p>
              <div aria-live="polite">
                {isSavingDraft ? (
                  <p className="mt-4 rounded border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                    正在儲存草稿...
                  </p>
                ) : null}

                {draftSaveFeedback ? (
                  <div
                    className={
                      draftSaveFeedback.kind === "success"
                        ? "mt-4 rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
                        : "mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                    }
                  >
                    <p>{draftSaveFeedback.message}</p>
                    {draftSaveFeedback.kind === "success" &&
                    lastSavedAtLabel ? (
                      <p className="mt-2">上次儲存：{lastSavedAtLabel}</p>
                    ) : null}
                    {draftSaveFeedback.result?.code ===
                      "authentication_required" ||
                    draftSaveFeedback.showSignInLink ? (
                      <a
                        className="mt-2 inline-flex font-medium text-gray-950 underline underline-offset-4"
                        href="/sign-in"
                      >
                        前往登入
                      </a>
                    ) : null}
                    {draftSaveFeedback.result?.validationErrors?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {draftSaveFeedback.result.validationErrors.map(
                          (error) => (
                            <li key={`${error.field}-${error.code}`}>
                              {error.message}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {hasCheckedReadiness ? (
                <div className="mt-4 rounded border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-gray-700">
                  {isReadyForFutureSubmit ? (
                    <p>
                      送審必填欄位都已有內容。後續正式流程仍會由 server-side validation 再檢查一次，並提供清楚的送審確認。
                    </p>
                  ) : (
                    <>
                      <p className="font-medium text-gray-950">
                        還可以補充的地方
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {missingRequiredFields.map((fieldName) => (
                          <li key={fieldName}>
                            {getReadinessMessage(fieldName)}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="mt-3 text-gray-600">
                    建議欄位目前已填 {optionalFieldsWithValue} / 3 項；可依你的準備狀態慢慢補上。
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto">
              <button
                className="w-full rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 md:w-auto"
                disabled={isSavingDraft}
                onClick={handleSaveDraft}
                type="button"
              >
                {isSavingDraft ? "正在儲存..." : "儲存草稿"}
              </button>
              <button
                className="w-full rounded border border-gray-300 px-5 py-3 text-center text-sm font-medium text-gray-900 md:w-auto"
                type="submit"
              >
                檢查準備狀態
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-6 rounded border border-gray-200 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-6">
        <div>
          <p className="text-sm font-medium text-amber-700">Next steps</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
            申請流程將分階段開放
          </h2>
        </div>
        <ol className="space-y-4">
          {nextSteps.map((step, index) => (
            <li className="flex gap-3 text-sm leading-6 text-gray-700" key={step}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-700">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
