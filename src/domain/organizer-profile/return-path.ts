// 票 04／05／06：從別頁（例如需求表單）被送到團主資料頁補資料時，用 `next` 參數記住要回哪一頁。
// 只接受 /organizer/ 底下的站內路徑，擋掉外部網址與 // 開頭的寫法，避免被當成 open redirect。
export function sanitizeOrganizerReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/organizer/") || value.startsWith("//")) {
    return null;
  }

  return value;
}
