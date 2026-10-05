import { formatTaipeiDatetimeLocal } from "@/domain/class-session/timezone";
import { validateClassSessionCreate } from "@/domain/class-session/validation";

import type { ProposalValidationError } from "./validation";

// organizer-usability-redesign 票 05／06：合作邀請的送出資格（送出、老師確認、編輯頁重建錯誤共用）。
// 送出前的完整度與未來時間檢查，規則與正式建課一致（瑜伽類型對團主課程不強制）。
// 送出時使用；編輯頁在「送出失敗後換頁」時也用它重建可定位的欄位錯誤。
export function getProposalSubmitIssues(proposal: {
  teacherProfileId: string | null;
  title: string | null;
  description: string | null;
  serviceTypes: string[];
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  capacity: number | null;
  isPublic: boolean;
}): { startsInPast: boolean; errors: ProposalValidationError[] } {
  const errors: ProposalValidationError[] = [];
  if (!proposal.teacherProfileId) {
    errors.push({ field: "teacherProfileId", message: "請選擇授課老師。" });
  }
  const completeness = validateClassSessionCreate({
    title: proposal.title,
    description: proposal.description,
    serviceTypes: proposal.serviceTypes,
    startAt: proposal.startAt ? formatTaipeiDatetimeLocal(proposal.startAt) : null,
    endAt: proposal.endAt ? formatTaipeiDatetimeLocal(proposal.endAt) : null,
    location: proposal.location,
    capacity: proposal.capacity,
    isPublic: proposal.isPublic,
  });
  if (completeness.valid) {
    return { startsInPast: false, errors };
  }
  return {
    startsInPast: completeness.errors.some((error) => error.code === "start_at_in_past"),
    errors: [
      ...errors,
      ...completeness.errors.map((error) => ({
        field: (error.field === "serviceType" ? "serviceTypes" : error.field) as ProposalValidationError["field"],
        message: error.message,
      })),
    ],
  };
}
