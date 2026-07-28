import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { buildNotificationCopy } from "./copy";
import { inAppNotificationSender, type NotificationSender } from "./sender";
import type { NotificationPayload, NotificationRecipient } from "./types";

// 核心寫入函式。不 export 給 UI 層直接呼叫，只給其他 domain module 的 trigger
// 呼叫端使用；`sender` 參數只給測試用（見 D4、D9）。
//
// D5：先以 userId 去重，保留第一次出現的角色（呼叫端應把 "self" 排最前面）。
// D4：逐一收件人各自獨立 try/catch——寫入 pending → 呼叫 sender → 成功轉 sent／
// 失敗轉 failed；單一收件人的例外絕不中斷其他收件人，也絕不外溢給呼叫端。
export async function notifyUsers(
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
  sender: NotificationSender = inAppNotificationSender,
): Promise<void> {
  const seen = new Set<string>();
  const deduped = recipients.filter((recipient) => {
    if (seen.has(recipient.userId)) {
      return false;
    }
    seen.add(recipient.userId);
    return true;
  });

  for (const recipient of deduped) {
    try {
      const copy = buildNotificationCopy(type, recipient.role, payload);

      const notification = await prisma.notification.create({
        data: {
          userId: recipient.userId,
          type,
          channel: "in_app",
          title: copy.title,
          body: copy.body,
          status: "pending",
        },
        select: { id: true, userId: true },
      });

      try {
        await sender({
          id: notification.id,
          userId: notification.userId,
          type,
          title: copy.title,
          body: copy.body,
        });

        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "sent", sentAt: new Date() },
        });
      } catch (sendError) {
        console.error("[notification] send failed", {
          notificationId: notification.id,
          type,
          error: sendError,
        });

        try {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "failed" },
          });
        } catch (updateError) {
          console.error("[notification] failed to mark status=failed", {
            notificationId: notification.id,
            error: updateError,
          });
        }
      }
    } catch (error) {
      console.error("[notification] failed to create notification row", {
        userId: recipient.userId,
        type,
        error,
      });
    }
  }
}
