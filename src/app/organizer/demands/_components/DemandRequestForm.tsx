"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { TagCheckbox } from "@/app/_components/tag-checkbox";
import type { DemandRequestFormInput } from "@/domain/demand-request/input";
import {
  FREQUENCIES,
  MAX_SERVICE_TYPES,
  PREFERRED_TIME_SLOTS,
  SERVICE_TYPE_DESCRIPTIONS,
  SERVICE_TYPES,
  TARGET_LEVELS,
  UNDECIDED_SERVICE_TYPE,
} from "@/domain/demand-request/service-types";
import type {
  DemandRequestDraftSaveErrorCode,
  DemandRequestSubmitErrorCode,
} from "@/domain/demand-request/service";
import {
  CLASS_LENGTH_MINUTES_MAX,
  CLASS_LENGTH_MINUTES_MIN,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  EXPECTED_PARTICIPANTS_MAX,
  EXPECTED_PARTICIPANTS_MIN,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
  type DemandRequestValidationError,
} from "@/domain/demand-request/validation";

export type DemandRequestFormValues = {
  title: string;
  serviceTypes: string[];
  description: string;
  targetLevel: string;
  expectedParticipants: string;
  preferredAreas: string;
  isOnline: boolean;
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
      // 票 04：新需求送出時會先建立草稿；送出失敗也回傳這筆草稿，表單之後沿用同一筆。
      demandRequestId?: string;
    };

// organizer-usability-redesign 票 04：表單可以選擇自己擁有的團體。
export type DemandRequestOrganizationOption = {
  id: string;
  name: string;
  typeLabel: string;
  isContactComplete: boolean;
};

type DemandRequestFormProps = {
  initialDemandRequestId: string | null;
  initialValues: DemandRequestFormValues;
  organizations: DemandRequestOrganizationOption[];
  initialOrganizationId: string;
  // 已儲存在資料庫的團體；與 initialOrganizationId 不同時（例如剛新增團體回來）表示尚未儲存。
  savedOrganizationId: string | null;
  // 從新需求頁第一次存檔後換到編輯頁時，帶過來的結果提示（只顯示一次）。
  initialFeedback?: { kind: "success" | "error"; message: string } | null;
  onSaveDraft: (
    input: DemandRequestFormInput,
    demandRequestId?: string,
    organizationId?: string,
  ) => Promise<SaveDemandRequestDraftActionResult>;
  onSubmit: (
    input: DemandRequestFormInput,
    demandRequestId?: string,
    organizationId?: string,
  ) => Promise<SubmitDemandRequestActionResult>;
};

const UNSAVED_CHANGES_MESSAGE = "還有尚未儲存的修改，確定要離開這一頁嗎？";

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

const requiredFieldChecks: {
  label: string;
  // 票 04：缺項定位用的欄位區塊 id。
  anchor: string;
  // todayIso 是使用者本機的今天（YYYY-MM-DD）；還沒算出來（伺服器端第一次渲染）時為 null。
  isFilled: (values: DemandRequestFormValues, todayIso: string | null) => boolean;
}[] = [
  {
    label: `需求標題（${TITLE_MIN_LENGTH}–${TITLE_MAX_LENGTH} 字）`,
    anchor: "demand-field-title",
    isFilled: (v) => isLengthWithin(v.title.trim(), TITLE_MIN_LENGTH, TITLE_MAX_LENGTH),
  },
  { label: "服務類型", anchor: "demand-field-service-types", isFilled: (v) => v.serviceTypes.length > 0 },
  {
    label: `需求說明（${DESCRIPTION_MIN_LENGTH}–${DESCRIPTION_MAX_LENGTH} 字）`,
    anchor: "demand-field-description",
    isFilled: (v) =>
      isLengthWithin(v.description.trim(), DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH),
  },
  { label: "適合對象", anchor: "demand-field-target-level", isFilled: (v) => v.targetLevel.trim().length > 0 },
  {
    label: `預計參與人數（${EXPECTED_PARTICIPANTS_MIN}–${EXPECTED_PARTICIPANTS_MAX} 人）`,
    anchor: "demand-field-participants",
    isFilled: (v) =>
      isIntegerWithin(v.expectedParticipants, EXPECTED_PARTICIPANTS_MIN, EXPECTED_PARTICIPANTS_MAX),
  },
  {
    label: "期望地點",
    anchor: "demand-field-areas",
    isFilled: (v) => v.isOnline || v.preferredAreas.trim().length > 0,
  },
  { label: "期望時段", anchor: "demand-field-time-slots", isFilled: (v) => v.preferredTimeSlots.length > 0 },
  {
    label: `單堂課程長度（${CLASS_LENGTH_MINUTES_MIN}–${CLASS_LENGTH_MINUTES_MAX} 分鐘）`,
    anchor: "demand-field-class-length",
    isFilled: (v) =>
      isIntegerWithin(v.classLengthMinutes, CLASS_LENGTH_MINUTES_MIN, CLASS_LENGTH_MINUTES_MAX),
  },
  { label: "上課頻率", anchor: "demand-field-frequency", isFilled: (v) => v.frequency.trim().length > 0 },
  // 期望開課日期非必填，但填了就不能早於今天（伺服器端也會擋，這裡讓使用者填的當下就看到）。
  {
    label: "期望開課日期（不可早於今天）",
    anchor: "demand-field-start-date",
    isFilled: (v, todayIso) =>
      !v.preferredStartDate || !todayIso || v.preferredStartDate >= todayIso,
  },
];

// 票 04：送審準備狀態與伺服器的送審規則一致（長度與數值範圍），避免畫面說可以送、送出才被擋。
function isLengthWithin(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

function isIntegerWithin(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  const parsed = Number(trimmed);
  return parsed >= min && parsed <= max;
}

// 伺服器回傳的欄位錯誤對應到表單區塊，讓錯誤訊息也能點擊定位。
const FIELD_ANCHORS: Record<string, string> = {
  title: "demand-field-title",
  serviceTypes: "demand-field-service-types",
  description: "demand-field-description",
  targetLevel: "demand-field-target-level",
  expectedParticipants: "demand-field-participants",
  preferredAreas: "demand-field-areas",
  preferredTimeSlots: "demand-field-time-slots",
  classLengthMinutes: "demand-field-class-length",
  frequency: "demand-field-frequency",
  preferredStartDate: "demand-field-start-date",
};

// 今天的日期不會即時變動，不需要訂閱任何事件；用 useSyncExternalStore 只是為了讓伺服器端渲染
// （回傳 null）與瀏覽器端（本機日期）不會造成 hydration 不一致。
function subscribeToNothing() {
  return () => {};
}

function getLocalTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function toFormInput(values: DemandRequestFormValues): DemandRequestFormInput {
  return {
    ...values,
    serviceTypes: [...values.serviceTypes],
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
    case "organization_not_found":
      return "找不到這個團體，或你沒有權限使用，請重新選擇團體。";
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
    case "organization_not_found":
      return "找不到這個團體，或你沒有權限使用，請重新選擇團體。";
    case "organization_contact_incomplete":
      return "這個團體的聯絡資料還沒補齊，請先儲存並補齊聯絡資料，才能送出需求。";
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
  organizations,
  initialOrganizationId,
  savedOrganizationId,
  initialFeedback = null,
  onSaveDraft,
  onSubmit,
}: DemandRequestFormProps) {
  const router = useRouter();
  const [demandRequestId, setDemandRequestId] = useState(
    initialDemandRequestId,
  );
  const [formValues, setFormValues] =
    useState<DemandRequestFormValues>(initialValues);
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  // 最後一次成功儲存的內容；與目前內容不同就是「尚未儲存」。
  // 新需求還沒存過時，以空白表單為基準，開始填寫後才提醒。
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      values: initialValues,
      organizationId: initialDemandRequestId ? savedOrganizationId : initialOrganizationId,
    }),
  );
  const isNavigatingAwayRef = useRef(false);
  // 已開始換頁（存檔後前往編輯頁、補資料或詳情）：之後一直鎖住表單，直到新頁面取代這一頁，
  // 避免等待期間的輸入在換頁後消失。
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState<{
    kind: "success" | "error";
    message: string;
    validationErrors?: DemandRequestValidationError[];
  } | null>(initialFeedback);
  const [submitFeedback, setSubmitFeedback] = useState<{
    kind: "success" | "error";
    message: string;
    validationErrors?: DemandRequestValidationError[];
  } | null>(null);

  // 今天的日期只能在瀏覽器端算（伺服器時區可能不同），所以先是 null、載入後才填入。
  const todayIso = useSyncExternalStore(
    subscribeToNothing,
    getLocalTodayIso,
    () => null,
  );

  const isLocked = isSubmitted;
  const isStartDateInPast =
    todayIso !== null &&
    formValues.preferredStartDate !== "" &&
    formValues.preferredStartDate < todayIso;
  const missingRequiredFields = requiredFieldChecks.filter(
    (check) => !check.isFilled(formValues, todayIso),
  );
  const selectedOrganization =
    organizations.find((organization) => organization.id === organizationId) ?? null;
  const isOrganizationReady = selectedOrganization?.isContactComplete ?? false;
  const isReadyForSubmit = missingRequiredFields.length === 0 && isOrganizationReady;
  // 票 04：儲存或送出進行中時鎖住欄位，避免等待期間的新輸入被「儲存並離開」丟掉，
  // 也避免儲存與送審同時進行而各自建立草稿。
  const isBusy = isSavingDraft || isSubmitting || isNavigating;
  const isInputDisabled = isLocked || isBusy;
  const isDirty =
    !isSubmitted &&
    JSON.stringify({ values: formValues, organizationId }) !== savedSnapshot;

  // 票 04：未儲存的修改有離開保護。瀏覽器關閉／重新整理用 beforeunload；
  // 站內連結（Next.js Link 也是 <a>）在捕獲階段攔截並詢問。由表單自己觸發的導頁不攔。
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isNavigatingAwayRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
    }

    function handleLinkClick(event: MouseEvent) {
      if (isNavigatingAwayRef.current || event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") {
        return;
      }
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [isDirty]);

  // 票 04：點缺項名稱時，捲到該欄位並把焦點移過去（鍵盤與螢幕閱讀器也能定位）。
  function focusField(anchor: string) {
    const block = document.getElementById(anchor);
    if (!block) {
      return;
    }
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
  }

  // 票 04：網址上的一次性參數（存檔結果、從新增團體返回的預選）在顯示後清掉；
  // 這裡仍是同一個頁面，只改網址，之後重新整理會以資料庫內容為準。
  // 從補資料頁按上一頁時，瀏覽器可能從 back-forward cache 直接還原這一頁（保留離開前的鎖定狀態）；
  // 這時解除換頁鎖定，讓使用者可以繼續編輯同一筆草稿。
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        isNavigatingAwayRef.current = false;
        setIsNavigating(false);
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("flash") || url.searchParams.has("organizationId")) {
      window.history.replaceState(window.history.state, "", url.pathname);
    }
  }, []);

  function navigateAway(href: string, mode: "push" | "replace" | "document" = "push") {
    isNavigatingAwayRef.current = true;
    setIsNavigating(true);
    if (mode === "replace") {
      router.replace(href);
    } else if (mode === "document") {
      window.location.assign(href);
    } else {
      router.push(href);
    }
  }

  // 票 04：之後重新整理或分享網址都會回到同一筆草稿。
  // - 已在編輯頁：只把網址換成乾淨的編輯頁網址（同一個頁面）。
  // - 還在新需求頁：真的換到編輯頁（router.replace），讓 Next.js 的路由紀錄也是編輯頁，
  //   之後按上一頁不會拿到空白的新需求頁；提示透過一次性的 flash 參數帶過去。
  function adoptDraftUrl(savedId: string, flash: string) {
    const editUrl = `/organizer/demands/${savedId}/edit`;
    if (initialDemandRequestId) {
      window.history.replaceState(window.history.state, "", editUrl);
      return;
    }
    navigateAway(`${editUrl}?flash=${encodeURIComponent(flash)}`, "replace");
  }

  // 服務類型多選：最多 MAX_SERVICE_TYPES 個；「還不確定」不能跟其他選項並存（選它會清掉其他，
  // 選其他會取消它）。
  function toggleServiceType(serviceType: string) {
    const current = formValues.serviceTypes;

    if (current.includes(serviceType)) {
      updateField(
        "serviceTypes",
        current.filter((value) => value !== serviceType),
      );
      return;
    }

    if (serviceType === UNDECIDED_SERVICE_TYPE) {
      updateField("serviceTypes", [serviceType]);
      return;
    }

    const withoutUndecided = current.filter(
      (value) => value !== UNDECIDED_SERVICE_TYPE,
    );

    if (withoutUndecided.length >= MAX_SERVICE_TYPES) {
      return;
    }

    updateField("serviceTypes", [...withoutUndecided, serviceType]);
  }

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

  // 票 04：明確儲存草稿。第一次儲存成功後網址換成這筆草稿的編輯頁，之後的儲存、重新整理、
  // 補資料返回都用同一筆。thenGoTo 用在「儲存並前往補資料／新增團體」：儲存成功才離開，失敗就留在原頁。
  async function handleSaveDraft(thenGoTo?: (savedId: string) => string) {
    if (isSavingDraft || isSubmitting || isLocked) {
      return;
    }

    setSubmitFeedback(null);
    setIsSavingDraft(true);
    setDraftFeedback(null);

    try {
      const result = await onSaveDraft(
        toFormInput(formValues),
        demandRequestId ?? undefined,
        organizationId,
      );

      if (result.ok) {
        const savedId = result.demandRequest.id;
        setDemandRequestId(savedId);
        setSavedSnapshot(JSON.stringify({ values: formValues, organizationId }));
        setDraftFeedback({ kind: "success", message: "草稿已儲存。" });

        // 每次儲存成功都讓目前的網址指向這筆草稿：從「新增團體」返回帶的 ?organizationId= 也一併清掉，
        // 避免重新整理時又套用過期的預選。
        if (thenGoTo) {
          // 先把目前的歷史項目換成編輯頁網址，再整頁前往補資料／新增團體；
          // 按上一頁時瀏覽器會重新載入這筆草稿，不會回到空白的新需求頁。
          window.history.replaceState(window.history.state, "", `/organizer/demands/${savedId}/edit`);
          navigateAway(thenGoTo(savedId), "document");
        } else {
          adoptDraftUrl(savedId, "saved");
        }
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
    if (isBusy || isLocked || !isReadyForSubmit) {
      return;
    }

    setDraftFeedback(null);
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
    if (isBusy || isLocked || !isReadyForSubmit) {
      return;
    }

    setDraftFeedback(null);
    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const result = await onSubmit(
        toFormInput(formValues),
        demandRequestId ?? undefined,
        organizationId,
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
        // 票 04：送審成功後前往這筆需求的詳情，顯示下一位處理者。
        navigateAway(`/organizer/demands/${result.demandRequest.id}?submitted=1`);
        return;
      }

      if (result.demandRequestId && !demandRequestId) {
        // 送出前已先存成草稿：換到這筆的編輯頁並帶著錯誤提示，避免下一次送出又多建一筆。
        setDemandRequestId(result.demandRequestId);
        setSavedSnapshot(JSON.stringify({ values: formValues, organizationId }));
        adoptDraftUrl(result.demandRequestId, result.code);
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
      // 失敗時也要收起確認框：確認框開著時 statusExtras 會把錯誤訊息藏起來。
      setIsConfirmingSubmit(false);
      setIsSubmitting(false);
    }
  }

  const statusPill = (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
        isLocked ? "bg-pine-tint text-pine" : "bg-sage text-pine"
      }`}
    >
      {isLocked ? "已送出審核" : "草稿"}
    </span>
  );

  const statusActionBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-ink/12 bg-white px-4 py-2.5">
      {statusPill}
      {isLocked ? (
        <p className="text-xs leading-5 text-ink-faint">
          需求已送出審核，此頁暫時不開放更新或重新送出。
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine disabled:cursor-not-allowed disabled:border-ink/15 disabled:text-ink-faint"
            disabled={isSavingDraft || isSubmitting}
            onClick={() => handleSaveDraft()}
            type="button"
          >
            {isSavingDraft ? "正在儲存..." : "儲存草稿"}
          </button>
          <button
            className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
            disabled={isBusy || !isReadyForSubmit}
            onClick={handleOpenSubmitConfirmation}
            type="button"
          >
            {isSubmitting ? "正在送出..." : "送出審核"}
          </button>
        </div>
      )}
    </div>
  );

  const readinessSummary =
    !isLocked && !isReadyForSubmit ? (
      <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
        <span className="font-medium">
          還缺 {missingRequiredFields.length + (isOrganizationReady ? 0 : 1)} 項才能送審：
        </span>
        {isOrganizationReady ? null : (
          <span>
            <button
              className="underline underline-offset-4"
              onClick={() => focusField("demand-field-organization")}
              type="button"
            >
              團體聯絡資料
            </button>
            {missingRequiredFields.length > 0 ? "、" : null}
          </span>
        )}
        {missingRequiredFields.map((check, index) => (
          <span key={check.anchor}>
            {index > 0 ? "、" : null}
            <button
              className="underline underline-offset-4"
              onClick={() => focusField(check.anchor)}
              type="button"
            >
              {check.label}
            </button>
          </span>
        ))}
      </div>
    ) : !isLocked ? (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
        必填欄位都填好了，可以送出審核。
      </div>
    ) : null;

  const actionFeedback = (
    <div aria-live="polite" className="grid gap-3">
      {draftFeedback ? (
        <FeedbackBanner
          onLocate={focusField}
          kind={draftFeedback.kind}
          message={draftFeedback.message}
          validationErrors={draftFeedback.validationErrors}
        />
      ) : null}
      {submitFeedback ? (
        <FeedbackBanner
          onLocate={focusField}
          kind={submitFeedback.kind}
          message={submitFeedback.message}
          validationErrors={submitFeedback.validationErrors}
        />
      ) : null}
    </div>
  );

  const submitConfirmation = isConfirmingSubmit ? (
    <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
      <p className="font-medium text-ink">確認送出需求</p>
      <dl className="mt-2 grid gap-1 text-ink [overflow-wrap:anywhere]">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">團體</dt>
          <dd>{selectedOrganization?.name ?? "尚未選擇"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">期望時段</dt>
          <dd>{formValues.preferredTimeSlots.join("、") || "尚未選擇"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">期望開課日期</dt>
          <dd>{formValues.preferredStartDate || "未指定"}</dd>
        </div>
      </dl>
      <p className="mt-2">
        送出後，這筆需求會進入平台審核；審核通過前不會公開給老師，而且不能再更換團體。請確認內容已準備好，再送出。
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
          disabled={isBusy}
          onClick={handleSubmit}
          type="button"
        >
          {isSubmitting ? "正在送出..." : "確認送出"}
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

  // 確認送出時先把準備狀態跟儲存/送出結果收起來，只留確認框，比照老師申請表單的做法，
  // 避免畫面同時疊出好幾個提示框。
  const statusExtras = isConfirmingSubmit ? (
    submitConfirmation
  ) : (
    <>
      {readinessSummary}
      {actionFeedback}
    </>
  );

  return (
    <div className="grid gap-6">
      {statusActionBar}
      {statusExtras}

      <FieldSet legend="團體與課程需求">
        <div className="grid gap-3" id="demand-field-organization">
          <label className="block text-sm">
            <span className="font-medium text-ink">為哪個團體提出需求</span>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              需求會掛在這個團體名下，平台審核時使用這個團體的聯絡方式。送出審核後就不能再換團體。
            </p>
            <select
              className="mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:bg-ink/5"
              disabled={isInputDisabled}
              name="organizationId"
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setIsConfirmingSubmit(false);
              }}
              value={organizationId}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}（{organization.typeLabel}）
                </option>
              ))}
            </select>
          </label>
          {selectedOrganization && !isLocked ? (
            selectedOrganization.isContactComplete ? (
              <p className="text-xs leading-5 text-emerald-800">
                這個團體的聯絡資料已完整，可以直接送出審核。
              </p>
            ) : (
              <div
                className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep [overflow-wrap:anywhere]"
                role="status"
              >
                送出需求審核前，需要先補齊「{selectedOrganization.name}」的聯絡資料（聯絡窗口、電話、信箱）。草稿會先幫你存好，補完會回到這裡。
                <div className="mt-2">
                  <button
                    className="rounded-full border border-clay/40 bg-white px-4 py-1.5 text-sm font-medium text-clay-deep disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingDraft || isSubmitting}
                    onClick={() =>
                      handleSaveDraft(
                        (savedId) =>
                          `/organizer/organizations/${selectedOrganization.id}?returnTo=${encodeURIComponent(`/organizer/demands/${savedId}/edit`)}`,
                      )
                    }
                    type="button"
                  >
                    儲存草稿並補齊聯絡資料
                  </button>
                </div>
              </div>
            )
          ) : null}
          {!isLocked ? (
            <button
              className="w-fit text-sm font-medium text-pine underline underline-offset-4 disabled:cursor-not-allowed disabled:text-ink-faint"
              disabled={isSavingDraft || isSubmitting}
              onClick={() =>
                handleSaveDraft(
                  (savedId) =>
                    `/organizer/organizations/new?returnTo=${encodeURIComponent(`/organizer/demands/${savedId}/edit`)}`,
                )
              }
              type="button"
            >
              儲存草稿並新增其他團體
            </button>
          ) : null}
        </div>
        <div id="demand-field-title">
          <TextField
            disabled={isInputDisabled}
            hint="用一句話說明這次需求，例如對象與主要目的（5–100 字）。"
            label="需求標題"
            maxLength={100}
            onChange={(value) => updateField("title", value)}
            placeholder="例如：週三晚間員工紓壓瑜伽課"
            value={formValues.title}
          />
        </div>
        <div id="demand-field-service-types">
          <span className="text-sm font-medium text-ink">服務類型</span>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            選出最接近你們想要的課，最多選 {MAX_SERVICE_TYPES} 個（已選{" "}
            {formValues.serviceTypes.length}／{MAX_SERVICE_TYPES}）；不確定的話，選最後一項讓老師提案。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SERVICE_TYPES.map((serviceType) => {
              const checked = formValues.serviceTypes.includes(serviceType);

              return (
                <ServiceTypeCard
                  checked={checked}
                  description={SERVICE_TYPE_DESCRIPTIONS[serviceType]}
                  disabled={
                    isInputDisabled ||
                    (!checked &&
                      serviceType !== UNDECIDED_SERVICE_TYPE &&
                      formValues.serviceTypes.filter(
                        (value) => value !== UNDECIDED_SERVICE_TYPE,
                      ).length >= MAX_SERVICE_TYPES)
                  }
                  key={serviceType}
                  label={serviceType}
                  onChange={() => toggleServiceType(serviceType)}
                />
              );
            })}
          </div>
        </div>
        <div id="demand-field-description">
          <TextAreaField
            disabled={isInputDisabled}
            hint="說明上課對象、目的與希望呈現的課程樣貌（20–2000 字）。"
            label="需求說明"
            onChange={(value) => updateField("description", value)}
            placeholder="例如：希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。"
            value={formValues.description}
          />
        </div>
        <div id="demand-field-target-level">
          <SelectField
            disabled={isInputDisabled}
            hint="讓老師理解課程適合的程度。"
            label="適合對象"
            onChange={(value) => updateField("targetLevel", value)}
            options={TARGET_LEVELS.map((value) => ({
              value,
              label: targetLevelLabels[value] ?? value,
            }))}
            value={formValues.targetLevel}
          />
        </div>
        <div id="demand-field-participants">
          <TextField
            disabled={isInputDisabled}
            hint="預計參與人數（1–500 人）。"
            inputMode="numeric"
            label="預計參與人數"
            onChange={(value) => updateField("expectedParticipants", value)}
            placeholder="例如：15"
            type="number"
            value={formValues.expectedParticipants}
          />
        </div>
      </FieldSet>

      <FieldSet legend="時間與地點">
        <div className="grid gap-3">
          <div id="demand-field-areas">
            <TextField
              disabled={isInputDisabled}
              hint={
                formValues.isOnline
                  ? "線上課程可以留空；如果有實體集合地點也可以填。"
                  : "填寫具體地址或場地名稱，讓老師知道要去哪裡上課（100 字以內）。"
              }
              label={formValues.isOnline ? "期望地點（選填）" : "期望地點"}
              maxLength={100}
              onChange={(value) => updateField("preferredAreas", value)}
              placeholder="例如：台北市大安區安和路一段 10 號、陽光科技公司 4 樓教室"
              value={formValues.preferredAreas}
            />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              checked={formValues.isOnline}
              className="size-4 accent-pine disabled:cursor-not-allowed"
              disabled={isInputDisabled}
              onChange={(event) => updateField("isOnline", event.target.checked)}
              type="checkbox"
            />
            這是線上課程
          </label>
        </div>

        <div id="demand-field-time-slots">
          <span className="text-sm font-medium text-ink">期望時段</span>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            可複選，至少選擇一項。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PREFERRED_TIME_SLOTS.map((slot) => (
              <TagCheckbox
                checked={formValues.preferredTimeSlots.includes(slot)}
                disabled={isInputDisabled}
                key={slot}
                label={slot}
                onChange={() => toggleTimeSlot(slot)}
              />
            ))}
          </div>
        </div>

        <div id="demand-field-class-length">
          <TextField
            disabled={isInputDisabled}
            hint="單堂課程長度（30–240 分鐘）。"
            inputMode="numeric"
            label="單堂課程長度（分鐘）"
            onChange={(value) => updateField("classLengthMinutes", value)}
            placeholder="例如：60"
            type="number"
            value={formValues.classLengthMinutes}
          />
        </div>
        <div id="demand-field-frequency">
          <SelectField
            disabled={isInputDisabled}
            hint="這次需求希望的上課頻率。"
            label="上課頻率"
            onChange={(value) => updateField("frequency", value)}
            options={FREQUENCIES.map((value) => ({
              value,
              label: frequencyLabels[value] ?? value,
            }))}
            value={formValues.frequency}
          />
        </div>
        <div id="demand-field-start-date">
          <TextField
            disabled={isInputDisabled}
            hint="建議填寫，非必填；若填寫請選擇今天以後的日期。"
            label="期望開課日期"
            error={isStartDateInPast ? "期望開課日期不可早於今天，請重新選擇。" : undefined}
            min={todayIso ?? undefined}
            onChange={(value) => updateField("preferredStartDate", value)}
            type="date"
            value={formValues.preferredStartDate}
          />
        </div>
      </FieldSet>

      <FieldSet legend="預算備註">
        <TextField
          disabled={isInputDisabled}
          hint="建議填寫，非必填；僅作為溝通參考，不作低價比較。"
          label="預算參考"
          onChange={(value) => updateField("budgetRange", value)}
          placeholder="例如：依人數與時數討論"
          value={formValues.budgetRange}
        />
      </FieldSet>

      {statusActionBar}
      {statusExtras}
    </div>
  );
}

// 服務類型每一項都有說明文字，下拉選單放不下，所以改用可多選的方塊；比照 TagCheckbox，
// 用 has-checked 純 CSS 呈現選取狀態。
function ServiceTypeCard({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label className="relative block cursor-pointer rounded-xl border border-ink/20 px-3 py-2.5 transition has-checked:border-pine has-checked:bg-pine-tint has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:ring-2 has-focus-visible:ring-pine/25">
      <input
        checked={checked}
        className="sr-only"
        disabled={disabled}
        name="serviceTypes"
        onChange={onChange}
        type="checkbox"
        value={label}
      />
      <span className="block text-sm font-medium text-ink">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-ink-soft">
        {description}
      </span>
    </label>
  );
}

function FeedbackBanner({
  kind,
  message,
  validationErrors,
  onLocate,
}: {
  kind: "success" | "error";
  message: string;
  validationErrors?: DemandRequestValidationError[];
  onLocate: (anchor: string) => void;
}) {
  return (
    <div
      className={
        kind === "success"
          ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
          : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
      }
    >
      <p>{message}</p>
      {validationErrors && validationErrors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {validationErrors.map((error) => {
            const anchor = FIELD_ANCHORS[error.field];
            return (
              <li key={`${error.field}-${error.code}`}>
                {anchor ? (
                  <button
                    className="text-left underline underline-offset-4"
                    onClick={() => onLocate(anchor)}
                    type="button"
                  >
                    {error.message}
                  </button>
                ) : (
                  error.message
                )}
              </li>
            );
          })}
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
    <fieldset className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-5">
      <legend className="px-1 text-lg font-medium text-ink">
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
  min,
  error,
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
  min?: string;
  error?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p>
      ) : null}
      <input
        aria-invalid={error ? true : undefined}
        className={`mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:cursor-not-allowed disabled:bg-cream ${
          error ? "border-clay bg-clay-tint" : "border-ink/25"
        }`}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error ? (
        <p className="mt-2 text-xs font-medium leading-5 text-clay-deep" role="alert">
          {error}
        </p>
      ) : null}
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
      <span className="font-medium text-ink">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p>
      ) : null}
      <textarea
        className="mt-2 min-h-28 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:cursor-not-allowed disabled:bg-cream"
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
      <span className="font-medium text-ink">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p>
      ) : null}
      <select
        className="mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:cursor-not-allowed disabled:bg-cream"
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
