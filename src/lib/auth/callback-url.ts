// teacher-initiated-open-classes 第 9 節（Slice D）：未登入 Visitor 點擊「登入後報名」需要
// 登入完成後導回原頁面。獨立成一個小檔案（不是直接寫進 sign-in/page.tsx 或 session.ts）
// 純粹是為了可測試性——這是一個純函式，值得直接單元測試，不需要透過 UI 間接驗證。
//
// 只接受站內路徑，避免這個參數被當成 open redirect 的注入點。
// member-flow-redesign 票 05：原本只檢查「以 / 開頭、不以 // 開頭」，但瀏覽器把反斜線當斜線
// （`/\evil.example/` 會到外站），網址正規化也可能產生新的 `//`（`/a/..//evil.example/`）。
// 所以改成：先擋反斜線與控制字元，再以站內 base 解析並確認同源，最後對要回傳的字串再檢查一次。
const SITE_BASE = "https://freesoar.invalid";

export function sanitizeCallbackUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  // 反斜線（含編碼後的 %5c）與控制字元（含 tab、換行）一律拒絕。
  if (/\\|%5c/i.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, SITE_BASE);
  } catch {
    return null;
  }

  if (parsed.origin !== SITE_BASE) {
    return null;
  }

  const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  // 正規化後可能變成 `//evil.example/`，再檢查一次最終要回傳的字串。
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  try {
    if (new URL(normalized, SITE_BASE).origin !== SITE_BASE) {
      return null;
    }
  } catch {
    return null;
  }

  return normalized;
}
