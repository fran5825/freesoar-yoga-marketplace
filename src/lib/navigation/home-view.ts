// 2026-10-20 signed-in-navigation 修訂：已登入的人直接打開 `/` 會轉到上次身分的總覽，
// 但從專區導覽列點品牌名稱是「我要看首頁」，所以帶 view=home，首頁看到就不轉址。
export const HOME_VIEW_HREF = "/?view=home";

export function isHomeViewRequested(view: string | string[] | undefined): boolean {
  return view === "home";
}
