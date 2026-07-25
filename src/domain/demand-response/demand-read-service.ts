import type { DemandRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { requireApprovedTeacher } from "./capability";

// D1/D11：eligibleStatuses 依 D11=B（動態推導，不 persist）固定為 published。
// 若未來 D11 改為選項 A，這裡需同步改為 ["published", "teacher_responded"]。
const eligibleStatuses: DemandRequestStatus[] = ["published"];

const POOL_PAGE_SIZE = 20;

export type TeacherFacingDemandListItem = {
  id: string;
  title: string | null;
  serviceType: string | null;
  targetLevel: string | null;
  expectedParticipants: number | null;
  preferredAreas: string[];
  preferredTimeSlots: string[];
  classLengthMinutes: number | null;
  frequency: string | null;
  createdAt: Date;
};

export type TeacherFacingDemandDetail = TeacherFacingDemandListItem & {
  description: string | null;
  preferredStartDate: Date | null;
  budgetRange: string | null;
  organization: {
    name: string;
    type: string;
  } | null;
};

const demandListSelect = {
  id: true,
  title: true,
  serviceType: true,
  targetLevel: true,
  expectedParticipants: true,
  preferredAreas: true,
  preferredTimeSlots: true,
  classLengthMinutes: true,
  frequency: true,
  createdAt: true,
} as const;

const demandDetailSelect = {
  ...demandListSelect,
  description: true,
  preferredStartDate: true,
  budgetRange: true,
  organization: {
    select: {
      name: true,
      type: true,
    },
  },
} as const;

export type DemandPoolPage = {
  items: TeacherFacingDemandListItem[];
  nextCursor: string | null;
};

// D15：cursor-based pagination，避免固定上限造成需求永久不可見。
export async function listPublishedDemandRequestsForTeacher(
  cursor?: string,
): Promise<DemandPoolPage> {
  await requireApprovedTeacher();

  const items = await prisma.demandRequest.findMany({
    where: { status: { in: eligibleStatuses } },
    select: demandListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: POOL_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > POOL_PAGE_SIZE;
  const pageItems = hasMore ? items.slice(0, POOL_PAGE_SIZE) : items;

  return {
    items: pageItems,
    nextCursor: hasMore ? pageItems[pageItems.length - 1].id : null,
  };
}

// 對非 eligible 或不存在的 id 一律回傳 null（not-found 語意一致，不洩漏存在性）。
export async function getPublishedDemandRequestDetailForTeacher(
  demandRequestId: string,
): Promise<TeacherFacingDemandDetail | null> {
  await requireApprovedTeacher();

  return prisma.demandRequest.findFirst({
    where: {
      id: demandRequestId,
      status: { in: eligibleStatuses },
    },
    select: demandDetailSelect,
  });
}
