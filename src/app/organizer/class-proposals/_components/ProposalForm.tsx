"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { TagCheckbox } from "@/app/_components/tag-checkbox";
import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/domain/class-session/validation";
import { MAX_SERVICE_TYPES, SERVICE_TYPES } from "@/domain/demand-request/service-types";
import type { ProposalTeacherCard } from "@/domain/organizer-class-proposal/service";
import type { ProposalFormInput, ProposalValidationError } from "@/domain/organizer-class-proposal/validation";

import type {
  EditableProposalStatus,
  ProposalActionFailure,
  SaveProposalActionResult,
  SubmitProposalActionResult,
} from "../actions";

export type ProposalOrganizationOption = {
  id: string;
  name: string;
  typeLabel: string;
  isContactComplete: boolean;
};

type ProposalFormProps = {
  initialProposalId: string | null;
  // 票 07：可以修改的狀態；預設 draft（新建或草稿）。
  initialStatus?: EditableProposalStatus;
  // 老師婉拒時留下的原因，修改時給團主參考。
  declineReason?: string | null;
  initialVersion: number | null;
  initialValues: ProposalFormInput;
  initialTeacher: ProposalTeacherCard | null;
  // 已送出過（submittedAt 不為 null）的邀請不能換團體（spec 13.3）。
  organizationLocked: boolean;
  // 已儲存的團體；與 initialValues 不同（剛從新增團體返回並預選）時，視為尚未儲存的修改。
  savedOrganizationId?: string | null;
  organizations: ProposalOrganizationOption[];
  initialFeedback?: {
    kind: "success" | "error";
    message: string;
    validationErrors?: ProposalValidationError[];
  } | null;
  onSaveDraft: (
    input: ProposalFormInput,
    proposalId?: string,
    expectedVersion?: number,
  ) => Promise<SaveProposalActionResult>;
  onSubmit: (
    input: ProposalFormInput,
    proposalId?: string,
    expectedVersion?: number,
  ) => Promise<SubmitProposalActionResult>;
  onSearchTeachers: (query: string) => Promise<ProposalTeacherCard[]>;
  // 票 08：登入者自己的老師資料 id；選到自己時改用「由我授課並確認」。
  selfTeacherProfileId?: string | null;
  onSelfConfirm?: (
    input: ProposalFormInput,
    proposalId?: string,
    expectedVersion?: number,
  ) => Promise<SubmitProposalActionResult>;
};

const UNSAVED_CHANGES_MESSAGE = "還有尚未儲存的修改，確定要離開這一頁嗎？";

const inputClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:cursor-not-allowed disabled:bg-cream";

const FIELD_ANCHORS: Record<string, string> = {
  teacherProfileId: "proposal-field-teacher",
  title: "proposal-field-title",
  serviceTypes: "proposal-field-service-types",
  startAt: "proposal-field-start-at",
  endAt: "proposal-field-end-at",
  location: "proposal-field-location",
  capacity: "proposal-field-capacity",
  description: "proposal-field-description",
  organization: "proposal-field-organization",
};

function isIntegerWithin(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  const parsed = Number(trimmed);
  return parsed >= min && parsed <= max;
}

function subscribeToNothing() {
  return () => {};
}

// 台灣時間現在的 datetime-local 字串，用來在畫面上提醒開始時間必須晚於現在（伺服器送出時仍會再檢查）。
function currentTaipeiLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatLocalDatetime(value: string): string {
  return value ? value.replace("T", " ") : "尚未填寫";
}

// organizer-usability-redesign 票 05：「我已有合作老師」的單頁課程安排。
// 單頁分「團體與老師」「課程安排」「招募設定」三區；明確存草稿、送出前確認、失敗保留輸入、
// 第一次存檔後網址換成這筆的編輯頁、未儲存離開有保護。送出邀請不會開放報名，也不保留老師時段。
export function ProposalForm({
  initialProposalId,
  initialStatus = "draft",
  declineReason = null,
  initialVersion,
  initialValues,
  initialTeacher,
  organizationLocked,
  savedOrganizationId = null,
  organizations,
  initialFeedback = null,
  onSaveDraft,
  onSubmit,
  onSearchTeachers,
  selfTeacherProfileId = null,
  onSelfConfirm,
}: ProposalFormProps) {
  const router = useRouter();
  const [proposalId, setProposalId] = useState(initialProposalId);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState<EditableProposalStatus>(initialStatus);
  const [values, setValues] = useState<ProposalFormInput>(initialValues);
  const [teacher, setTeacher] = useState<ProposalTeacherCard | null>(initialTeacher);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      ...initialValues,
      organizationId: savedOrganizationId ?? initialValues.organizationId,
    }),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
    validationErrors?: ProposalValidationError[];
  } | null>(initialFeedback);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<ProposalTeacherCard[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const isNavigatingAwayRef = useRef(false);
  // 伺服器回報聯絡資料不完整（例如在別的分頁被清掉）時，這一頁也改成視為不完整，顯示補資料入口。
  const [contactIncompleteIds, setContactIncompleteIds] = useState<string[]>([]);
  // 只在瀏覽器端計算（伺服器端回傳 null），避免 hydration 不一致。
  const nowTaipeiLocal = useSyncExternalStore(subscribeToNothing, currentTaipeiLocal, () => null);

  const isBusy = isSaving || isSubmitting || isNavigating;
  const isSelfTeaching =
    Boolean(selfTeacherProfileId) && values.teacherProfileId === selfTeacherProfileId && Boolean(onSelfConfirm);
  const selectedOrganizationOption =
    organizations.find((organization) => organization.id === values.organizationId) ?? null;
  const selectedOrganization = selectedOrganizationOption
    ? {
        ...selectedOrganizationOption,
        isContactComplete:
          selectedOrganizationOption.isContactComplete &&
          !contactIncompleteIds.includes(selectedOrganizationOption.id),
      }
    : null;
  const isDirty = JSON.stringify(values) !== savedSnapshot;

  const missing: { label: string; anchor: string }[] = [
    ...(selectedOrganization?.isContactComplete ? [] : [{ label: "團體聯絡資料", anchor: FIELD_ANCHORS.organization }]),
    ...(values.teacherProfileId ? [] : [{ label: "授課老師", anchor: FIELD_ANCHORS.teacherProfileId }]),
    ...(values.title.trim() && values.title.trim().length <= TITLE_MAX_LENGTH
      ? []
      : [{ label: "課程名稱", anchor: FIELD_ANCHORS.title }]),
    ...(values.serviceTypes.length > 0 ? [] : [{ label: "課程風格", anchor: FIELD_ANCHORS.serviceTypes }]),
    ...(values.startAt && (nowTaipeiLocal === null || values.startAt > nowTaipeiLocal)
      ? []
      : [{ label: "開始時間（須晚於現在）", anchor: FIELD_ANCHORS.startAt }]),
    ...(values.endAt && values.endAt > values.startAt ? [] : [{ label: "結束時間（晚於開始）", anchor: FIELD_ANCHORS.endAt }]),
    ...(values.location.trim() ? [] : [{ label: "地點", anchor: FIELD_ANCHORS.location }]),
    ...(isIntegerWithin(values.capacity, CAPACITY_MIN, CAPACITY_MAX)
      ? []
      : [{ label: `名額（${CAPACITY_MIN}–${CAPACITY_MAX} 人）`, anchor: FIELD_ANCHORS.capacity }]),
  ];
  const isReadyToSubmit = missing.length === 0;

  // 未儲存離開保護：瀏覽器關閉／重新整理與站內連結。由表單自己觸發的換頁不攔。
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

  // 瀏覽器從 back-forward cache 還原時解除換頁鎖定。
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

  // 網址上的一次性參數（存檔結果、從新增團體返回的預選）顯示後清掉。
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("flash") || url.searchParams.has("organizationId")) {
      window.history.replaceState(window.history.state, "", url.pathname);
    }
  }, []);

  function update<K extends keyof ProposalFormInput>(field: K, value: ProposalFormInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setIsConfirming(false);
  }

  function toggleServiceType(serviceType: string) {
    const current = values.serviceTypes;
    if (current.includes(serviceType)) {
      update("serviceTypes", current.filter((value) => value !== serviceType));
    } else if (current.length < MAX_SERVICE_TYPES) {
      update("serviceTypes", [...current, serviceType]);
    }
  }

  function focusField(anchor: string) {
    const block = document.getElementById(anchor);
    if (!block) {
      return;
    }
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  }

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

  // 新建的邀請第一次存檔後，真的換到編輯頁（讓上一頁不會回到空白表單）；已在編輯頁就只清網址。
  function adoptProposalUrl(savedId: string, flash: string) {
    const editUrl = `/organizer/class-proposals/${savedId}/edit`;
    if (initialProposalId) {
      window.history.replaceState(window.history.state, "", editUrl);
      return;
    }
    navigateAway(`${editUrl}?flash=${encodeURIComponent(flash)}`, "replace");
  }

  async function handleSearchTeachers() {
    if (isSearching || isBusy) {
      return;
    }
    setIsSearching(true);
    try {
      setTeacherResults(await onSearchTeachers(teacherQuery));
    } catch {
      setTeacherResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave(thenGoTo?: (savedId: string) => string) {
    if (isBusy) {
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const result = await onSaveDraft(values, proposalId ?? undefined, version ?? undefined);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.message, validationErrors: result.validationErrors });
        return;
      }
      setProposalId(result.proposalId);
      setVersion(result.version);
      setStatus(result.status);
      setSavedSnapshot(JSON.stringify(values));
      setFeedback({
        kind: "success",
        message:
          result.status === "pending_confirmation"
            ? "已更新邀請內容，老師會看到最新的安排並重新確認。"
            : "草稿已儲存。",
      });
      if (thenGoTo) {
        window.history.replaceState(
          window.history.state,
          "",
          `/organizer/class-proposals/${result.proposalId}/edit`,
        );
        navigateAway(thenGoTo(result.proposalId), "document");
      } else {
        adoptProposalUrl(result.proposalId, "saved");
      }
    } catch {
      setFeedback({ kind: "error", message: "課程安排暫時無法儲存，請稍後再試。" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (isBusy || !isReadyToSubmit) {
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const action = isSelfTeaching && onSelfConfirm ? onSelfConfirm : onSubmit;
      const result = await action(values, proposalId ?? undefined, version ?? undefined);
      if (result.ok) {
        setSavedSnapshot(JSON.stringify(values));
        navigateAway(
          `/organizer/class-proposals/${result.proposalId}?flash=${isSelfTeaching ? "self_confirmed" : "submitted"}`,
        );
        return;
      }
      const failed = result as ProposalActionFailure;
      if (failed.code === "organization_contact_incomplete") {
        setContactIncompleteIds((current) => [...current, values.organizationId]);
      }
      if (failed.proposalId) {
        // 送出前已存成草稿：沿用這一筆，避免下一次送出又建一筆（已婉拒／已確認的邀請此時也已回到草稿）。
        setProposalId(failed.proposalId);
        setVersion(failed.version ?? null);
        setStatus("draft");
        setSavedSnapshot(JSON.stringify(values));
        if (!proposalId) {
          adoptProposalUrl(failed.proposalId, failed.code);
          return;
        }
      }
      setFeedback({ kind: "error", message: failed.message, validationErrors: failed.validationErrors });
    } catch {
      setFeedback({ kind: "error", message: "邀請暫時無法送出，請稍後再試。" });
    } finally {
      setIsConfirming(false);
      setIsSubmitting(false);
    }
  }

  const feedbackBanner = feedback ? (
    <div
      aria-live="polite"
      className={
        feedback.kind === "success"
          ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
          : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
      }
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      <p>{feedback.message}</p>
      {feedback.validationErrors && feedback.validationErrors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {feedback.validationErrors.map((error) => (
            <li key={`${error.field}-${error.message}`}>
              <button
                className="text-left underline underline-offset-4"
                onClick={() => focusField(FIELD_ANCHORS[error.field] ?? FIELD_ANCHORS.title)}
                type="button"
              >
                {error.message}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ) : null;

  const readiness = isReadyToSubmit ? (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
      必要資料都填好了，可以送出邀請給老師確認。
    </div>
  ) : (
    <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
      <span className="font-medium">還缺 {missing.length} 項才能送出邀請：</span>
      {missing.map((item, index) => (
        <span key={item.anchor}>
          {index > 0 ? "、" : null}
          <button className="underline underline-offset-4" onClick={() => focusField(item.anchor)} type="button">
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );

  const confirmation = isConfirming ? (
    <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
      <p className="font-medium text-ink">{isSelfTeaching ? "確認由你自己授課" : "確認送出合作邀請"}</p>
      <dl className="mt-2 grid gap-1 text-ink [overflow-wrap:anywhere]">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">團體</dt>
          <dd>{selectedOrganization?.name ?? "尚未選擇"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">老師</dt>
          <dd>{teacher?.displayName ?? "尚未選擇"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">時間</dt>
          <dd>
            {formatLocalDatetime(values.startAt)} – {formatLocalDatetime(values.endAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-2">
        {isSelfTeaching
          ? "確認後這個時段會保留給這堂課（會檢查你自己的課表是否衝突），接著就能開放報名。"
          : "送出後會請老師確認這份安排；老師確認前還不會保留老師的時間，也還不能開放報名。"}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
          disabled={isBusy}
          onClick={handleSubmit}
          type="button"
        >
          {isSubmitting ? "正在送出..." : isSelfTeaching ? "確認由我授課" : "確認送出邀請"}
        </button>
        <button
          className="rounded-full border border-clay/40 bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:text-ink-faint"
          disabled={isBusy}
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          先回來調整
        </button>
      </div>
    </div>
  ) : null;

  // 票 07：依狀態顯示對應的操作。pending 修改後仍等老師確認；declined／confirmed 修改會回到草稿。
  const statusPill: Record<EditableProposalStatus, string> = {
    draft: "草稿",
    pending_confirmation: "等待老師確認",
    declined: "老師已婉拒",
    confirmed: "老師已確認",
  };
  const saveLabel: Record<EditableProposalStatus, string> = {
    draft: "儲存草稿",
    pending_confirmation: "儲存並更新邀請",
    declined: "儲存為草稿",
    confirmed: "儲存為草稿（確認失效）",
  };
  const actionBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-ink/12 bg-white px-4 py-2.5">
      <span className="w-fit rounded-full bg-sage px-3 py-1 text-xs font-medium text-pine">{statusPill[status]}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine disabled:cursor-not-allowed disabled:border-ink/15 disabled:text-ink-faint"
          disabled={isBusy || (status === "pending_confirmation" && !isSelfTeaching && !isReadyToSubmit)}
          onClick={() => handleSave()}
          type="button"
        >
          {isSaving
            ? "正在儲存..."
            : status === "pending_confirmation" && isSelfTeaching
              ? "儲存並改由我授課"
              : saveLabel[status]}
        </button>
        {status === "pending_confirmation" ? null : (
          <button
            className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft"
            disabled={isBusy || !isReadyToSubmit}
            onClick={() => {
              setFeedback(null);
              setIsConfirming(true);
            }}
            type="button"
          >
            {isSubmitting
              ? "正在送出..."
              : isSelfTeaching
                ? "由我授課並確認"
                : status === "draft"
                  ? "送出邀請"
                  : "修改並重新邀請"}
          </button>
        )}
      </div>
    </div>
  );

  const statusNotice =
    status === "pending_confirmation" ? (
      <p className="rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm leading-6 text-ink-soft">
        老師正在確認這份邀請。儲存修改後，老師會看到最新的內容並需要重新確認；老師之前開著的舊頁面無法再確認舊內容。
      </p>
    ) : status === "confirmed" ? (
      <p className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
        老師已確認這份安排。修改內容會讓老師的確認失效、釋放已保留的時段，邀請回到草稿，需要再送出給老師確認一次。
      </p>
    ) : status === "declined" ? (
      <p className="rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
        老師婉拒了這份邀請{declineReason ? `，原因：${declineReason}` : ""}。調整內容後可以重新邀請，或撤回後另外安排。
      </p>
    ) : null;

  const statusArea = isConfirming ? confirmation : (
    <>
      {readiness}
      {feedbackBanner}
    </>
  );

  return (
    <div className="grid gap-6">
      {actionBar}
      {statusNotice}
      {statusArea}

      <Section legend="團體與老師">
        <div className="grid gap-3" id={FIELD_ANCHORS.organization}>
          <label className="block text-sm">
            <span className="font-medium text-ink">為哪個團體開團</span>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              {organizationLocked
                ? "這份邀請送出過，不能再更換團體；需要換團體請撤回後另外建立。"
                : "課程會掛在這個團體名下，老師與平台看到的聯絡方式也來自這個團體。送出後就不能再換團體。"}
            </p>
            <select
              className={inputClassName}
              disabled={isBusy || organizationLocked}
              onChange={(event) => update("organizationId", event.target.value)}
              value={values.organizationId}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}（{organization.typeLabel}）
                </option>
              ))}
            </select>
          </label>
          {selectedOrganization && selectedOrganization.isContactComplete && !organizationLocked ? (
            <button
              className="w-fit text-sm font-medium text-pine underline underline-offset-4 disabled:cursor-not-allowed disabled:text-ink-faint"
              disabled={isBusy}
              onClick={() =>
                handleSave(
                  (savedId) =>
                    `/organizer/organizations/${selectedOrganization.id}?returnTo=${encodeURIComponent(`/organizer/class-proposals/${savedId}/edit`)}`,
                )
              }
              type="button"
            >
              儲存草稿並編輯團體資料
            </button>
          ) : null}
          {selectedOrganization && !selectedOrganization.isContactComplete ? (
            <div
              className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep [overflow-wrap:anywhere]"
              role="status"
            >
              送出邀請前，需要先補齊「{selectedOrganization.name}」的聯絡資料。草稿會先幫你存好，補完會回到這裡。
              <div className="mt-2">
                <button
                  className="rounded-full border border-clay/40 bg-white px-4 py-1.5 text-sm font-medium text-clay-deep disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() =>
                    handleSave(
                      (savedId) =>
                        `/organizer/organizations/${selectedOrganization.id}?returnTo=${encodeURIComponent(`/organizer/class-proposals/${savedId}/edit`)}`,
                    )
                  }
                  type="button"
                >
                  儲存草稿並補齊聯絡資料
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3" id={FIELD_ANCHORS.teacherProfileId}>
          <span className="text-sm font-medium text-ink">授課老師</span>
          <p className="-mt-2 text-xs leading-5 text-ink-soft">
            只能邀請平台上已通過審核的老師；老師會收到邀請並親自確認。
          </p>
          {teacher ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pine/30 bg-pine-tint px-4 py-3">
              <TeacherCardSummary card={teacher} isSelf={teacher.teacherProfileId === selfTeacherProfileId} />
              <button
                className="text-sm font-medium text-pine underline underline-offset-4 disabled:text-ink-faint"
                disabled={isBusy}
                onClick={() => {
                  setTeacher(null);
                  update("teacherProfileId", null);
                }}
                type="button"
              >
                更換老師
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="block flex-1 text-sm">
                  <span className="sr-only">搜尋老師名稱</span>
                  <input
                    className={inputClassName}
                    disabled={isBusy}
                    onChange={(event) => setTeacherQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSearchTeachers();
                      }
                    }}
                    placeholder="輸入老師的顯示名稱"
                    type="search"
                    value={teacherQuery}
                  />
                </label>
                <button
                  className="rounded-full border border-pine/40 px-4 py-2 text-sm font-medium text-pine disabled:cursor-not-allowed disabled:text-ink-faint sm:mt-2 sm:self-start"
                  disabled={isBusy || isSearching}
                  onClick={() => void handleSearchTeachers()}
                  type="button"
                >
                  {isSearching ? "搜尋中..." : "搜尋老師"}
                </button>
              </div>
              {teacherResults !== null ? (
                teacherResults.length === 0 ? (
                  <p aria-live="polite" className="text-sm text-ink-soft">
                    找不到符合的老師，可以換個名稱再試。
                  </p>
                ) : (
                  <ul aria-label="可邀請的老師" aria-live="polite" className="grid gap-2">
                    {teacherResults.map((card) => (
                      <li key={card.teacherProfileId}>
                        <button
                          className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-left transition hover:border-pine/40 disabled:cursor-not-allowed"
                          disabled={isBusy}
                          onClick={() => {
                            setTeacher(card);
                            update("teacherProfileId", card.teacherProfileId);
                          }}
                          type="button"
                        >
                          <TeacherCardSummary card={card} isSelf={card.teacherProfileId === selfTeacherProfileId} />
                          <span className="mt-1 block text-xs font-medium text-pine">選擇這位老師</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          )}
        </div>
      </Section>

      <Section legend="課程安排">
        <Field anchor={FIELD_ANCHORS.title} hint={`${TITLE_MAX_LENGTH} 字以內。`} label="課程名稱">
          <input
            className={inputClassName}
            disabled={isBusy}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(event) => update("title", event.target.value)}
            placeholder="例如：週三晚間員工紓壓瑜伽"
            type="text"
            value={values.title}
          />
        </Field>
        <div id={FIELD_ANCHORS.serviceTypes}>
          <span className="text-sm font-medium text-ink">課程風格</span>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            最多選 {MAX_SERVICE_TYPES} 項（已選 {values.serviceTypes.length}／{MAX_SERVICE_TYPES}）。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SERVICE_TYPES.map((serviceType) => {
              const checked = values.serviceTypes.includes(serviceType);
              return (
                <TagCheckbox
                  checked={checked}
                  disabled={isBusy || (!checked && values.serviceTypes.length >= MAX_SERVICE_TYPES)}
                  key={serviceType}
                  label={serviceType}
                  onChange={() => toggleServiceType(serviceType)}
                />
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field anchor={FIELD_ANCHORS.startAt} hint="台灣時間。" label="開始時間">
            <input
              className={inputClassName}
              disabled={isBusy}
              onChange={(event) => update("startAt", event.target.value)}
              type="datetime-local"
              value={values.startAt}
            />
          </Field>
          <Field anchor={FIELD_ANCHORS.endAt} hint="台灣時間，須晚於開始時間。" label="結束時間">
            <input
              className={inputClassName}
              disabled={isBusy}
              onChange={(event) => update("endAt", event.target.value)}
              type="datetime-local"
              value={values.endAt}
            />
          </Field>
        </div>
        <Field anchor={FIELD_ANCHORS.location} hint={`${LOCATION_MAX_LENGTH} 字以內。`} label="地點">
          <input
            className={inputClassName}
            disabled={isBusy}
            maxLength={LOCATION_MAX_LENGTH}
            onChange={(event) => update("location", event.target.value)}
            placeholder="例如：台北市信義區松仁路 100 號 5 樓教室"
            type="text"
            value={values.location}
          />
        </Field>
        <Field anchor={FIELD_ANCHORS.capacity} hint={`${CAPACITY_MIN}–${CAPACITY_MAX} 人。`} label="名額">
          <input
            className={inputClassName}
            disabled={isBusy}
            inputMode="numeric"
            onChange={(event) => update("capacity", event.target.value)}
            type="text"
            value={values.capacity}
          />
        </Field>
        <Field anchor={FIELD_ANCHORS.description} hint={`選填，${DESCRIPTION_MAX_LENGTH} 字以內。`} label="課程說明">
          <textarea
            className={`${inputClassName} min-h-28`}
            disabled={isBusy}
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(event) => update("description", event.target.value)}
            value={values.description}
          />
        </Field>
      </Section>

      <Section legend="招募設定">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
          <input
            checked={values.isPublic}
            className="mt-1 size-4 accent-pine disabled:cursor-not-allowed"
            disabled={isBusy}
            onChange={(event) => update("isPublic", event.target.checked)}
            type="checkbox"
          />
          <span>
            同時公開在課程列表
            <span className="mt-1 block text-xs leading-5 text-ink-soft">
              不勾選時只透過分享連結招募：課程不會出現在公開列表，收到連結的人登入後就能查看與報名。連結可以轉傳，這個設定不代表只限公司或社團成員。
            </span>
          </span>
        </label>
      </Section>

      {actionBar}
      {statusArea}
    </div>
  );
}

function TeacherCardSummary({ card, isSelf = false }: { card: ProposalTeacherCard; isSelf?: boolean }) {
  return (
    <span className="block min-w-0 [overflow-wrap:anywhere]">
      <span className="block text-sm font-medium text-ink">
        {card.displayName}
        {isSelf ? <span className="ml-2 rounded-full bg-sage px-2 py-0.5 text-xs text-pine">你自己</span> : null}
      </span>
      <span className="mt-0.5 block text-xs leading-5 text-ink-soft">
        {[card.specialties.slice(0, 3).join("、"), card.serviceAreas.slice(0, 3).join("、")]
          .filter(Boolean)
          .join("｜") || "尚未填寫擅長類型與服務地區"}
      </span>
    </span>
  );
}

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6">
      <legend className="px-1 text-base font-semibold text-ink">{legend}</legend>
      {children}
    </fieldset>
  );
}

// 欄位名稱只放在 <label>，說明文字用 aria-describedby 連結，避免說明裡的字（例如「須晚於開始時間」）
// 變成欄位名稱的一部分，讓螢幕閱讀器與測試都能明確分辨每個欄位。
function Field({
  anchor,
  label,
  hint,
  children,
}: {
  anchor: string;
  label: string;
  hint?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  return (
    <div className="text-sm" id={anchor}>
      <label className="block font-medium text-ink" htmlFor={inputId}>
        {label}
      </label>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-ink-soft" id={hintId}>
          {hint}
        </p>
      ) : null}
      {cloneElement(children, { id: inputId, "aria-describedby": hint ? hintId : undefined })}
    </div>
  );
}
