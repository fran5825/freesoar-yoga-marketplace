// 「3 天前」這類白話時間，給管理員待處理清單用。只到「天」為止；超過 30 天直接顯示日期，
// 因為「120 天前」比「2026/6/1」更難判斷。未來時間（時鐘誤差）一律當成「剛剛」。
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);

  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;

  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days} 天前`;

  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "numeric", day: "numeric" });
}
