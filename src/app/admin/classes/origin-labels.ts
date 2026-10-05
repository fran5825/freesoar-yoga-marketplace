// 第三批票 11：課程來源的管理員用詞，與公開課程頁一致。其他 task 可能新增來源類型，
// 不認得的值一律顯示「其他來源」，頁面不能因此出錯。
const originLabels: Record<string, string> = {
  organizer_matched: "團主團課",
  teacher_initiated: "老師開課",
};

export function adminClassOriginLabel(origin: string): string {
  return Object.hasOwn(originLabels, origin) ? originLabels[origin] : "其他來源";
}
