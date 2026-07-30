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
    organizers: organization.organizerProfiles.map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      email: profile.user.email,
    })),
    demandRequestCount: organization._count.demandRequests,
    classSessionCount: organization._count.classSessions,
  }));
}
