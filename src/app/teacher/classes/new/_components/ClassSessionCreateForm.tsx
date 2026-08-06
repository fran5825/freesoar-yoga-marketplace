"use client";

import { useState } from "react";

import { SERVICE_TYPES } from "@/domain/demand-request/service-types";

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
  "mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const labelClassName = "text-sm font-medium text-gray-950";
const submitButtonClassName =
  "w-full rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto";

// teacher-initiated-open-classes Slice B：三個模式各自是獨立的 <form>，用 CSS 顯示/隱藏切換，
// 每個 form 的 action 一律綁定固定的 Server Action 參考——不在提交當下動態決定要呼叫哪個
// function，避免「使用者切換模式後表單殘留另一模式欄位」這種容易出錯的共用表單設計。
export function ClassSessionCreateForm() {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="課程排程模式">
        {modeOptions.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className={
              mode === option.value
                ? "rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white"
                : "rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
            }
            key={option.value}
            onClick={() => setMode(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "single" ? (
        <form action={createOwnClassSessionAction} className="grid gap-4">
          <TitleField />
          <ServiceTypeField />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClassName} htmlFor="startAt">
                開始時間
              </label>
              <input
                className={inputClassName}
                id="startAt"
                name="startAt"
                required
                type="datetime-local"
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor="endAt">
                結束時間
              </label>
              <input
                className={inputClassName}
                id="endAt"
                name="endAt"
                required
                type="datetime-local"
              />
            </div>
          </div>
          <LocationField />
          <CapacityField />
          <DescriptionField />
          <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
            <input className="mt-1 shrink-0" name="isPublic" type="checkbox" value="yes" />
            公開這堂課，讓其他人可以在瀏覽頁面看到並直接報名
          </label>
          <RequiresApprovalField />
          <ConfirmField />
          <button className={submitButtonClassName} type="submit">
            建立課程
          </button>
        </form>
      ) : null}

      {mode === "weekly" ? (
        <form action={createOwnRecurringClassSeriesAction} className="grid gap-4">
          <input name="mode" type="hidden" value="weekly" />
          <TitleField idPrefix="weekly-" />
          <ServiceTypeField idPrefix="weekly-" />
          <div>
            <label className={labelClassName} htmlFor="weekly-dayOfWeek">
              星期幾
            </label>
            <select
              className={inputClassName}
              defaultValue=""
              id="weekly-dayOfWeek"
              name="dayOfWeek"
              required
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
          <TimeRangeFields idPrefix="weekly-" />
          <LocationField idPrefix="weekly-" />
          <CapacityField idPrefix="weekly-" />
          <DescriptionField idPrefix="weekly-" />
          <RequiresApprovalField idPrefix="weekly-" />
          <div>
            <label className={labelClassName} htmlFor="weekly-generateCount">
              首次要生成幾場
            </label>
            <input
              className={inputClassName}
              defaultValue={8}
              id="weekly-generateCount"
              max={26}
              min={1}
              name="generateCount"
              required
              type="number"
            />
            <p className="mt-1 text-xs leading-5 text-gray-500">
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
        <form action={createOwnRecurringClassSeriesAction} className="grid gap-4">
          <input name="mode" type="hidden" value="fixed_dates" />
          <TitleField idPrefix="fixed-" />
          <ServiceTypeField idPrefix="fixed-" />
          <TimeRangeFields idPrefix="fixed-" />
          <LocationField idPrefix="fixed-" />
          <CapacityField idPrefix="fixed-" />
          <DescriptionField idPrefix="fixed-" />
          <RequiresApprovalField idPrefix="fixed-" />
          <div>
            <label className={labelClassName} htmlFor="fixed-dates">
              日期清單（每行一個日期，格式 YYYY-MM-DD）
            </label>
            <textarea
              className={`${inputClassName} min-h-32 font-mono`}
              id="fixed-dates"
              name="dates"
              placeholder={"2026-09-01\n2026-09-08\n2026-09-15\n2026-09-22"}
              required
            />
            <p className="mt-1 text-xs leading-5 text-gray-500">
              每一個日期都會用上面同一組開始/結束時間生成一場課程，最多 26 個日期。
            </p>
          </div>
          <ConfirmField idPrefix="fixed-" />
          <button className={submitButtonClassName} type="submit">
            建立課程系列
          </button>
        </form>
      ) : null}
    </div>
  );
}

function TitleField({ idPrefix = "" }: { idPrefix?: string }) {
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
        required
        type="text"
      />
    </div>
  );
}

function ServiceTypeField({ idPrefix = "" }: { idPrefix?: string }) {
  return (
    <div>
      <label className={labelClassName} htmlFor={`${idPrefix}serviceType`}>
        課程類型
      </label>
      <select
        className={inputClassName}
        defaultValue=""
        id={`${idPrefix}serviceType`}
        name="serviceType"
        required
      >
        <option disabled value="">
          請選擇課程類型
        </option>
        {SERVICE_TYPES.map((serviceType) => (
          <option key={serviceType} value={serviceType}>
            {serviceType}
          </option>
        ))}
      </select>
    </div>
  );
}

function TimeRangeFields({ idPrefix = "" }: { idPrefix?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClassName} htmlFor={`${idPrefix}startTime`}>
          開始時間
        </label>
        <input
          className={inputClassName}
          id={`${idPrefix}startTime`}
          name="startTime"
          required
          type="time"
        />
      </div>
      <div>
        <label className={labelClassName} htmlFor={`${idPrefix}endTime`}>
          結束時間
        </label>
        <input
          className={inputClassName}
          id={`${idPrefix}endTime`}
          name="endTime"
          required
          type="time"
        />
      </div>
    </div>
  );
}

function LocationField({ idPrefix = "" }: { idPrefix?: string }) {
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
        placeholder="例如：台北市信義區 OO 大樓 3F"
        required
        type="text"
      />
    </div>
  );
}

function CapacityField({ idPrefix = "" }: { idPrefix?: string }) {
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
        required
        type="number"
      />
    </div>
  );
}

function DescriptionField({ idPrefix = "" }: { idPrefix?: string }) {
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
        placeholder="向可能報名的學員說明這堂課的重點。"
      />
    </div>
  );
}

function RequiresApprovalField({ idPrefix = "" }: { idPrefix?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
      <input
        className="mt-1 shrink-0"
        id={`${idPrefix}requiresApproval`}
        name="requiresApproval"
        type="checkbox"
        value="yes"
      />
      需要我確認才算報名成功（不勾選則報名送出即成立，跟公開瀏覽的匿名報名者互動時可以保留篩選權）
    </label>
  );
}

function ConfirmField({ idPrefix = "" }: { idPrefix?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
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
