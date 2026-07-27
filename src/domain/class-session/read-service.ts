import type { ClassSessionStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// D14：targetLevel 不新增欄位，透過既有 demandRequestId 關聯衍生。
export type OrganizerFacingClassSession = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  isPublic: boolean;
  status: ClassSessionStatus;
  createdAt: Date;
  demandRequest: { targetLevel: string | null };
  teacherProfile: { displayName: string | null };
};

const organizerFacingClassSessionSelect = {
  id: true,
  title: true,
  description: true,
  serviceType: true,
  startAt: true,
  endAt: true,
  location: true,
  capacity: true,
  isPublic: true,
  status: true,
  createdAt: true,
  demandRequest: { select: { targetLevel: true } },
  teacherProfile: { select: { displayName: true } },
} as const;

export async function listOwnClassSessionsForOrganizer(): Promise<
  OrganizerFacingClassSession[]
> {
  const currentUser = await requireUser();

  const organizerProfile = await prisma.organizerProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!organizerProfile) {
    return [];
  }

  return prisma.classSession.findMany({
    where: { organizerProfileId: organizerProfile.id },
    select: organizerFacingClassSessionSelect,
    orderBy: { startAt: "asc" },
  });
}

// 唯讀；ownership 驗證失敗（class session 不存在或非自己的）回傳 null，
// 與「不存在」語意一致，不洩漏存在性差異。
export async function getOwnClassSessionDetailForOrganizer(
  classSessionId: string,
): Promise<OrganizerFacingClassSession | null> {
  const currentUser = await requireUser();

  const organizerProfile = await prisma.organizerProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!organizerProfile) {
    return null;
  }

  return prisma.classSession.findFirst({
    where: { id: classSessionId, organizerProfileId: organizerProfile.id },
    select: organizerFacingClassSessionSelect,
  });
}

// D15：Teacher 版本 DTO 不含 Organization 聯絡資訊（第 4 節第 6 點），
// 只揭露 Organization 名稱。
export type TeacherFacingClassSession = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  isPublic: boolean;
  status: ClassSessionStatus;
  createdAt: Date;
  demandRequest: { targetLevel: string | null };
  organization: { name: string };
};

// D15：查看自己既有的 class session 不透過 requireApprovedTeacher() 把關——
// 這是查看已存在的承諾，不是申請新機會，suspended teacher 仍可查看
//（比照既有查看自己 demand response 的權限模式）。
export async function listOwnClassSessionsForTeacher(): Promise<
  TeacherFacingClassSession[]
> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!teacherProfile) {
    return [];
  }

  return prisma.classSession.findMany({
    where: { teacherProfileId: teacherProfile.id },
    select: {
      id: true,
      title: true,
      description: true,
      serviceType: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      isPublic: true,
      status: true,
      createdAt: true,
      demandRequest: { select: { targetLevel: true } },
      organization: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });
}
