// teacher-class-scheduling 票 08：整期報名沿用既有通知類型（2026-10-09 產品主人放行第 3 點），
// 課名帶上整期堂數，例如「週二流瑜伽（整期 9 堂）」。
export function termNotificationTitle(seriesTitle: string, sessionCount: number): string {
  return `${seriesTitle}（整期 ${sessionCount} 堂）`;
}
