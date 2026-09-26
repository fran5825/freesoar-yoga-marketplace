"use client";

import { useState } from "react";

// 24 小時制的時間欄位：「時」（00–23）與「分」（每 5 分鐘）兩個下拉選單。
// 原生 <input type="time"> 的顯示方式跟隨使用者電腦的語言設定，網頁端沒辦法強制 24 小時，
// 中午 12 點會分不清上午或下午。送出時用一個隱藏欄位帶出 "HH:mm"（沒選就是空字串），
// 格式與原本的 time 欄位相同，Server Action 不需要改。
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const BASE_MINUTES = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

const selectClassName =
  "w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

export function TimeField24({
  id,
  name,
  ariaLabel,
  defaultValue = "",
  required = false,
}: {
  // 外層 <label htmlFor={id}> 會對到「時」的下拉選單。
  id: string;
  name: string;
  ariaLabel: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [initialHour = "", initialMinute = ""] = defaultValue.split(":");
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  // 既有資料的分鐘不是 5 的倍數時（例如 09:07），保留那一個選項，不要悄悄改掉。
  // 23 點時多提供 :59，讓「可授課到當天最後一分鐘」的時段（例如 23:00–23:59）還是能設定。
  const withEndOfDay = hour === "23" ? [...BASE_MINUTES, "59"] : BASE_MINUTES;
  const minutes =
    minute && !withEndOfDay.includes(minute)
      ? [...withEndOfDay, minute].sort()
      : withEndOfDay;

  function handleHourChange(nextHour: string) {
    setHour(nextHour);

    if (nextHour === "") {
      setMinute("");
    } else if (minute === "") {
      setMinute("00");
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {/* 「時」的名稱來自外層的 <label htmlFor={id}>（例如「開始時間」），不另外加 aria-label。 */}
      <select
        className={selectClassName}
        id={id}
        onChange={(event) => handleHourChange(event.target.value)}
        required={required}
        value={hour}
      >
        <option disabled={required} value="">
          時
        </option>
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-ink-soft">
        :
      </span>
      <select
        aria-label={`${ariaLabel}（分）`}
        className={selectClassName}
        id={`${id}-minute`}
        onChange={(event) => setMinute(event.target.value)}
        required={required}
        value={minute}
      >
        <option disabled={required} value="">
          分
        </option>
        {minutes.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <input name={name} type="hidden" value={hour && minute ? `${hour}:${minute}` : ""} />
    </div>
  );
}
