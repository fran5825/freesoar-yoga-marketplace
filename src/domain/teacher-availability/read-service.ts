import type { AvailabilityExceptionType } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type OwnTeacherAvailabilityEntry = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationArea: string | null;
};

export type OwnAvailabilityExceptionEntry = {
  id: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  type: AvailabilityExceptionType;
  reason: string | null;
};

export type OwnAvailabilityOverview = {
  teacherProfileStatus: string;
  availability: OwnTeacherAvailabilityEntry[];
  exceptions: OwnAvailabilityExceptionEntry[];
};

// D8/D9：requireUser() 把關，不要求 approved——任何狀態（含 suspended）的 TeacherProfile
// 都能查看自己的資料，比照既有「suspended 可以唯讀查看自己 demand response」的既有先例。
// 沒有 TeacherProfile 時回傳 null（not-found 語意）。一次查詢用 Promise.all 平行帶出固定
// 時段與例外兩份資料，避免頁面各自呼叫兩次（D8）。
export async function getOwnAvailabilityOverview(): Promise<OwnAvailabilityOverview | null> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true, status: true },
  });

  if (!teacherProfile) {
    return null;
  }

  const [availability, exceptions] = await Promise.all([
    prisma.teacherAvailability.findMany({
      where: { teacherProfileId: teacherProfile.id },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        locationArea: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.availabilityException.findMany({
      where: { teacherProfileId: teacherProfile.id },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        type: true,
        reason: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    teacherProfileStatus: teacherProfile.status,
    availability,
    exceptions,
  };
}
