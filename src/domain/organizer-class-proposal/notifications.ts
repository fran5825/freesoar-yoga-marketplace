import type { NotificationType, OrganizerClassProposalStatus } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

import type { ProposalTransitionEvent } from "./__internal__/transition-event";

// organizer-usability-redesign 票 12（spec 13.7）：合作邀請的站內通知。
// - 收件人一律由這裡從資料庫解析（團主 owner、受邀老師），不接受 client 指定收件人、文字或網址。
// - 依修改前後兩組資料（event.before／after）決定：換老師時原老師收到「已取消」、新老師只在
//   邀請處於等待確認時收到邀請；本人授課（老師就是團主本人）不寄給自己。
// - eventKey＝邀請 id＋transitionSeq＋收件人：同一次轉換重試不重複，不同步驟各自發送。
// - 在 domain transaction commit 之後呼叫；任何失敗只記 log，不影響已完成的轉換。
export type ProposalNotificationKind = "submitted" | "confirmed" | "declined" | "withdrawn" | "revised";

const TEACHER_HAS_SEEN: OrganizerClassProposalStatus[] = ["pending_confirmation", "confirmed"];

type Send = {
  type: NotificationType;
  recipient: NotificationRecipient;
  actorLabel: string | null;
  reason?: string | null;
  // 課名取自交易內的快照：寄給原老師的「已取消」用修改前的課名。
  title: string | null;
};

export async function notifyProposalTransition(
  kind: ProposalNotificationKind,
  event: ProposalTransitionEvent,
  extra: { reason?: string | null } = {},
): Promise<void> {
  try {
    const teacherIds = [event.before.teacherProfileId, event.after.teacherProfileId].filter(
      (id): id is string => id !== null,
    );
    const [proposal, teachers] = await Promise.all([
      prisma.organizerClassProposal.findUnique({
        where: { id: event.proposalId },
        select: { organizerProfile: { select: { userId: true, displayName: true } } },
      }),
      prisma.teacherProfile.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, userId: true, displayName: true },
      }),
    ]);
    if (!proposal) {
      return;
    }
    const organizer = proposal.organizerProfile;
    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

    // 老師收件人：本人授課不寄；只有目前仍是受邀老師時才附上單筆連結（換掉的老師已讀不到這份邀請）。
    const teacherRecipient = (teacherProfileId: string | null): NotificationRecipient | null => {
      const teacher = teacherProfileId ? teacherById.get(teacherProfileId) : undefined;
      if (!teacher || teacher.userId === organizer.userId) {
        return null;
      }
      return {
        userId: teacher.userId,
        role: "counterpart",
        ...(teacherProfileId === event.after.teacherProfileId
          ? { target: { type: "teacher_class_proposal" as const, id: event.proposalId } }
          : {}),
      };
    };
    const organizerRecipient: NotificationRecipient = {
      userId: organizer.userId,
      role: "counterpart",
      target: { type: "organizer_class_proposal", id: event.proposalId },
    };
    const teacherName = (teacherProfileId: string | null) =>
      (teacherProfileId ? teacherById.get(teacherProfileId)?.displayName : null) ?? null;

    const sends: Send[] = [];
    const { before, after } = event;
    const beforeTeacherSaw = before.teacherProfileId !== null && TEACHER_HAS_SEEN.includes(before.status);

    switch (kind) {
      case "submitted": {
        const recipient = teacherRecipient(after.teacherProfileId);
        if (recipient) sends.push({ type: "class_proposal_invited", recipient, actorLabel: organizer.displayName, title: after.title });
        break;
      }
      case "confirmed":
      case "declined": {
        // 確認／婉拒都是受邀老師做的；本人授課的確認不經過這裡。
        if (teacherById.get(after.teacherProfileId ?? "")?.userId !== organizer.userId) {
          sends.push({
            type: kind === "confirmed" ? "class_proposal_confirmed" : "class_proposal_declined",
            recipient: organizerRecipient,
            actorLabel: teacherName(after.teacherProfileId),
            reason: kind === "declined" ? extra.reason : null,
            title: after.title,
          });
        }
        break;
      }
      case "withdrawn": {
        const recipient = beforeTeacherSaw ? teacherRecipient(before.teacherProfileId) : null;
        if (recipient) {
          sends.push({ type: "class_proposal_withdrawn", recipient, actorLabel: organizer.displayName, reason: extra.reason, title: before.title });
        }
        break;
      }
      case "revised": {
        const teacherChanged = before.teacherProfileId !== after.teacherProfileId;
        if (beforeTeacherSaw && teacherChanged) {
          const recipient = teacherRecipient(before.teacherProfileId);
          if (recipient) sends.push({ type: "class_proposal_withdrawn", recipient, actorLabel: organizer.displayName, title: before.title });
        }
        if (after.status === "pending_confirmation") {
          const recipient = teacherRecipient(after.teacherProfileId);
          if (recipient && teacherChanged) {
            sends.push({ type: "class_proposal_invited", recipient, actorLabel: organizer.displayName, title: after.title });
          } else if (recipient && before.status === "pending_confirmation") {
            sends.push({ type: "class_proposal_revised", recipient, actorLabel: organizer.displayName, title: after.title });
          }
        }
        // declined／confirmed 修改後回到草稿：老師在團主重新送出時才會收到邀請。
        break;
      }
    }

    for (const send of sends) {
      await notifyUsers(
        send.type,
        [send.recipient],
        {
          actorLabel: send.actorLabel ?? undefined,
          classSessionTitle: send.title ?? undefined,
          reason: send.reason ?? undefined,
        },
        undefined,
        { eventKeyBase: `class-proposal:${event.proposalId}:${event.transitionSeq}` },
      );
    }
  } catch (error) {
    console.error("[notification] class proposal notification failed", { kind, proposalId: event.proposalId, error });
  }
}
