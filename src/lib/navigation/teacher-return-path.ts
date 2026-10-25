// wrong-route-fixes 畫面驗收 F9-1：從課程頁、系列頁的收款資訊提醒去填收款資訊，儲存後回到原本那一頁。
// 只是「回哪一頁」的 context，不是通用 callback 或授權來源；回到的頁面照原本規則檢查本人。
// 白名單：/teacher/classes/{id}、/teacher/classes/series/{id}，不帶查詢字串。
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function safeTeacherClassReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^\/teacher\/classes\/(?:series\/)?([^/?#]+)$/);
  if (!match || !ID_PATTERN.test(match[1]) || match[1] === "new" || match[1] === "series") return null;
  return value;
}
