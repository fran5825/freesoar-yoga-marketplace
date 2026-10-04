// member-flow-redesign 票 05：目前開放的登入方式。課程頁與 /sign-in 共用的登入按鈕依這份清單畫出，
// server action 也只接受清單內的值。新增 LINE、Facebook、Email 等登入方式時，先在 src/auth.ts
// 設好 provider，再加進這裡；兩者必須一致。多種登入方式的注意事項見 docs/backlog.md 第 4 項。
export const SIGN_IN_PROVIDERS = [{ id: "google", label: "Google" }] as const;

export type SignInProviderId = (typeof SIGN_IN_PROVIDERS)[number]["id"];

export function parseSignInProvider(value: unknown): SignInProviderId | null {
  return SIGN_IN_PROVIDERS.find((provider) => provider.id === value)?.id ?? null;
}
