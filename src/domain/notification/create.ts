import { Prisma, type NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { buildNotificationCopy } from "./copy";
import { deliverEmailChannel } from "./email-channel";
import { inAppNotificationSender, type NotificationSender } from "./sender";
import type { NotificationPayload, NotificationRecipient, NotifyOptions } from "./types";

// 核心寫入函式。不 export 給 UI 層直接呼叫，只給其他 domain module 的 trigger
// 呼叫端使用；`sender` 參數只給測試用（見 D4、D9）。
//
// D5：先以 userId 去重，保留第一次出現的角色（呼叫端應把 "self" 排最前面）。
// D4：逐一收件人各自獨立 try/catch——寫入 pending → 呼叫 sender → 成功轉 sent／
// 失敗轉 failed；單一收件人的例外絕不中斷其他收件人，也絕不外溢給呼叫端。
// organizer-usability-redesign 票 12：收件人可帶 target（直達單筆）；options.eventKeyBase 讓
// 同一事件重試不重複——eventKey 已存在（unique 衝突）就視為已發送，不再呼叫 sender。
// transactional-email：站內通知全部處理完後，再依寄送規則與 EMAIL_DELIVERY_MODE 寄 email（見 email-channel.ts）；
// email 任何失敗都不影響站內通知，也不外溢給呼叫端。
export async function notifyUsers(
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
  sender: NotificationSender = inAppNotificationSender,
  options: NotifyOptions = {},
): Promise<void> {
  const seriesId = await resolveSeriesId(options);
  const resolvedOptions: NotifyOptions = { ...options, recurringClassSeriesId: seriesId };
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

      let notification: { id: string; userId: string };
      try {
        notification = await prisma.notification.create({
          data: {
            userId: recipient.userId,
            type,
            channel: "in_app",
            title: copy.title,
            body: copy.body,
            status: "pending",
            targetType: recipient.target?.type ?? null,
            targetId: recipient.target?.id ?? null,
            eventKey: options.eventKeyBase ? `${options.eventKeyBase}:${recipient.userId}` : null,
            recurringClassSeriesId: seriesId,
          },
          select: { id: true, userId: true },
        });
      } catch (createError) {
        if (
          createError instanceof Prisma.PrismaClientKnownRequestError &&
          createError.code === "P2002" &&
          options.eventKeyBase
        ) {
          // 同一事件已經發給這位收件人（重試），不重複發送。
          continue;
        }
        throw createError;
      }

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

  try {
    await deliverEmailChannel(type, deduped, payload, resolvedOptions);
  } catch (error) {
    console.error("[notification:email] unexpected failure", { type, error });
  }
}

// teacher-series-rollup 票 07：呼叫端可以直接給系列 id，或只給場次 id 由這裡查出所屬系列。查詢失敗不影響發送（當作不屬於系列）。
async function resolveSeriesId(options: NotifyOptions): Promise<string | null> {
  if (options.recurringClassSeriesId !== undefined) {
    return options.recurringClassSeriesId;
  }

  if (!options.classSessionId) {
    return null;
  }

  try {
    const session = await prisma.classSession.findUnique({
      where: { id: options.classSessionId },
      select: { recurringClassSeriesId: true },
    });

    return session?.recurringClassSeriesId ?? null;
  } catch (error) {
    console.error("[notification] failed to resolve series", { error });
    return null;
  }
}
