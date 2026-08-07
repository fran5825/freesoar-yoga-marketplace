import type { ClassSessionOrigin, ClassSessionStatus, EnrollmentStatus } from "@prisma/client";

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
  // teacher-initiated-open-classes：demandRequest 改為 nullable（老師自建課程沒有對應
  // DemandRequest），但 Organizer 自己建立的課程一律有 demandRequest；own-scoped 查詢仍只會
  // 回傳 organizer_matched 來源的課程，型別上放寬是為了配合 schema 變更，不代表這裡真的會出現 null。
  demandRequest: { targetLevel: string | null } | null;
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
// enrollment domain D9：roster 一次隨列表帶出（避免對每張卡片再發一個獨立查詢，見
// enrollment-plan Slice 4 的 N+1 說明），只含 confirmed enrollment 的最小必要欄位
// （不含 phone/image，email 只在 UI 層 name 為 null 時才 fallback 顯示）。
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
  // teacher-initiated-open-classes：老師自建課程沒有 demandRequest／organization，兩者皆為
  // nullable；origin／recurringClassSeriesId／requiresApproval 讓老師端統一列表能分辨並顯示
  // 課程來源，不需要另開查詢。
  origin: ClassSessionOrigin;
  recurringClassSeriesId: string | null;
  requiresApproval: boolean;
  demandRequest: { targetLevel: string | null } | null;
  organization: { name: string } | null;
  // Slice E：統一列表要顯示常規/固定期課程系列的名稱，不是只顯示一個沒有名字的 id——
  // recurringClassSeriesId 本身不足以讓老師分辨「這是哪一個系列」。
  recurringClassSeries: { title: string } | null;
  // teacher-initiated-open-classes 第 8 節（Gate G2/G3）：涵蓋 pending，讓老師端 roster 能
  // 看到並操作等待審核的報名；status 一起帶出讓 UI 分辨要不要顯示確認/拒絕按鈕。
  enrollments: {
    id: string;
    status: EnrollmentStatus;
    notes: string | null;
    user: { name: string | null; email: string | null };
  }[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    reviewer: { name: string | null; email: string | null };
  }[];
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
      origin: true,
      recurringClassSeriesId: true,
      requiresApproval: true,
      demandRequest: { select: { targetLevel: true } },
      organization: { select: { name: true } },
      recurringClassSeries: { select: { title: true } },
      enrollments: {
        where: { status: { in: ["confirmed", "pending"] } },
        select: {
          id: true,
          status: true,
          notes: true,
          user: { select: { name: true, email: true } },
        },
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewer: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { startAt: "asc" },
  });
}

// teacher-initiated-open-classes Slice B：常規／固定期課程系列管理頁。
export type RecurringClassSeriesOccurrence = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: ClassSessionStatus;
};

export type RecurringClassSeriesDetail = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  requiresApproval: boolean;
  occurrences: RecurringClassSeriesOccurrence[];
};

// D15 既有慣例延伸：查看自己既有的系列不透過資格檢查把關——這是查看已存在的承諾，不是申請
// 新機會；own-scope 檢查內建在查詢的 WHERE 子句本身（teacherProfileId 必須符合），不是先查
// 再事後比對。
export async function getOwnRecurringClassSeriesDetailForTeacher(
  recurringClassSeriesId: string,
): Promise<RecurringClassSeriesDetail | null> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!teacherProfile) {
    return null;
  }

  const series = await prisma.recurringClassSeries.findFirst({
    where: { id: recurringClassSeriesId, teacherProfileId: teacherProfile.id },
    select: {
      id: true,
      title: true,
      description: true,
      serviceType: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      location: true,
      capacity: true,
      requiresApproval: true,
      classSessions: {
        select: { id: true, startAt: true, endAt: true, status: true },
        orderBy: { startAt: "asc" },
      },
    },
  });

  if (!series) {
    return null;
  }

  const { classSessions, ...rest } = series;

  return { ...rest, occurrences: classSessions };
}
