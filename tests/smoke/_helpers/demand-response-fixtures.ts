import type { DemandResponseStatus, TeacherProfileStatus } from "@prisma/client";

import { createUserSession, prisma } from "./organizer-demand-fixtures";

export async function createTeacherProfileWithSession({
  email,
  displayName,
  status,
}: {
  email: string;
  displayName: string;
  status: TeacherProfileStatus;
}) {
  const { userId, sessionToken } = await createUserSession({ email });

  const teacherProfile = await prisma.teacherProfile.create({
    data: {
      userId,
      displayName,
      bio: `${displayName} bio`,
      teachingStyle: "Clear and steady group-class guidance.",
      experienceYears: 5,
      specialties: ["Hatha Yoga"],
      serviceAreas: ["Taipei"],
      teachingFormats: ["Group class"],
      status,
    },
    select: { id: true },
  });

  return { userId, sessionToken, teacherProfileId: teacherProfile.id };
}

export async function createDemandResponse({
  demandRequestId,
  teacherProfileId,
  status = "submitted",
  message = "測試用回應內容，說明教學風格與合作想法。",
  proposedTimeSlots = ["平日晚上"],
  proposedPrice = null,
}: {
  demandRequestId: string;
  teacherProfileId: string;
  status?: DemandResponseStatus;
  message?: string;
  proposedTimeSlots?: string[];
  proposedPrice?: string | null;
}) {
  return prisma.demandResponse.create({
    data: {
      demandRequestId,
      teacherProfileId,
      status,
      message,
      proposedTimeSlots,
      proposedPrice,
    },
  });
}

export async function cleanupDemandResponseFixtures(emails: string[]) {
  if (emails.length === 0) {
    return;
  }

  await prisma.demandResponse.deleteMany({
    where: { teacherProfile: { user: { email: { in: emails } } } },
  });
  await prisma.demandRequest.deleteMany({
    where: { organizerProfile: { user: { email: { in: emails } } } },
  });
  await prisma.organization.deleteMany({
    where: { organizerProfiles: { some: { user: { email: { in: emails } } } } },
  });
  await prisma.organizerProfile.deleteMany({
    where: { user: { email: { in: emails } } },
  });
  await prisma.teacherProfile.deleteMany({
    where: { user: { email: { in: emails } } },
  });
  await prisma.session.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
