import type { DemandResponseStatus } from "@prisma/client";

import { isOrganizationContactComplete } from "@/domain/demand-request/validation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// D13：Organizer 可見的 TeacherProfile 欄位為最小專業資訊 allowlist，
// 明確排除 rejectionReason/certifications/priceRange/User.email/phone。
export type OrganizerFacingResponse = {
  id: string;
  message: string;
  proposedTimeSlots: string[];
  proposedPrice: string | null;
  status: DemandResponseStatus;
  createdAt: Date;
  teacherProfile: {
    displayName: string | null;
    bio: string | null;
    teachingStyle: string | null;
    experienceYears: number | null;
    specialties: string[];
    serviceAreas: string[];
    teachingFormats: string[];
    profilePhotoUrl: string | null;
  };
  // organizer-post-match-handoff 票 04（spec「聯絡方式」）：只有團主已選定的那一筆才有值，
  // 其餘回應一律是 null，DTO 不帶任何老師聯絡資料。contactInfo 是老師在「收款與聯絡」填的選填文字。
  teacherContact: { contactInfo: string | null } | null;
};

const organizerFacingResponseSelect = {
  id: true,
  message: true,
  proposedTimeSlots: true,
  proposedPrice: true,
  status: true,
  createdAt: true,
  teacherProfile: {
    select: {
      displayName: true,
      bio: true,
      teachingStyle: true,
      experienceYears: true,
      specialties: true,
      serviceAreas: true,
      teachingFormats: true,
      profilePhotoUrl: true,
    },
  },
} as const;

// 唯讀；ownership 驗證失敗（demand 不存在或非自己的）回傳 null，
// 與「demand 根本不存在」語意一致，不洩漏存在性差異。
export async function listResponsesForOwnDemandRequest(
  demandRequestId: string,
): Promise<OrganizerFacingResponse[] | null> {
  const currentUser = await requireUser();

  const ownDemand = await prisma.demandRequest.findFirst({
    where: {
      id: demandRequestId,
      organizerProfile: { userId: currentUser.id },
    },
    select: { id: true },
  });

  if (!ownDemand) {
    return null;
  }

  const rows = await prisma.demandResponse.findMany({
    where: { demandRequestId },
    select: organizerFacingResponseSelect,
    orderBy: { createdAt: "asc" },
  });

  // 票 04：被選定老師的聯絡方式另外查，條件寫在 WHERE（這筆需求、selected），不放進共用 select，
  // 避免非 selected 的回應帶出 contactInfo。還沒選定時不必查。
  const selected = rows.some((row) => row.status === "selected")
    ? await prisma.demandResponse.findFirst({
        where: { demandRequestId, status: "selected" },
        select: { id: true, teacherProfile: { select: { contactInfo: true } } },
      })
    : null;

  return rows.map((row) => ({
    ...row,
    teacherContact:
      selected && row.id === selected.id
        ? { contactInfo: normalizeContact(selected.teacherProfile.contactInfo) }
        : null,
  }));
}

// 票 04：需求所屬團體的聯絡資料是否完整，用來判斷「雙方都沒有聯絡方式」。
// 送審時一定完整，但之後團主可以在「我的團體」清空，所以要即時判斷。ownership 同上：不是自己的需求回 null。
export async function getOwnDemandOrganizationContactStatus(
  demandRequestId: string,
): Promise<{ organizationId: string; isContactComplete: boolean } | null> {
  const currentUser = await requireUser();

  const ownDemand = await prisma.demandRequest.findFirst({
    where: {
      id: demandRequestId,
      organizerProfile: { userId: currentUser.id },
    },
    select: {
      organization: {
        select: { id: true, contactName: true, contactEmail: true, contactPhone: true },
      },
    },
  });

  if (!ownDemand) {
    return null;
  }

  return {
    organizationId: ownDemand.organization.id,
    isContactComplete: isOrganizationContactComplete(ownDemand.organization),
  };
}

function normalizeContact(value: string | null): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}
