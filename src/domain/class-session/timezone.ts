// D13：本產品只服務台灣單一地區，採固定 Asia/Taipei（UTC+8，全年無 DST）偏移量，
// 不引入完整時區函式庫或使用者時區偏好設定。

const TAIPEI_OFFSET = "+08:00";
const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const taipeiPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// 明確附加 +08:00 偏移量再建構 Date，使其與伺服器執行時區無關。JS Date 對不存在的日期
// （例如 2/31）會靜默捲動成別的日期而不拋錯，因此建構後再往返校驗：把結果格式化回
// Asia/Taipei 的年/月/日/時/分，逐欄位比對是否與原始輸入完全一致，不一致視為解析失敗。
export function parseTaipeiDatetimeLocal(value: string): Date | null {
  const match = DATETIME_LOCAL_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00${TAIPEI_OFFSET}`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = taipeiPartsFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value;
  const roundTrip = `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
  const original = `${year}-${month}-${day}T${hour}:${minute}`;

  if (roundTrip !== original) {
    return null;
  }

  return date;
}

// organizer-usability-redesign 票 05：把存好的時間轉回 <input type="datetime-local"> 用的
// Asia/Taipei 字串（YYYY-MM-DDTHH:mm），與 parseTaipeiDatetimeLocal 互為反向。
export function formatTaipeiDatetimeLocal(date: Date): string {
  const parts = taipeiPartsFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

const taipeiDisplayFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatTaipeiDatetime(date: Date): string {
  return taipeiDisplayFormatter.format(date);
}

// teacher-class-scheduling 票 01：總覽卡片用的短日期，例如「10/07（二）19:00」。
const taipeiShortDateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "2-digit",
  day: "2-digit",
  weekday: "narrow",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatTaipeiShortDatetime(date: Date): string {
  const parts = Object.fromEntries(
    taipeiShortDateFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.month}/${parts.day}（${parts.weekday}）${parts.hour}:${parts.minute}`;
}
