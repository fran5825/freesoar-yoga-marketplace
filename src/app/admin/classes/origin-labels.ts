import { classOriginLabelsForAdmin } from "@/domain/class-session/origin-labels";

// 第三批票 11：課程來源的管理員用詞。2026-10-06 產品主人選擇與團主端同一份管理員用詞
// （classOriginLabelsForAdmin：團主媒合／老師開課／團主直接開團），新增來源時只要改那一份。
// 不認得的值一律顯示「其他來源」，頁面不能因此出錯。
export function adminClassOriginLabel(origin: string): string {
  return Object.hasOwn(classOriginLabelsForAdmin, origin)
    ? classOriginLabelsForAdmin[origin as keyof typeof classOriginLabelsForAdmin]
    : "其他來源";
}
