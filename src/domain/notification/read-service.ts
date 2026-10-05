import type { NotificationTargetType, NotificationType } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type OwnNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: Date;
  // 票 12：直達單筆的目標（舊通知為 null，連到列表頁）。
  targetType: NotificationTargetType | null;
  targetId: string | null;
};

// D3 修正版：只回傳真正送達的 in_app 記錄——排除 pending/failed（避免顯示成「已送達」
// 但其實沒有），也排除未來 email channel 的記錄（避免同一事件在 in_app 終點重複顯示）。
export async function listOwnNotifications(): Promise<OwnNotification[]> {
  const currentUser = await requireUser();

  return prisma.notification.findMany({
    where: { userId: currentUser.id, channel: "in_app", status: "sent" },
    select: { id: true, type: true, title: true, body: true, createdAt: true, targetType: true, targetId: true },
    orderBy: { createdAt: "desc" },
  });
}
