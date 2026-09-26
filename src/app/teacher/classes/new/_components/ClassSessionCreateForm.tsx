"use client";

import { useState, type FormEvent } from "react";

import { TagCheckbox } from "@/app/_components/tag-checkbox";
import { SPECIALTY_GROUPS } from "@/app/teachers/join/_lib/application-fields";
import {
  MAX_SERVICE_TYPES,
  SERVICE_TYPES,
  UNDECIDED_SERVICE_TYPE,
} from "@/domain/demand-request/service-types";

import { MultiMonthDatePicker } from "./MultiMonthDatePicker";
import { createOwnClassSessionAction } from "../actions";
import { createOwnRecurringClassSeriesAction } from "../recurring-actions";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type Mode = "single" | "weekly" | "fixed_dates";

const modeOptions: { value: Mode; label: string }[] = [
  { value: "single", label: "單堂" },
  { value: "weekly", label: "常規（每週固定星期）" },
  { value: "fixed_dates", label: "固定期（明確日期清單）" },
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";
const labelClassName = "text-sm font-medium text-ink";
const submitButtonClassName =
  "w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto";

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
  dayOfWeek: string; // 常規：星期幾
  startDate: string; // 常規：選填的起始日期
  generateCount: string; // 常規：首次生成場次
  fixedDates: string[]; // 固定期：已選的日期清單（YYYY-MM-DD，已排序）
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

// teacher-initiated-open-classes Slice B：三個模式各自是獨立的 <form>，每個 form 的 action 一律綁定
// 固定的 Server Action 參考——不在提交當下動態決定要呼叫哪個 function。
// 共用欄位的內容存在這裡的 state，各 form 只是顯示與修改同一份資料，所以切換模式不會清掉。
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
  const [showYogaStylesError, setShowYogaStylesError] = useState(false);
  const [showServiceTypesError, setShowServiceTypesError] = useState(false);
  const [showFixedDatesError, setShowFixedDatesError] = useState(false);

  function updateShared<K extends keyof SharedFields>(
    key: K,
    value: SharedFields[K],
  ) {
    setShared((current) => ({ ...current, [key]: value }));
  }

  function updateModeField<K extends keyof ModeFields>(
    key: K,
    value: ModeFields[K],
  ) {
    setModeFields((current) => ({ ...current, [key]: value }));
  }

  const startTimeString = toTimeString(shared.startTime);
  const endTimeString = toTimeString(shared.endTime);
  const isEndNotAfterStart =
    startTimeString !== "" &&
    endTimeString !== "" &&
    endTimeString <= startTimeString;

  const sharedFieldProps = { shared, updateShared };
  const hasYogaStyle =
    shared.yogaStyles.length > 0 || shared.yogaStylesOther.trim().length > 0;

  const hasServiceType = shared.serviceTypes.length > 0;
  // 常規課程：起始日期必須剛好是選定的星期幾（例如選週一，起始日期就要是某個週一）。
  const startDateWeekday = modeFields.startDate
    ? weekdayOfDateString(modeFields.startDate)
    : null;
  const isStartDateWeekdayMismatch =
    startDateWeekday !== null &&
    modeFields.dayOfWeek !== "" &&
    startDateWeekday !== Number(modeFields.dayOfWeek);

  // 課程風格、瑜伽類型都必填，但「勾選標籤（或填其他）至少一項」沒辦法用瀏覽器內建的 required 表達，
  // 所以在送出前自己擋一次（後端也會再驗證一次）。固定期還要至少加入一個日期。
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
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="課程排程模式">
        {modeOptions.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className={
              mode === option.value
                ? "rounded-full bg-pine px-4 py-2 text-sm font-medium text-white"
                : "rounded-full border border-ink/25 px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink/40"
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
          action={createOwnClassSessionAction}
          className="grid gap-4"
          onSubmit={guardRequiredTags}
        >
          <TitleField {...sharedFieldProps} />
          <ServiceTypesField {...serviceTypesFieldProps} />
          <YogaStylesField {...yogaStylesFieldProps} />
          <div>
            <label className={labelClassName} htmlFor="single-date">
              上課日期
            </label>
            <input
              className={inputClassName}
              id="single-date"
              onChange={(event) => updateModeField("date", event.target.value)}
              required
              type="date"
              value={modeFields.date}
            />
          </div>
          <TimeRangeFields
            {...sharedFieldProps}
            endName="endAt"
            endValueForForm={
              modeFields.date && endTimeString
                ? `${modeFields.date}T${endTimeString}`
                : ""
            }
            idPrefix="single-"
            isEndNotAfterStart={isEndNotAfterStart}
            startName="startAt"
            startValueForForm={
              modeFields.date && startTimeString
                ? `${modeFields.date}T${startTimeString}`
                : ""
            }
          />
          <LocationField {...sharedFieldProps} />
          <CapacityField {...sharedFieldProps} />
          <DescriptionField {...sharedFieldProps} />
          <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
            <input
              checked={shared.isPublic}
              className="mt-1 shrink-0"
              name="isPublic"
              onChange={(event) => updateShared("isPublic", event.target.checked)}
              type="checkbox"
              value="yes"
            />
            公開這堂課，讓其他人可以在瀏覽頁面看到並直接報名
          </label>
          <RequiresApprovalField {...sharedFieldProps} />
          <ConfirmField />
          <button className={submitButtonClassName} type="submit">
            建立課程
          </button>
        </form>
      ) : null}

      {mode === "weekly" ? (
        <form
          action={createOwnRecurringClassSeriesAction}
          className="grid gap-4"
          onSubmit={guardRequiredTags}
        >
          <input name="mode" type="hidden" value="weekly" />
          <TitleField {...sharedFieldProps} idPrefix="weekly-" />
          <ServiceTypesField {...serviceTypesFieldProps} idPrefix="weekly-" />
          <YogaStylesField {...yogaStylesFieldProps} idPrefix="weekly-" />
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
                起始日期 {modeFields.startDate} 是{dayOfWeekLabels[startDateWeekday]}，跟上面選的
                {dayOfWeekLabels[Number(modeFields.dayOfWeek)]}不同。請改選一個
                {dayOfWeekLabels[Number(modeFields.dayOfWeek)]}，或把星期幾改成
                {dayOfWeekLabels[startDateWeekday]}。
              </p>
            ) : null}
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
          <DescriptionField {...sharedFieldProps} idPrefix="weekly-" />
          <RequiresApprovalField {...sharedFieldProps} idPrefix="weekly-" />
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
          <ConfirmField idPrefix="weekly-" />
          <button className={submitButtonClassName} type="submit">
            建立課程系列
          </button>
        </form>
      ) : null}

      {mode === "fixed_dates" ? (
        <form
          action={createOwnRecurringClassSeriesAction}
          className="grid gap-4"
          onSubmit={guardRequiredTags}
        >
          <input name="mode" type="hidden" value="fixed_dates" />
          <TitleField {...sharedFieldProps} idPrefix="fixed-" />
          <ServiceTypesField {...serviceTypesFieldProps} idPrefix="fixed-" />
          <YogaStylesField {...yogaStylesFieldProps} idPrefix="fixed-" />
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
          <DescriptionField {...sharedFieldProps} idPrefix="fixed-" />
          <RequiresApprovalField {...sharedFieldProps} idPrefix="fixed-" />
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
          <ConfirmField idPrefix="fixed-" />
          <button className={submitButtonClassName} type="submit">
            建立課程系列
          </button>
        </form>
      ) : null}
    </div>
  );
}

type FieldProps = {
  idPrefix?: string;
  shared: SharedFields;
  updateShared: <K extends keyof SharedFields>(
    key: K,
    value: SharedFields[K],
  ) => void;
};

function TitleField({ idPrefix = "", shared, updateShared }: FieldProps) {
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
      />
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
}: FieldProps & { showError: boolean }) {
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

// YYYY-MM-DD 是星期幾（0＝週日）。只看日曆日期本身，不經過時區換算。
function weekdayOfDateString(date: string): number | null {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatDateWithWeekday(date: string) {
  const weekday = weekdayOfDateString(date);

  return weekday === null ? date : `${date}（${dayOfWeekLabels[weekday]}）`;
}

const YOGA_STYLE_OPTIONS = SPECIALTY_GROUPS.flatMap((group) => group.options);

// 這堂課是哪種瑜伽：標籤與老師「擅長類型」同一組，可多選，找不到的填「其他」。
// 送出時勾選的標籤用多個 name="yogaStyles" 的隱藏欄位帶出，「其他」是 name="yogaStylesOther"。
function YogaStylesField({
  idPrefix = "",
  shared,
  updateShared,
  showError,
}: FieldProps & { showError: boolean }) {
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
    </div>
  );
}

function LocationField({ idPrefix = "", shared, updateShared }: FieldProps) {
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
      />
    </div>
  );
}

function CapacityField({ idPrefix = "", shared, updateShared }: FieldProps) {
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
      />
    </div>
  );
}

function DescriptionField({ idPrefix = "", shared, updateShared }: FieldProps) {
  return (
    <div>
      <label className={labelClassName} htmlFor={`${idPrefix}description`}>
        課程說明（選填）
      </label>
      <textarea
        className={`${inputClassName} min-h-24`}
        id={`${idPrefix}description`}
        maxLength={2000}
        name="description"
        onChange={(event) => updateShared("description", event.target.value)}
        placeholder="向可能報名的學員說明這堂課的重點。"
        value={shared.description}
      />
    </div>
  );
}

function RequiresApprovalField({
  idPrefix = "",
  shared,
  updateShared,
}: FieldProps) {
  return (
    <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
      <input
        checked={shared.requiresApproval}
        className="mt-1 shrink-0"
        id={`${idPrefix}requiresApproval`}
        name="requiresApproval"
        onChange={(event) =>
          updateShared("requiresApproval", event.target.checked)
        }
        type="checkbox"
        value="yes"
      />
      需要我確認才算報名成功（不勾選則報名送出即成立，跟公開瀏覽的匿名報名者互動時可以保留篩選權）
    </label>
  );
}

// 「我確認以上資訊無誤」刻意不跨模式保留：換了排程方式後，要重新確認一次。
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
