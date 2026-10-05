import type { OrganizerClassProposalStatus } from "@prisma/client";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";

// organizer-usability-redesign 票 12：合作邀請在總覽上的「待你處理／等待對方」。
// 只依目前狀態與開始時間推導（不新增排程狀態）：開始時間已過但還沒開放報名的邀請，提示團主修改時間。
// 未確認的邀請不會被說成「已排定的課」；每一項都連到該筆單筆頁。
export type ProposalTodoItem = {
  kind: "action" | "waiting";
  label: string;
  message: string;
  href: string;
};

type ProposalTodoInput = {
  id: string;
  title: string | null;
  status: OrganizerClassProposalStatus;
  startAt: Date | null;
};

function describe(proposal: ProposalTodoInput, counterpart: string | null): string {
  return [
    proposal.title ?? "尚未命名的課程",
    counterpart,
    proposal.startAt ? formatTaipeiDatetime(proposal.startAt) : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("・");
}

function hasStarted(proposal: ProposalTodoInput, now: Date): boolean {
  return proposal.startAt !== null && proposal.startAt.getTime() <= now.getTime();
}

export function buildOrganizerProposalTodoItems(
  proposals: (ProposalTodoInput & { teacherDisplayName: string | null })[],
  now: Date = new Date(),
): ProposalTodoItem[] {
  const items: ProposalTodoItem[] = [];
  for (const proposal of proposals) {
    const href = `/organizer/class-proposals/${proposal.id}`;
    const message = describe(proposal, proposal.teacherDisplayName ? `老師：${proposal.teacherDisplayName}` : null);
    if (proposal.status !== "draft" && hasStarted(proposal, now)) {
      items.push({ kind: "action", label: "開始時間已過，請修改時間", message, href });
      continue;
    }
    switch (proposal.status) {
      case "confirmed":
        items.push({ kind: "action", label: "老師已確認，可以開放報名", message, href });
        break;
      case "declined":
        items.push({ kind: "action", label: "老師婉拒了，請修改後重新邀請或改邀其他老師", message, href });
        break;
      case "draft":
        items.push({ kind: "action", label: "直接開團的草稿還沒送出", message, href });
        break;
      case "pending_confirmation":
        items.push({ kind: "waiting", label: "等待老師確認", message, href });
        break;
      default:
        break;
    }
  }
  return items;
}

export function buildTeacherProposalTodoItems(
  proposals: (ProposalTodoInput & { organizationName: string })[],
  now: Date = new Date(),
): ProposalTodoItem[] {
  const items: ProposalTodoItem[] = [];
  for (const proposal of proposals) {
    const href = `/teacher/class-proposals/${proposal.id}`;
    const message = describe(proposal, proposal.organizationName);
    if (proposal.status === "pending_confirmation") {
      items.push(
        hasStarted(proposal, now)
          ? { kind: "waiting", label: "合作邀請的時間已過，等待團主修改", message, href }
          : { kind: "action", label: "合作邀請待你確認", message, href },
      );
    } else if (proposal.status === "confirmed") {
      // 開始時間已過就不能開放報名，要等團主改時間、你重新確認。
      items.push(
        hasStarted(proposal, now)
          ? { kind: "waiting", label: "合作邀請的時間已過，等待團主修改", message, href }
          : { kind: "waiting", label: "你已確認，等待團主開放報名", message, href },
      );
    }
  }
  return items;
}
