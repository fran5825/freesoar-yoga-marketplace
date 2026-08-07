// teacher-initiated-open-classes Slice B：常規（每週固定星期）課程的「接下來 N 場落在
// 哪一天」純日期推算，不碰資料庫、不知道 conflict-check——那是
// generate-recurring-occurrences-core.ts 的責任，這個檔案只負責日期本身。固定期課程（明確
// 日期清單）不使用這個函式，由呼叫端直接提供日期清單。
//
// 跟 timezone.ts 的 D13 設計原則一致：只服務 Asia/Taipei（UTC+8，全年無 DST），用 Intl
// 明確指定 timeZone 取得「這個時間點在台灣是星期幾／哪一天」，不依賴伺服器執行時區，也不用
// getUTCDay()（那個算的是 UTC 當天星期幾，在午夜前後跟台灣當地日期會不一致）。

const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TAIPEI_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Taipei",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function taipeiDateString(date: Date): string {
  return TAIPEI_DATE_FORMATTER.format(date);
}

// 匯出給 public-read-service.ts（Slice D）用來從單堂 ClassSession 的 startAt 推算星期幾，
// 用於公開列表的星期幾篩選——這是同一份「台灣當地星期幾」邏輯的唯一實作，不要另外複製一份。
export function taipeiDayOfWeek(date: Date): number {
  const label = TAIPEI_WEEKDAY_FORMATTER.format(date);
  return WEEKDAY_INDEX[label];
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 從 afterDate 隔天開始找，保證回傳的每個日期都嚴格晚於 afterDate 所在的台灣日曆日——
// 用於首次生成（afterDate = now）與「生成更多」（afterDate = 該系列目前最晚一場的
// startAt）都適用，兩者不會生成出重複的日期。
export function computeNextWeeklyOccurrenceDates(
  dayOfWeek: number,
  count: number,
  afterDate: Date = new Date(),
): string[] {
  const dates: string[] = [];
  let cursor = new Date(afterDate.getTime() + ONE_DAY_MS);

  while (dates.length < count) {
    if (taipeiDayOfWeek(cursor) === dayOfWeek) {
      dates.push(taipeiDateString(cursor));
    }

    cursor = new Date(cursor.getTime() + ONE_DAY_MS);
  }

  return dates;
}
