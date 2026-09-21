// 2026-09-21 期望地點改為自由輸入地址＋「線上課程」勾選。各頁面（團主、老師、管理員）
// 顯示時共用這個函式，線上課程固定排第一項，讓老師一眼看出不用到場。
export function getDemandLocationItems(demand: {
  preferredAreas: string[];
  isOnline: boolean;
}): string[] {
  const areas = demand.preferredAreas.filter((area) => area.trim().length > 0);

  return demand.isOnline ? ["線上課程", ...areas] : areas;
}
