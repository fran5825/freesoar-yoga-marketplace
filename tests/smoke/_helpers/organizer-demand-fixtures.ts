import {
  PrismaClient,
  type DemandRequestStatus,
  type OrganizationType,
} from "@prisma/client";
import type { BrowserContext } from "@playwright/test";
import { randomUUID } from "crypto";

export const prisma = new PrismaClient();
export const authCookieName = "authjs.session-token";

export function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function createUserSession({
  email,
  isAdmin = false,
}: {
  email: string;
  isAdmin?: boolean;
}) {
  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      isAdmin,
    },
    select: { id: true },
  });
  const sessionToken = randomUUID();

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  return { userId: user.id, sessionToken };
}

export async function createOrganizerProfileWithOrganization({
  email,
  displayName,
  organizationName,
  organizationType = "company",
  contactName = null,
  contactEmail = null,
  contactPhone = null,
}: {
  email: string;
  displayName: string;
  organizationName: string;
  organizationType?: OrganizationType;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}) {
  const { userId, sessionToken } = await createUserSession({ email });

  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      type: organizationType,
      contactName,
      contactEmail,
      contactPhone,
    },
    select: { id: true },
  });

  const organizerProfile = await prisma.organizerProfile.create({
    data: {
      userId,
      organizationId: organization.id,
      displayName,
    },
    select: { id: true },
  });

  return {
    userId,
    sessionToken,
    organizationId: organization.id,
    organizerProfileId: organizerProfile.id,
  };
}

// D10 完整必填欄位組合，供需要「送出即通過」的 fixture 使用。
export function completeDemandRequestData(
  overrides: Record<string, unknown> = {},
) {
  return {
    title: "週三晚間員工紓壓瑜伽課",
    serviceType: "Hatha Yoga",
    description:
      "希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。",
    targetLevel: "general",
    expectedParticipants: 15,
    preferredAreas: ["台北市信義區"],
    preferredTimeSlots: ["平日晚上"],
    classLengthMinutes: 60,
    frequency: "weekly",
    budgetRange: "依人數與時數討論",
    ...overrides,
  };
}

export async function createDemandRequest({
  organizerProfileId,
  organizationId,
  status = "draft",
  data = {},
}: {
  organizerProfileId: string;
  organizationId: string;
  status?: DemandRequestStatus;
  data?: Record<string, unknown>;
}) {
  return prisma.demandRequest.create({
    data: {
      organizerProfileId,
      organizationId,
      status,
      ...data,
    },
  });
}

export async function addAuthSessionCookie(
  context: BrowserContext,
  sessionToken: string,
) {
  await context.addCookies([
    {
      name: authCookieName,
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// Slice 1 onDelete：DemandRequest→Organization 為 Restrict、DemandRequest→OrganizerProfile 為 Cascade。
// 依 demand → organization → organizerProfile → user 明確順序清理，避免 Restrict 造成刪除失敗。
export async function cleanupOrganizerDemandFixtures(emails: string[]) {
  if (emails.length === 0) {
    await prisma.$disconnect();
    return;
  }

  await prisma.demandRequest.deleteMany({
    where: { organizerProfile: { user: { email: { in: emails } } } },
  });
  await prisma.organization.deleteMany({
    where: {
      organizerProfiles: { some: { user: { email: { in: emails } } } },
    },
  });
  await prisma.organizerProfile.deleteMany({
    where: { user: { email: { in: emails } } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { in: emails } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });
  await prisma.$disconnect();
}
