// teacher-availability D11：比照既有 class-session/timezone.ts（parseTaipeiDatetimeLocal／
// formatTaipeiDatetime）的既有寫法——明確帶 timeZone 選項的 Intl.DateTimeFormat，讓正確性
// 是函式本身的設定保證，不依賴呼叫端或執行環境的系統時區。這裡用 "UTC" 而不是
// "Asia/Taipei"：AvailabilityException.date 是 @db.Date 純日期欄位，沒有時分概念，UTC 才是
// 這個欄位型別本身的正確錨點（Date.UTC 建構、透過 Prisma 寫入 @db.Date 欄位時，底層驅動
// 程式本身就是用 UTC 年/月/日決定要存哪一天）。

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const utcPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// 明確用 Date.UTC 建構、再往返校驗，理由與既有 parseTaipeiDatetimeLocal 完全相同：
// JS Date 對不存在的日期（例如 2/31）會靜默捲動成別的日期而不拋錯。
export function parseAvailabilityExceptionDate(value: string): Date | null {
  const match = isoDatePattern.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (utcPartsFormatter.format(date) !== `${year}-${month}-${day}`) {
    return null;
  }

  return date;
}

export function formatAvailabilityExceptionDate(date: Date): string {
  return utcPartsFormatter.format(date);
}
