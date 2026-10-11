import type { OwnNotification } from "./read-service";

// teacher-series-rollup 票 08（spec 2.5、ADR 0008）：同一位收件人、同類型、同系列、同一天（台北時間）的通知合成一則。
// 輸入已依時間新到舊排序；每組用最新的一則當代表，記下則數。沒有系列 id 的通知（含舊通知）一律不合併。
export type GroupedNotification = OwnNotification & { count: number };

export function groupNotifications(notifications: OwnNotification[]): GroupedNotification[] {
  const groups = new Map<string, GroupedNotification>();
  const result: GroupedNotification[] = [];

  for (const notification of notifications) {
    if (!notification.recurringClassSeriesId) {
      result.push({ ...notification, count: 1 });
      continue;
    }

    const key = `${notification.type}:${notification.recurringClassSeriesId}:${taipeiDay(notification.createdAt)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    const entry = { ...notification, count: 1 };
    groups.set(key, entry);
    result.push(entry);
  }

  return result;
}

function taipeiDay(date: Date): string {
  return new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}
