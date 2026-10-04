import type { OrganizerClassProposalStatus } from "@prisma/client";

import type { OwnOrganization } from "@/domain/organization/service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";

import type { ProposalOrganizationOption } from "./ProposalForm";

// organizer-usability-redesign 票 05：合作邀請頁面共用的小工具。

export function toProposalOrganizationOptions(organizations: OwnOrganization[]): ProposalOrganizationOption[] {
  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    typeLabel: organizationTypeLabels[organization.type],
    isContactComplete: organization.isContactComplete,
  }));
}

// 第一次存檔或送出前先存成草稿後換到編輯頁時，顯示一次結果；只接受固定代碼，不顯示網址上的文字。
export function toProposalFlash(flash: string | undefined): { kind: "success" | "error"; message: string } | null {
  switch (flash) {
    case undefined:
      return null;
    case "saved":
      return { kind: "success", message: "草稿已儲存。" };
    case "organization_contact_incomplete":
      return { kind: "error", message: "草稿已儲存，但這個團體的聯絡資料還沒補齊，請先補齊聯絡資料再送出邀請。" };
    case "teacher_not_approved":
      return { kind: "error", message: "草稿已儲存，但這位老師目前無法接受邀請，請選擇其他老師。" };
    case "proposal_starts_in_past":
      return { kind: "error", message: "草稿已儲存，但開始時間已經過了，請修改時間後再送出。" };
    default:
      return { kind: "error", message: "草稿已儲存，但邀請暫時無法送出，請確認內容後再試一次。" };
  }
}

export const proposalStatusLabels: Record<OrganizerClassProposalStatus, string> = {
  draft: "草稿",
  pending_confirmation: "等待老師確認",
  confirmed: "老師已確認",
  declined: "老師已婉拒",
  withdrawn: "已撤回",
  converted: "已開放報名",
};

export const proposalStatusToneClasses: Record<OrganizerClassProposalStatus, string> = {
  draft: "bg-sage text-pine",
  pending_confirmation: "bg-clay-tint text-clay-deep",
  confirmed: "bg-pine-tint text-pine",
  declined: "bg-amber-50 text-amber-900",
  withdrawn: "bg-sand text-ink-soft",
  converted: "bg-emerald-100 text-emerald-800",
};

// 只接受 cuid 形式的預選參數，未登入轉登入頁時一起帶回。
export function withOrganizationParam(path: string, organizationId: string | undefined): string {
  if (!organizationId || !/^[a-z0-9]{10,40}$/i.test(organizationId)) {
    return path;
  }
  return `${path}?organizationId=${encodeURIComponent(organizationId)}`;
}
