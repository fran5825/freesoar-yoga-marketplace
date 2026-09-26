// 測試用的「從今天算起 N 天後」日期字串，避免把日期寫死、時間一到測試就壞
// （見 docs/backlog.md 1b）。以台北時間（UTC+8）計算，格式跟 datetime-local 欄位一致。
export function futureDateString(daysFromToday: number): string {
  const taipeiNow = new Date(Date.now() + 8 * 3600_000);
  taipeiNow.setUTCDate(taipeiNow.getUTCDate() + daysFromToday);

  return taipeiNow.toISOString().slice(0, 10);
}

export function futureDateTime(daysFromToday: number, time: string): string {
  return `${futureDateString(daysFromToday)}T${time}`;
}

// 從「今天起算 daysFromToday 天」那天（含）往後，第一個符合 weekday（0＝週日）的日期。
export function futureWeekdayDateString(daysFromToday: number, weekday: number): string {
  for (let offset = daysFromToday; offset < daysFromToday + 7; offset += 1) {
    const date = futureDateString(offset);
    const [year, month, day] = date.split("-").map(Number);

    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === weekday) {
      return date;
    }
  }

  throw new Error("unreachable");
}
