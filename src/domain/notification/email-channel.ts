import { Prisma, type NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { buildNotificationCopy } from "./copy";
import { normalizeEmail, readEmailConfig } from "./email-config";
import { renderNotificationEmail } from "./email-copy";
import { shouldSendEmail } from "./email-policy";
import { createResendTransport } from "./email-transport";
import { getNotificationLink } from "./link";
import type { NotificationPayload, NotificationRecipient, NotifyOptions } from "./types";

// transactional-email Slice D：站內通知之外，對寄送規則允許的收件人另建一筆 channel="email" 的記錄並寄出。
// - 由 notifyUsers 在站內通知之後呼叫；觸發點都在主要 transaction commit 之後，這裡不碰任何業務資料。
// - 每位收件人各自 try/catch；寄信失敗只把該筆 email 記錄標成 failed，不影響站內通知與業務結果。
// - 收件信箱只在 server 端用 userId 查，不放進 payload、網址或 log。
// - 按鈕連到 /sign-in?callbackUrl=<目標頁>：已登入直接進目標頁，未登入登入後回到目標頁；
//   目標頁沿用站內通知的連結規則（link.ts），進頁面時照原本規則檢查權限。
export async function deliverEmailChannel(
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
  options: NotifyOptions,
): Promise<void> {
  const eligible = recipients.filter((recipient) => shouldSendEmail(type, recipient.role));
  if (eligible.length === 0) {
    return;
  }

  const config = options.email?.config ?? readEmailConfig();
  if (config.status === "disabled") {
    return;
  }
  if (config.status === "invalid") {
    // 只列出有問題的設定名稱，不印值。
    console.error("[notification:email] config invalid, email skipped", {
      mode: config.mode,
      problems: config.problems,
      type,
    });
    return;
  }

  const transport =
    options.email?.transport ?? createResendTransport({ apiKey: config.apiKey, timeoutMs: config.timeoutMs });

  let users: {
    id: string;
    email: string | null;
    isAdmin: boolean;
    organizerProfile: { id: string } | null;
    teacherProfile: { id: string } | null;
  }[];
  try {
    users = await prisma.user.findMany({
      where: { id: { in: eligible.map((recipient) => recipient.userId) } },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        organizerProfile: { select: { id: true } },
        teacherProfile: { select: { id: true } },
      },
    });
  } catch (error) {
    console.error("[notification:email] failed to load recipients", { type, error });
    return;
  }
  const usersById = new Map(users.map((user) => [user.id, user]));

  let skippedNoEmail = 0;
  let skippedNotAllowlisted = 0;

  for (const recipient of eligible) {
    try {
      const user = usersById.get(recipient.userId);
      if (!user?.email) {
        skippedNoEmail += 1;
        continue;
      }
      const to = normalizeEmail(user.email);
      if (config.mode === "allowlist" && !config.allowedRecipients.has(to)) {
        skippedNotAllowlisted += 1;
        continue;
      }

      const copy = buildNotificationCopy(type, recipient.role, payload);
      const link = getNotificationLink(
        type,
        {
          isOrganizer: user.organizerProfile !== null,
          isTeacher: user.teacherProfile !== null,
          isAdmin: user.isAdmin,
        },
        recipient.target ? { targetType: recipient.target.type, targetId: recipient.target.id } : undefined,
      ) ?? { href: "/notifications", label: "查看通知" };
      const rendered = renderNotificationEmail({
        title: copy.title,
        body: copy.body,
        cta: {
          href: `${config.baseUrl}/sign-in?callbackUrl=${encodeURIComponent(link.href)}`,
          label: link.label,
        },
      });

      let notificationId: string;
      try {
        const row = await prisma.notification.create({
          data: {
            userId: recipient.userId,
            type,
            channel: "email",
            title: copy.title,
            body: copy.body,
            status: "pending",
            targetType: recipient.target?.type ?? null,
            targetId: recipient.target?.id ?? null,
            eventKey: options.eventKeyBase ? `${options.eventKeyBase}:${recipient.userId}:email` : null,
          },
          select: { id: true },
        });
        notificationId = row.id;
      } catch (createError) {
        if (
          createError instanceof Prisma.PrismaClientKnownRequestError &&
          createError.code === "P2002" &&
          options.eventKeyBase
        ) {
          // 同一事件的 email 已經建立過（重試），不再寄。
          continue;
        }
        throw createError;
      }

      try {
        await transport({
          from: config.from,
          to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          idempotencyKey: `notification-${notificationId}`,
        });
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: "sent", sentAt: new Date() },
        });
      } catch (sendError) {
        console.error("[notification:email] send failed", {
          notificationId,
          type,
          error: sendError instanceof Error ? sendError.message : "unknown",
        });
        try {
          await prisma.notification.update({ where: { id: notificationId }, data: { status: "failed" } });
        } catch (updateError) {
          console.error("[notification:email] failed to mark status=failed", { notificationId, error: updateError });
        }
      }
    } catch (error) {
      console.error("[notification:email] failed to prepare email", { type, error });
    }
  }

  if (skippedNoEmail > 0 || skippedNotAllowlisted > 0) {
    console.info("[notification:email] skipped recipients", { type, skippedNoEmail, skippedNotAllowlisted });
  }
}
