import type { OrganizationType } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type AdminOrganizationSummary = {
  id: string;
  name: string;
  type: OrganizationType;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  updatedAt: Date;
  organizers: { id: string; displayName: string; email: string | null }[];
  demandRequestCount: number;
  classSessionCount: number;
};

export async function listOrganizationsForAdmin(): Promise<AdminOrganizationSummary[]> {
  await requireAdmin();

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      updatedAt: true,
      // organizer-usability-redesign 票 03：一位團主可以有多個團體，之後新增的團體只有 owner、
      // 沒有 legacy pointer。相容期顯示 owner 加上仍以 legacy pointer 連到這個團體的團主（去重）。
      ownerOrganizerProfile: {
        select: { id: true, displayName: true, user: { select: { email: true } } },
      },
      organizerProfiles: {
        select: { id: true, displayName: true, user: { select: { email: true } } },
      },
      _count: { select: { demandRequests: true, classSessions: true } },
    },
    orderBy: { name: "asc" },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    type: organization.type,
    contactName: organization.contactName,
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    updatedAt: organization.updatedAt,
    organizers: [
      ...(organization.ownerOrganizerProfile ? [organization.ownerOrganizerProfile] : []),
      ...organization.organizerProfiles.filter(
        (profile) => profile.id !== organization.ownerOrganizerProfile?.id,
      ),
    ].map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      email: profile.user.email,
    })),
    demandRequestCount: organization._count.demandRequests,
    classSessionCount: organization._count.classSessions,
  }));
}
