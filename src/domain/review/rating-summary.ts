export type TeacherRatingSummary = {
  averageRating: number | null;
  reviewCount: number;
};

// D4：共用格式化，Teacher（own）與 Admin 頁面都呼叫這個函式，不各自實作四捨五入／零評價文案。
// 不可以直接用 averageRating.toFixed(1)——二進位浮點數轉字串不保證十進位四捨五入
// （例如 (81/20).toFixed(1) 實測是 "4.0" 不是 "4.1"）。
//
// 這個純函式刻意獨立成一個檔案，不跟 read-service.ts 放在一起：read-service.ts
// import 了 requireUser()（進而 import NextAuth），在 Playwright 的 Node context 直接
// import 會因為 NextAuth 的 ESM-only 模組炸掉，即使只是要用其中一個不依賴 requireUser()
// 的 pure function 也一樣（同一個檔案內的其他 export 仍會被一起載入）。獨立成這個檔案
// 之後，測試可以安全地直接 import 並呼叫，不會觸發 NextAuth 載入。
export function formatTeacherRatingSummary(summary: TeacherRatingSummary): string {
  if (summary.reviewCount === 0 || summary.averageRating === null) {
    return "尚無評價";
  }

  const rounded = Math.round(summary.averageRating * 10) / 10;
  return `${rounded.toFixed(1)} 分（${summary.reviewCount} 則評價）`;
}
