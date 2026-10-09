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

// admin-usability 第三批票 09：需求／課程列表「只看這個團體」時顯示的名稱。只取名稱，查無資料回 null。
export async function getOrganizationNameForAdmin(organizationId: string): Promise<string | null> {
  await requireAdmin();

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return organization?.name ?? null;
}

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
      // 票 15a：只顯示團體 owner，不再由 legacy pointer 推導管理者。
      ownerOrganizerProfile: {
        select: { id: true, displayName: true, user: { select: { email: true } } },
      },
      // 需求草稿是團主私人資料，管理員看不到，所以也不算進需求數，避免數字暗示有看不到的資料。
      _count: {
        select: { demandRequests: { where: { status: { not: "draft" } } }, classSessions: true },
      },
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
    ].map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      email: profile.user.email,
    })),
    demandRequestCount: organization._count.demandRequests,
    classSessionCount: organization._count.classSessions,
  }));
}
