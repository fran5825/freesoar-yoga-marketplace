import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";

// 票 04／05／06：從別頁（例如需求表單）被送到團主資料頁補資料時，用 `next` 參數記住要回哪一頁。
// 只接受 /organizer/ 底下的站內路徑，擋掉外部網址與 // 開頭的寫法，避免被當成 open redirect。
// 票 10（spec 13.8）：先套用登入 callback 同一套檢查（擋反斜線、控制字元、正規化後的 // 與
// 外站），再對正規化後的路徑檢查 /organizer/ 前綴，`/organizer/../admin` 這類寫法不會通過。
export function sanitizeOrganizerReturnPath(
  value: string | null | undefined,
): string | null {
  const normalized = sanitizeCallbackUrl(value);

  if (!normalized || !normalized.startsWith("/organizer/")) {
    return null;
  }

  return normalized;
}
