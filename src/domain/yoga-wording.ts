// 2026-10-03 文案規則：選項與文案一律寫「瑜伽」，不寫「瑜珈」（見 docs/context/voice-and-tone.md）。
// 老師的擅長類型與課程的瑜伽類型可以在「其他」自由輸入，儲存前把「瑜珈」統一成「瑜伽」，
// 讓自訂項目跟選項一致，之後媒合比對才不會因為一個字對不上。只換這兩個字，其他內容不動。
export function normalizeYogaWording(value: string): string {
  return value.replaceAll("瑜珈", "瑜伽");
}
