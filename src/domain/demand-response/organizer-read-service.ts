import type { DemandResponseStatus } from "@prisma/client";

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

  return prisma.demandResponse.findMany({
    where: { demandRequestId },
    select: organizerFacingResponseSelect,
    orderBy: { createdAt: "asc" },
  });
}
