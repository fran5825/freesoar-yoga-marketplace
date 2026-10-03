"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { TagCheckbox } from "@/app/_components/tag-checkbox";
import { SPECIALTY_GROUPS } from "@/app/teachers/join/_lib/application-fields";
import {
  MAX_SERVICE_TYPES,
  SERVICE_TYPES,
  UNDECIDED_SERVICE_TYPE,
} from "@/domain/demand-request/service-types";

import { ClassCreateSummary } from "./ClassCreateSummary";
import { MultiMonthDatePicker } from "./MultiMonthDatePicker";
import { createOwnClassSessionAction } from "../actions";
import {
  CREATE_CLASS_FIELD_ORDER,
  dayOfWeekLabel,
  formatDateWithWeekday,
  initialCreateClassFormState,
  weekdayOfDateString,
  type CreateClassFormField,
  type CreateClassFormState,
} from "../_lib/form-state";
import { useUnsavedChangesWarning } from "../_lib/use-unsaved-changes";
import { createOwnRecurringClassSeriesAction } from "../recurring-actions";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type Mode = "single" | "weekly" | "fixed_dates";

const modeOptions: { value: Mode; label: string }[] = [
  { value: "single", label: "單堂" },
  { value: "weekly", label: "每週固定" },
  { value: "fixed_dates", label: "指定日期" },
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 aria-[invalid=true]:border-clay";
const labelClassName = "text-sm font-medium text-ink";
const submitButtonClassName =
  "min-h-11 w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep disabled:cursor-wait disabled:opacity-70 sm:w-auto";

// 時間用「時」「分」兩個下拉選單，一律 24 小時制（00–23）。原生 <input type="time"> 的顯示方式跟隨
// 使用者電腦的語言設定，網頁端沒辦法強制 24 小時，中午 12 點會分不清上午或下午。
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

type TimeValue = { hour: string; minute: string };

const emptyTime: TimeValue = { hour: "", minute: "" };

function toTimeString(time: TimeValue) {
  return time.hour && time.minute ? `${time.hour}:${time.minute}` : "";
}

// 三個模式共用的欄位狀態放在最外層：切換模式時，已經填的內容會帶到下一個模式，不會被清掉。
type SharedFields = {
  title: string;
  serviceTypes: string[]; // 課程風格（可多選，最多 3 個）
  yogaStyles: string[]; // 勾選的瑜伽類型標籤
  yogaStylesOther: string; // 「其他」自訂文字
  startTime: TimeValue;
  endTime: TimeValue;
  location: string;
  capacity: string;
  description: string;
  requiresApproval: boolean;
  isPublic: boolean;
};

type ModeFields = {
  date: string; // 單堂：上課日期
  dayOfWeek: string; // 每週固定：星期幾
  startDate: string; // 每週固定：選填的起始日期
  generateCount: string; // 每週固定：首次生成場次
  fixedDates: string[]; // 指定日期：已選的日期清單（YYYY-MM-DD，已排序）
};

const initialShared: SharedFields = {
  title: "",
  serviceTypes: [],
  yogaStyles: [],
  yogaStylesOther: "",
  startTime: emptyTime,
  endTime: emptyTime,
  location: "",
  capacity: "",
  description: "",
  requiresApproval: false,
  isPublic: false,
};

const initialModeFields: ModeFields = {
  date: "",
  dayOfWeek: "",
  startDate: "",
  generateCount: "8",
  fixedDates: [],
};

// 改了哪個共用欄位，就算使用者已經在修正哪個欄位的錯誤（錯誤提示隨之收起）。
const sharedKeyToErrorField: Record<keyof SharedFields, CreateClassFormField | null> = {
  title: "title",
  serviceTypes: "serviceTypes",
  yogaStyles: "yogaStyles",
  yogaStylesOther: "yogaStyles",
  startTime: "time",
  endTime: "time",
  location: "location",
  capacity: "capacity",
  description: "description",
  requiresApproval: null,
  isPublic: null,
};

// 錯誤時要把焦點帶去的元素（單堂表單）。fieldset 本身不能聚焦，會改聚焦裡面第一個可操作的欄位。
const errorFieldElementId: Record<CreateClassFormField, string> = {
  title: "title",
  serviceTypes: "service-types-field",
  yogaStyles: "yoga-styles-field",
  description: "description",
  date: "single-date",
  time: "single-startTime-hour",
  location: "location",
  capacity: "capacity",
};

type FieldErrors = Partial<Record<CreateClassFormField, string[]>>;

// teacher-initiated-open-classes Slice B：三個模式各自是獨立的 <form>，每個 form 的 action 一律綁定
// 固定的 Server Action 參考——不在提交當下動態決定要呼叫哪個 function。
// 共用欄位的內容存在這裡的 state，各 form 只是顯示與修改同一份資料，所以切換模式不會清掉。
// teacher-usability-redesign 票 01：改成「課程內容／時間地點／報名設定」三區；單堂加建立前核對摘要，
// 送出失敗由 Server Action 回傳結果（useActionState），留在原頁、保留輸入與摘要。
export function ClassSessionCreateForm({
  defaults,
}: {
  // 老師最近一次自己建立的課的地點、名額、是否需確認報名；沒建過課時是 null。
  defaults: { location: string; capacity: number; requiresApproval: boolean } | null;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [shared, setShared] = useState<SharedFields>(() =>
    defaults
      ? {
          ...initialShared,
          location: defaults.location,
          capacity: String(defaults.capacity),
          requiresApproval: defaults.requiresApproval,
        }
      : initialShared,
  );
  const [modeFields, setModeFields] = useState<ModeFields>(initialModeFields);
  // 載入時的內容（含帶入的上次設定）：跟它一樣就不算使用者改過，不跳離頁提醒。
  const [initialSnapshot] = useState(() => JSON.stringify({ shared, modeFields }));
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [showYogaStylesError, setShowYogaStylesError] = useState(false);
  const [showServiceTypesError, setShowServiceTypesError] = useState(false);
  const [showFixedDatesError, setShowFixedDatesError] = useState(false);

  const [singleFormState, singleFormAction, isSinglePending] = useActionState(
    createOwnClassSessionAction,
    initialCreateClassFormState,
  );
  // 送出後使用者動過的欄位：該欄位的錯誤提示先收起，避免修正後還掛著舊錯誤。
  const [editedFields, setEditedFields] = useState<CreateClassFormField[]>([]);
  const [lastSingleFormState, setLastSingleFormState] =
    useState<CreateClassFormState>(singleFormState);

  if (lastSingleFormState !== singleFormState) {
    setLastSingleFormState(singleFormState);
    setEditedFields([]);

    // 課程說明有錯誤時展開收合區，才看得到錯誤、也才能聚焦。
    if (singleFormState.status === "error" && singleFormState.fieldErrors.description) {
      setDescriptionOpen(true);
    }
  }

  const isDirty = JSON.stringify({ shared, modeFields }) !== initialSnapshot;
  useUnsavedChangesWarning(isDirty && !isSinglePending);

  useEffect(() => {
    if (singleFormState.status !== "error") {
      return;
    }

    const firstField = CREATE_CLASS_FIELD_ORDER.find(
      (field) => (singleFormState.fieldErrors[field]?.length ?? 0) > 0,
    );

    // 等收合區展開後再聚焦；沒有對應欄位時聚焦錯誤摘要。
    requestAnimationFrame(() => {
      const target = firstField
        ? document.getElementById(errorFieldElementId[firstField])
        : document.getElementById("single-form-error");
      const focusable =
        target && target.matches("input, select, textarea, [tabindex]")
          ? target
          : target?.querySelector<HTMLElement>("input:not([disabled]), select, textarea");

      (focusable ?? target)?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [singleFormState]);

  function markEdited(field: CreateClassFormField | null) {
    if (field) {
      setEditedFields((current) => (current.includes(field) ? current : [...current, field]));
    }
  }

  function updateShared<K extends keyof SharedFields>(
    key: K,
    value: SharedFields[K],
  ) {
    setShared((current) => ({ ...current, [key]: value }));
    markEdited(sharedKeyToErrorField[key]);
  }

  function updateModeField<K extends keyof ModeFields>(
    key: K,
    value: ModeFields[K],
  ) {
    setModeFields((current) => ({ ...current, [key]: value }));

    // 時段衝突也可能靠改日期解決，所以改日期同時收起時間的錯誤。
    if (key === "date") {
      markEdited("date");
      markEdited("time");
    }
  }

  const singleFieldErrors: FieldErrors =
    singleFormState.status === "error"
      ? Object.fromEntries(
          Object.entries(singleFormState.fieldErrors).filter(
            ([field]) => !editedFields.includes(field as CreateClassFormField),
          ),
        )
      : {};

  const startTimeString = toTimeString(shared.startTime);
  const endTimeString = toTimeString(shared.endTime);
  const isEndNotAfterStart =
    startTimeString !== "" &&
    endTimeString !== "" &&
    endTimeString <= startTimeString;

  const sharedFieldProps = { shared, updateShared };
  const descriptionProps = {
    ...sharedFieldProps,
    open: descriptionOpen,
    onOpenChange: setDescriptionOpen,
  };
  const hasYogaStyle =
    shared.yogaStyles.length > 0 || shared.yogaStylesOther.trim().length > 0;

  const hasServiceType = shared.serviceTypes.length > 0;
  // 每週固定：起始日期必須剛好是選定的星期幾（例如選週一，起始日期就要是某個週一）。
  const startDateWeekday = modeFields.startDate
    ? weekdayOfDateString(modeFields.startDate)
    : null;
  const isStartDateWeekdayMismatch =
    startDateWeekday !== null &&
    modeFields.dayOfWeek !== "" &&
    startDateWeekday !== Number(modeFields.dayOfWeek);

  // 課程風格、瑜伽類型都必填，但「勾選標籤（或填其他）至少一項」沒辦法用瀏覽器內建的 required 表達，
  // 所以在送出前自己擋一次（後端也會再驗證一次）。指定日期還要至少加入一個日期。
  function guardRequiredTags(event: FormEvent<HTMLFormElement>) {
    let firstProblemId: string | null = null;

    if (!hasServiceType) {
      setShowServiceTypesError(true);
      firstProblemId = "service-types-field";
    }

    if (!hasYogaStyle) {
      setShowYogaStylesError(true);
      firstProblemId = firstProblemId ?? "yoga-styles-field";
    }

    if (mode === "fixed_dates" && modeFields.fixedDates.length === 0) {
      setShowFixedDatesError(true);
      firstProblemId = firstProblemId ?? "fixed-dates-field";
    }

    if (mode === "weekly" && isStartDateWeekdayMismatch) {
      firstProblemId = firstProblemId ?? "weekly-startDate";
    }

    if (!firstProblemId) {
      return;
    }

    event.preventDefault();
    document
      .getElementById(firstProblemId)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // 單堂：自己攔下送出再呼叫 action，而不是用 <form action>——後者在 action 回傳後會自動重設表單，
  // 勾選類欄位的畫面會被清掉。送出中不再送第二次（避免網路慢時重複點擊建立兩堂）；結果不明時也不自動重送。
  function handleSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSinglePending) {
      return;
    }

    guardRequiredTags(event);

    if (!hasServiceType || !hasYogaStyle) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(() => singleFormAction(formData));
  }

  const serviceTypesFieldProps = {
    ...sharedFieldProps,
    showError: showServiceTypesError && !hasServiceType,
  };
  const yogaStylesFieldProps = {
    ...sharedFieldProps,
    showError: showYogaStylesError && !hasYogaStyle,
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="課程排程方式">
        {modeOptions.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className={
              mode === option.value
                ? "min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white"
                : "min-h-11 rounded-full border border-ink/25 px-5 py-2 text-sm font-medium text-ink-soft hover:border-ink/40"
            }
            key={option.value}
            onClick={() => setMode(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="-mt-3 text-xs leading-5 text-ink-faint">
        切換排程方式時，已填的課程名稱、時間、地點等內容會保留。
        {defaults ? "地點、名額與報名確認方式已帶入你上一次開課的設定，可以直接修改。" : null}
      </p>

      {mode === "single" ? (
        <form
          aria-busy={isSinglePending}
          className="grid gap-6"
          onSubmit={handleSingleSubmit}
        >
          {singleFormState.status === "error" ? (
            <div
              className="rounded-xl border border-clay/40 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep"
              id="single-form-error"
              role="alert"
              tabIndex={-1}
            >
              <p className="font-medium">課程還沒建立：{singleFormState.message}</p>
              <p>你填的內容都還在，修正標示的欄位後再按一次「建立課程」。</p>
            </div>
          ) : null}
          <FormSection title="課程內容">
            <TitleField {...sharedFieldProps} error={singleFieldErrors.title} />
            <ServiceTypesField
              {...serviceTypesFieldProps}
              serverError={singleFieldErrors.serviceTypes}
            />
            <YogaStylesField {...yogaStylesFieldProps} serverError={singleFieldErrors.yogaStyles} />
            <DescriptionField {...descriptionProps} error={singleFieldErrors.description} />
          </FormSection>
          <FormSection title="時間地點">
            <div>
              <label className={labelClassName} htmlFor="single-date">
                上課日期
              </label>
              <input
                aria-describedby={singleFieldErrors.date ? "single-date-error" : undefined}
                aria-invalid={singleFieldErrors.date ? true : undefined}
                className={inputClassName}
                id="single-date"
                onChange={(event) => updateModeField("date", event.target.value)}
                required
                type="date"
                value={modeFields.date}
              />
              <FieldError id="single-date-error" messages={singleFieldErrors.date} />
            </div>
            <TimeRangeFields
              {...sharedFieldProps}
              endName="endAt"
              endValueForForm={
                modeFields.date && endTimeString
                  ? `${modeFields.date}T${endTimeString}`
                  : ""
              }
              error={singleFieldErrors.time}
              idPrefix="single-"
              isEndNotAfterStart={isEndNotAfterStart}
              startName="startAt"
              startValueForForm={
                modeFields.date && startTimeString
                  ? `${modeFields.date}T${startTimeString}`
                  : ""
              }
            />
            <LocationField {...sharedFieldProps} error={singleFieldErrors.location} />
            <CapacityField {...sharedFieldProps} error={singleFieldErrors.capacity} />
          </FormSection>
          <FormSection title="報名設定">
            <PublicListingField {...sharedFieldProps} />
            <RequiresApprovalField {...sharedFieldProps} />
          </FormSection>
          <ClassCreateSummary
            capacity={shared.capacity}
            date={modeFields.date}
            endTime={endTimeString}
            isPublic={shared.isPublic}
            location={shared.location}
            requiresApproval={shared.requiresApproval}
            startTime={startTimeString}
            title={shared.title}
          />
          <div>
            <button
              className={submitButtonClassName}
              disabled={isSinglePending}
              type="submit"
            >
              {isSinglePending ? "建立中…" : "建立課程"}
            </button>
            {isSinglePending ? (
              <p aria-live="polite" className="mt-2 text-xs leading-5 text-ink-faint">
                正在建立，請稍候，不需要再按一次。
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      {mode === "weekly" ? (
        <form
          action={createOwnRecurringClassSeriesAction}
          className="grid gap-6"
          onSubmit={guardRequiredTags}
        >
          <input name="mode" type="hidden" value="weekly" />
          <FormSection title="課程內容">
            <TitleField {...sharedFieldProps} idPrefix="weekly-" />
            <ServiceTypesField {...serviceTypesFieldProps} idPrefix="weekly-" />
            <YogaStylesField {...yogaStylesFieldProps} idPrefix="weekly-" />
            <DescriptionField {...descriptionProps} idPrefix="weekly-" />
          </FormSection>
          <FormSection title="時間地點">
            <div>
              <label className={labelClassName} htmlFor="weekly-dayOfWeek">
                星期幾
              </label>
              <select
                className={inputClassName}
                id="weekly-dayOfWeek"
                name="dayOfWeek"
                onChange={(event) => updateModeField("dayOfWeek", event.target.value)}
                required
                value={modeFields.dayOfWeek}
              >
                <option disabled value="">
                  請選擇星期幾
                </option>
                {dayOfWeekLabels.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName} htmlFor="weekly-startDate">
                起始日期（選填）
              </label>
              <input
                className={inputClassName}
                id="weekly-startDate"
                name="startDate"
                onChange={(event) => {
                  const value = event.target.value;
                  updateModeField("startDate", value);

                  // 還沒選星期幾時，直接用起始日期的星期幾，少一步。
                  if (value && modeFields.dayOfWeek === "") {
                    const weekday = weekdayOfDateString(value);

                    if (weekday !== null) {
                      updateModeField("dayOfWeek", String(weekday));
                    }
                  }
                }}
                type="date"
                value={modeFields.startDate}
              />
              <p className="mt-1 text-xs leading-5 text-ink-faint">
                第一堂課的日期，必須是上面選的星期幾；之後每週同一天生成。不填的話，從最近的下一個星期幾開始；起始日期需晚於今天。
              </p>
              {isStartDateWeekdayMismatch && startDateWeekday !== null ? (
                <p className="mt-2 text-sm leading-6 text-clay" role="alert">
                  起始日期 {modeFields.startDate} 是{dayOfWeekLabel(startDateWeekday)}，跟上面選的
                  {dayOfWeekLabel(Number(modeFields.dayOfWeek))}不同。請改選一個
                  {dayOfWeekLabel(Number(modeFields.dayOfWeek))}，或把星期幾改成
                  {dayOfWeekLabel(startDateWeekday)}。
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor="weekly-generateCount">
                首次要生成幾場
              </label>
              <input
                className={inputClassName}
                id="weekly-generateCount"
                max={26}
                min={1}
                name="generateCount"
                onChange={(event) =>
                  updateModeField("generateCount", event.target.value)
                }
                required
                type="number"
                value={modeFields.generateCount}
              />
              <p className="mt-1 text-xs leading-5 text-ink-faint">
                之後可以在系列管理頁手動生成更多場次，目前不支援自動無上限延伸。
              </p>
            </div>
            <TimeRangeFields
              {...sharedFieldProps}
              endName="endTime"
              endValueForForm={endTimeString}
              idPrefix="weekly-"
              isEndNotAfterStart={isEndNotAfterStart}
              startName="startTime"
              startValueForForm={startTimeString}
            />
            <LocationField {...sharedFieldProps} idPrefix="weekly-" />
            <CapacityField {...sharedFieldProps} idPrefix="weekly-" />
          </FormSection>
          <FormSection title="報名設定">
            <SeriesListingNote />
            <RequiresApprovalField {...sharedFieldProps} idPrefix="weekly-" />
          </FormSection>
          <ConfirmField idPrefix="weekly-" />
          <button className={submitButtonClassName} type="submit">
            建立課程系列
          </button>
        </form>
      ) : null}

      {mode === "fixed_dates" ? (
        <form
          action={createOwnRecurringClassSeriesAction}
          className="grid gap-6"
          onSubmit={guardRequiredTags}
        >
          <input name="mode" type="hidden" value="fixed_dates" />
          <FormSection title="課程內容">
            <TitleField {...sharedFieldProps} idPrefix="fixed-" />
            <ServiceTypesField {...serviceTypesFieldProps} idPrefix="fixed-" />
            <YogaStylesField {...yogaStylesFieldProps} idPrefix="fixed-" />
            <DescriptionField {...descriptionProps} idPrefix="fixed-" />
          </FormSection>
          <FormSection title="時間地點">
            <FixedDatesField
              dates={modeFields.fixedDates}
              onRemove={(date) =>
                updateModeField(
                  "fixedDates",
                  modeFields.fixedDates.filter((item) => item !== date),
                )
              }
              onToggle={(date) => {
                updateModeField(
                  "fixedDates",
                  modeFields.fixedDates.includes(date)
                    ? modeFields.fixedDates.filter((item) => item !== date)
                    : [...modeFields.fixedDates, date].sort(),
                );
                setShowFixedDatesError(false);
              }}
              showError={showFixedDatesError && modeFields.fixedDates.length === 0}
            />
            <TimeRangeFields
              {...sharedFieldProps}
              endName="endTime"
              endValueForForm={endTimeString}
              idPrefix="fixed-"
              isEndNotAfterStart={isEndNotAfterStart}
              startName="startTime"
              startValueForForm={startTimeString}
            />
            <LocationField {...sharedFieldProps} idPrefix="fixed-" />
            <CapacityField {...sharedFieldProps} idPrefix="fixed-" />
          </FormSection>
          <FormSection title="報名設定">
            <SeriesListingNote />
            <RequiresApprovalField {...sharedFieldProps} idPrefix="fixed-" />
          </FormSection>
          <ConfirmField idPrefix="fixed-" />
          <button className={submitButtonClassName} type="submit">
            建立課程系列
          </button>
        </form>
      ) : null}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-ink/10 pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <p className="mt-2 text-sm leading-6 text-clay" id={id}>
      {messages.join(" ")}
    </p>
  );
}

type FieldProps = {
  idPrefix?: string;
  shared: SharedFields;
  updateShared: <K extends keyof SharedFields>(
    key: K,
    value: SharedFields[K],
  ) => void;
  // 送出後服務回傳的欄位錯誤（目前只有單堂表單會帶）。
  error?: string[];
};

// 欄位有錯誤時，用 aria-invalid／aria-describedby 把錯誤文字跟欄位關聯起來，讀屏也聽得到。
function errorAttributes(errorId: string, error?: string[]) {
  return error && error.length > 0
    ? { "aria-invalid": true as const, "aria-describedby": errorId }
    : {};
}

function TitleField({ idPrefix = "", shared, updateShared, error }: FieldProps) {
  return (
    <div>
      <label className={labelClassName} htmlFor={`${idPrefix}title`}>
        課程名稱
      </label>
      <input
        className={inputClassName}
        id={`${idPrefix}title`}
        maxLength={200}
        name="title"
        onChange={(event) => updateShared("title", event.target.value)}
        required
        type="text"
        value={shared.title}
        {...errorAttributes(`${idPrefix}title-error`, error)}
      />
      <FieldError id={`${idPrefix}title-error`} messages={error} />
    </div>
  );
}

// 課程風格（原「課程類型」）：這堂課想帶給學員什麼感受，可多選最多 3 項，第一個勾選的是主要風格。
// 「還不確定，請老師建議」是團主需求才有的選項，老師建課不需要。
const SERVICE_TYPE_OPTIONS = SERVICE_TYPES.filter(
  (serviceType) => serviceType !== UNDECIDED_SERVICE_TYPE,
);

function ServiceTypesField({
  idPrefix = "",
  shared,
  updateShared,
  showError,
  serverError,
}: FieldProps & { showError: boolean; serverError?: string[] }) {
  function toggleServiceType(value: string) {
    if (shared.serviceTypes.includes(value)) {
      updateShared(
        "serviceTypes",
        shared.serviceTypes.filter((item) => item !== value),
      );
      return;
    }

    if (shared.serviceTypes.length >= MAX_SERVICE_TYPES) {
      return;
    }

    updateShared("serviceTypes", [...shared.serviceTypes, value]);
  }

  const isFull = shared.serviceTypes.length >= MAX_SERVICE_TYPES;

  return (
    <fieldset
      aria-describedby={`${idPrefix}service-types-help`}
      className="min-w-0"
      id="service-types-field"
    >
      <legend className={labelClassName}>
        課程風格（必填，可多選，最多 {MAX_SERVICE_TYPES} 項）
      </legend>
      <p
        className="mt-1 text-xs leading-5 text-ink-faint"
        id={`${idPrefix}service-types-help`}
      >
        這堂課的整體感覺與目的，例如放鬆紓壓、流汗活力。已選 {shared.serviceTypes.length} / {MAX_SERVICE_TYPES}。
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SERVICE_TYPE_OPTIONS.map((serviceType) => (
          <TagCheckbox
            checked={shared.serviceTypes.includes(serviceType)}
            disabled={isFull && !shared.serviceTypes.includes(serviceType)}
            key={serviceType}
            label={serviceType}
            onChange={() => toggleServiceType(serviceType)}
          />
        ))}
      </div>
      {shared.serviceTypes.map((value) => (
        <input key={value} name="serviceTypes" type="hidden" value={value} />
      ))}
      {showError ? (
        <p className="mt-2 text-sm leading-6 text-clay" role="alert">
          請至少選擇一種課程風格。
        </p>
      ) : null}
      <FieldError id={`${idPrefix}service-types-error`} messages={serverError} />
    </fieldset>
  );
}

const FIXED_DATES_MAX = 26;

// 固定期課程的日期：三個月的月曆直接點選多天（MultiMonthDatePicker），已選的日期列在下方可移除。
// 送出時用一個隱藏欄位（name="dates"，每行一個日期）帶出，格式與原本的文字清單相同。
function FixedDatesField({
  dates,
  onToggle,
  onRemove,
  showError,
}: {
  dates: string[];
  onToggle: (date: string) => void;
  onRemove: (date: string) => void;
  showError: boolean;
}) {
  return (
    <fieldset className="min-w-0" id="fixed-dates-field">
      <legend className={labelClassName}>
        上課日期（必填，至少 1 個，最多 {FIXED_DATES_MAX} 個）
      </legend>
      <p className="mt-1 text-xs leading-5 text-ink-faint">
        在月曆上點選要上課的日子，再點一次可以取消。已選 {dates.length} / {FIXED_DATES_MAX}。
      </p>
      <div className="mt-2">
        <MultiMonthDatePicker maxCount={FIXED_DATES_MAX} onToggle={onToggle} selected={dates} />
      </div>
      {dates.length > 0 ? (
        <ul aria-label="已加入的上課日期" className="mt-3 flex flex-wrap gap-2">
          {dates.map((date) => (
            <li
              className="flex items-center gap-2 rounded-full border border-pine/40 bg-pine-tint px-3 py-1.5 text-sm text-pine"
              key={date}
            >
              <span>{formatDateWithWeekday(date)}</span>
              <button
                aria-label={`移除 ${date}`}
                className="text-pine hover:text-clay"
                onClick={() => onRemove(date)}
                type="button"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">還沒有選任何日期。</p>
      )}
      <input name="dates" type="hidden" value={dates.join("\n")} />
      <p className="mt-2 text-xs leading-5 text-ink-faint">
        每一個日期都會用上面同一組開始／結束時間生成一場課程。
      </p>
      {showError ? (
        <p className="mt-2 text-sm leading-6 text-clay" role="alert">
          請至少選一個上課日期。
        </p>
      ) : null}
    </fieldset>
  );
}

const YOGA_STYLE_OPTIONS = SPECIALTY_GROUPS.flatMap((group) => group.options);

// 這堂課是哪種瑜伽：標籤與老師「擅長類型」同一組，可多選，找不到的填「其他」。
// 送出時勾選的標籤用多個 name="yogaStyles" 的隱藏欄位帶出，「其他」是 name="yogaStylesOther"。
function YogaStylesField({
  idPrefix = "",
  shared,
  updateShared,
  showError,
  serverError,
}: FieldProps & { showError: boolean; serverError?: string[] }) {
  function toggleStyle(value: string) {
    updateShared(
      "yogaStyles",
      shared.yogaStyles.includes(value)
        ? shared.yogaStyles.filter((item) => item !== value)
        : [...shared.yogaStyles, value],
    );
  }

  return (
    <fieldset
      aria-describedby={`${idPrefix}yoga-styles-help`}
      className="min-w-0"
      id="yoga-styles-field"
    >
      <legend className={labelClassName}>瑜伽類型（必填，可多選）</legend>
      <p
        className="mt-1 text-xs leading-5 text-ink-faint"
        id={`${idPrefix}yoga-styles-help`}
      >
        說明這堂課實際教的是哪種瑜伽，讓團主與學員一看就懂。找不到的請填在「其他」。
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {YOGA_STYLE_OPTIONS.map((option) => (
          <TagCheckbox
            checked={shared.yogaStyles.includes(option.value)}
            disabled={false}
            key={option.value}
            label={option.label}
            onChange={() => toggleStyle(option.value)}
          />
        ))}
      </div>
      {shared.yogaStyles.map((value) => (
        <input key={value} name="yogaStyles" type="hidden" value={value} />
      ))}
      <input
        aria-label="其他瑜伽類型"
        className={inputClassName}
        id={`${idPrefix}yoga-styles-other`}
        maxLength={200}
        name="yogaStylesOther"
        onChange={(event) => updateShared("yogaStylesOther", event.target.value)}
        placeholder="其他（可用頓號分隔多項，例如：亞歷山大技巧、脈輪流動）"
        type="text"
        value={shared.yogaStylesOther}
      />
      {showError ? (
        <p className="mt-2 text-sm leading-6 text-clay" role="alert">
          請至少選擇一種瑜伽類型，或在「其他」填寫。
        </p>
      ) : null}
      <FieldError id={`${idPrefix}yoga-styles-error`} messages={serverError} />
    </fieldset>
  );
}

function TimeSelect({
  id,
  label,
  value,
  onChange,
  name,
  valueForForm,
}: {
  id: string;
  label: string;
  value: TimeValue;
  onChange: (value: TimeValue) => void;
  name: string;
  valueForForm: string;
}) {
  return (
    <div aria-labelledby={`${id}-label`} role="group">
      <span className={labelClassName} id={`${id}-label`}>
        {label}
      </span>
      <div className="mt-2 flex items-center gap-2">
        <select
          aria-label={`${label}（時，24 小時制）`}
          className="w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
          id={`${id}-hour`}
          onChange={(event) => onChange({ ...value, hour: event.target.value })}
          required
          value={value.hour}
        >
          <option disabled value="">
            時
          </option>
          {HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="text-ink-soft">
          :
        </span>
        <select
          aria-label={`${label}（分）`}
          className="w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
          id={`${id}-minute`}
          onChange={(event) => onChange({ ...value, minute: event.target.value })}
          required
          value={value.minute}
        >
          <option disabled value="">
            分
          </option>
          {MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>
              {minute}
            </option>
          ))}
        </select>
      </div>
      {/* 送出給 Server Action 的值：單堂是 YYYY-MM-DDTHH:mm，系列是 HH:mm，格式與原本相同。 */}
      <input name={name} type="hidden" value={valueForForm} />
    </div>
  );
}

function TimeRangeFields({
  idPrefix = "",
  shared,
  updateShared,
  startName,
  endName,
  startValueForForm,
  endValueForForm,
  isEndNotAfterStart,
  error,
}: FieldProps & {
  startName: string;
  endName: string;
  startValueForForm: string;
  endValueForForm: string;
  isEndNotAfterStart: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <TimeSelect
          id={`${idPrefix}startTime`}
          label="開始時間"
          name={startName}
          onChange={(value) => updateShared("startTime", value)}
          value={shared.startTime}
          valueForForm={startValueForForm}
        />
        <TimeSelect
          id={`${idPrefix}endTime`}
          label="結束時間"
          name={endName}
          onChange={(value) => updateShared("endTime", value)}
          value={shared.endTime}
          valueForForm={endValueForForm}
        />
      </div>
      <p className="text-xs leading-5 text-ink-faint">
        時間為 24 小時制，例如 12:00 是中午、13:00 是下午一點。
      </p>
      {isEndNotAfterStart ? (
        <p className="text-sm leading-6 text-clay" role="alert">
          結束時間要晚於開始時間。
        </p>
      ) : null}
      <FieldError id={`${idPrefix}time-error`} messages={error} />
    </div>
  );
}

function LocationField({ idPrefix = "", shared, updateShared, error }: FieldProps) {
  return (
    <div>
      <label className={labelClassName} htmlFor={`${idPrefix}location`}>
        地點
      </label>
      <input
        className={inputClassName}
        id={`${idPrefix}location`}
        maxLength={200}
        name="location"
        onChange={(event) => updateShared("location", event.target.value)}
        placeholder="例如：台北市信義區 OO 大樓 3F"
        required
        type="text"
        value={shared.location}
        {...errorAttributes(`${idPrefix}location-error`, error)}
      />
      <FieldError id={`${idPrefix}location-error`} messages={error} />
    </div>
  );
}

function CapacityField({ idPrefix = "", shared, updateShared, error }: FieldProps) {
  return (
    <div>
      <label className={labelClassName} htmlFor={`${idPrefix}capacity`}>
        名額上限
      </label>
      <input
        className={inputClassName}
        id={`${idPrefix}capacity`}
        max={500}
        min={1}
        name="capacity"
        onChange={(event) => updateShared("capacity", event.target.value)}
        required
        type="number"
        value={shared.capacity}
        {...errorAttributes(`${idPrefix}capacity-error`, error)}
      />
      <FieldError id={`${idPrefix}capacity-error`} messages={error} />
    </div>
  );
}

// 課程說明是選填，預設收起；展開狀態跨模式共用，已填內容或送出錯誤時會展開。
// 收起時欄位仍在 <form> 裡，內容一樣會送出。
function DescriptionField({
  idPrefix = "",
  shared,
  updateShared,
  error,
  open,
  onOpenChange,
}: FieldProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <details
      className="rounded-xl border border-ink/15 px-4 py-1"
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      open={open || shared.description.length > 0}
    >
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">
        課程說明（選填）
        {!open && shared.description.length === 0 ? (
          <span className="ml-2 text-xs font-normal text-ink-faint">點開填寫</span>
        ) : null}
      </summary>
      <div className="pb-3">
        <textarea
          aria-label="課程說明（選填）"
          className={`${inputClassName} min-h-24`}
          id={`${idPrefix}description`}
          maxLength={2000}
          name="description"
          onChange={(event) => updateShared("description", event.target.value)}
          placeholder="向可能報名的學員說明這堂課的重點。"
          value={shared.description}
          {...errorAttributes(`${idPrefix}description-error`, error)}
        />
        <FieldError id={`${idPrefix}description-error`} messages={error} />
      </div>
    </details>
  );
}

// 二選一的設定（公開列表、報名方式）：用單選按鈕，整個選項卡片都可以點，觸控高度至少 44px。
function ChoiceOption({
  id,
  name,
  value,
  checked,
  onChange,
  title,
  description,
}: {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine/30 ${
        checked ? "border-pine bg-pine-tint" : "border-ink/20 hover:border-ink/40"
      }`}
      htmlFor={id}
    >
      <input
        checked={checked}
        className="mt-1.5 shrink-0 accent-pine"
        id={id}
        name={name}
        onChange={onChange}
        type="radio"
        value={value}
      />
      <span className="min-w-0">
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-ink-soft">{description}</span>
      </span>
    </label>
  );
}

// 單堂：是否列在公開課程列表。這跟課程狀態是兩件事——建立後仍是草稿，要另外按「開放報名」。
// 不列在公開列表 ≠ 私密：訪客瀏覽頁看不到，但拿到課程連結的學員登入後仍可查看與報名。
function PublicListingField({ idPrefix = "", shared, updateShared }: FieldProps) {
  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className={labelClassName}>是否列在公開課程列表</legend>
      <ChoiceOption
        checked={!shared.isPublic}
        description="訪客瀏覽頁不會列出；拿到課程連結的學員登入後仍可查看與報名。"
        id={`${idPrefix}isPublic-no`}
        name="isPublic"
        onChange={() => updateShared("isPublic", false)}
        title="不列在公開列表"
        value="no"
      />
      <ChoiceOption
        checked={shared.isPublic}
        description="開放報名後，任何人都能在「瀏覽課程」頁看到並報名。"
        id={`${idPrefix}isPublic-yes`}
        name="isPublic"
        onChange={() => updateShared("isPublic", true)}
        title="列在公開課程列表"
        value="yes"
      />
    </fieldset>
  );
}

// 系列場次目前一律不列在公開列表（既有限制），不提供無法生效的公開選項。
function SeriesListingNote() {
  return (
    <div className="rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm leading-6 text-ink-soft">
      <p className="font-medium text-ink">公開列表</p>
      <p>系列的場次目前不會列在公開課程列表；建立後每一場都是草稿，要逐堂開放報名。</p>
    </div>
  );
}

function RequiresApprovalField({
  idPrefix = "",
  shared,
  updateShared,
}: FieldProps) {
  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className={labelClassName}>報名方式</legend>
      <ChoiceOption
        checked={!shared.requiresApproval}
        description="學員送出報名就成立。"
        id={`${idPrefix}requiresApproval-no`}
        name="requiresApproval"
        onChange={() => updateShared("requiresApproval", false)}
        title="報名送出即成立"
        value="no"
      />
      <ChoiceOption
        checked={shared.requiresApproval}
        description="學員送出後要等你確認，適合想先了解學員狀況再收的課。"
        id={`${idPrefix}requiresApproval`}
        name="requiresApproval"
        onChange={() => updateShared("requiresApproval", true)}
        title="需要我確認才算報名成功"
        value="yes"
      />
    </fieldset>
  );
}

// 系列（每週固定／指定日期）暫時保留「我確認以上資訊無誤」勾選，票 02 再改成摘要。
// 刻意不跨模式保留：換了排程方式後，要重新確認一次。
function ConfirmField({ idPrefix = "" }: { idPrefix?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
      <input
        className="mt-1 shrink-0"
        id={`${idPrefix}confirmCreate`}
        name="confirmCreate"
        required
        type="checkbox"
        value="yes"
      />
      我確認以上資訊無誤，同意建立課程。
    </label>
  );
}
