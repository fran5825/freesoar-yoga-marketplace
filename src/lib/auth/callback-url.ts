// teacher-initiated-open-classes 第 9 節（Slice D）：未登入 Visitor 點擊「登入後報名」需要
// 登入完成後導回原頁面。獨立成一個小檔案（不是直接寫進 sign-in/page.tsx 或 session.ts）
// 純粹是為了可測試性——這是一個純函式，值得直接單元測試，不需要透過 UI 間接驗證。
//
// 只接受站內相對路徑（以單個 "/" 開頭、不是 "//" 開頭的 protocol-relative URL），拒絕任何
// 看起來像外部網址的值——避免這個參數被當成 open redirect 的注入點。
export function sanitizeCallbackUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}
