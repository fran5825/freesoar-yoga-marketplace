// teacher-initiated-open-classes 第 9 節（Slice D）：完全不呼叫 requireUser()，服務未登入
// Visitor 的公開瀏覽。查詢條件固定為 isPublic=true、status 在 open_for_enrollment／confirmed
// 之間、且授課老師 status = approved（比照既有「suspended 老師不可公開顯示」規則，沒有這條
// 會讓已暫停老師的舊公開課程繼續留在列表與可報名狀態）。Select 只挑選訪客該看到的最小欄位
// 集合，不揭露 organizerProfileId／organizationId／demandRequestId 這些內部關聯 id（即使值是
// null，也不該讓型別結構暗示內部設計給未登入訪客）。

import type { ClassSessionOrigin, ClassSessionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getClassAvailability } from "./availability";
import { taipeiDayOfWeek } from "./recurring-series-dates";
import { matchesClassDiscoveryTime, type ClassDiscoveryFilters } from "./class-discovery-filters";

export type PublicClassSessionListItem = {
  id: string;
  title: string;
  serviceType: string | null;
  serviceTypes: string[];
  yogaStyles: string[];
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  activeEnrollmentCount: number;
  requiresApproval: boolean;
  canAcceptNewEnrollments: boolean;
  // 只是「誰開的課」的分類標籤，不含任何內部關聯 id。
  origin: ClassSessionOrigin;
  teacherProfile: { displayName: string | null };
};

export type PublicClassSessionListFilters = {
  serviceType?: string;
  // 0（週日）–6，比照既有 TeacherAvailability／RecurringClassSeries 慣例。
  dayOfWeek?: number;
  // 只看還有名額（尚未開始且名額未滿）。
  availableOnly?: boolean;
  discovery?: ClassDiscoveryFilters;
};

export type PublicClassSessionDetail = {
  id: string;
  title: string;
  description: string | null;
  // member-flow 票 03：適合對象、準備事項（沒填是 null，畫面顯示「尚未提供」）。
  suitableFor: string | null;
  preparationNotes: string | null;
  serviceType: string | null;
  serviceTypes: string[];
  yogaStyles: string[];
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  activeEnrollmentCount: number;
  requiresApproval: boolean;
  canAcceptNewEnrollments: boolean;
  origin: ClassSessionOrigin;
  teacherProfile: { displayName: string | null };
};

const PUBLIC_STATUS_FILTER: ClassSessionStatus[] = ["open_for_enrollment", "confirmed"];

// 星期幾篩選：若這場來自常規課程系列，用 series 本身記錄的 dayOfWeek（穩定，不受回填/例外
// 影響）；否則直接從 startAt 用 Asia/Taipei 推算。這個判斷刻意在應用層做，不下推成資料庫端的
// 日期運算——目前公開列表的資料量級不需要，且不同來源（series vs 單堂）的「星期幾」語意本來
// 就分開儲存，在 SQL 裡合併判斷反而更難讀。
export async function getPublicClassSessionListItems(
  filters: PublicClassSessionListFilters = {},
): Promise<PublicClassSessionListItem[]> {
  const now = new Date();
  const discovery = filters.discovery;
  const rows = await prisma.classSession.findMany({
    where: {
      isPublic: true,
      status: { in: PUBLIC_STATUS_FILTER },
      teacherProfile: { status: "approved" },
      ...(discovery ? {
        AND: { status: "open_for_enrollment" as const, startAt: { gt: now } },
        ...(discovery.location ? { location: { contains: discovery.location, mode: "insensitive" as const } } : {}),
        ...(discovery.yogaStyle ? { yogaStyles: { has: discovery.yogaStyle } } : {}),
      } : {}),
      // 課程風格可多選：新資料看 serviceTypes，舊資料與團主媒合的課只有單一 serviceType，兩邊都要比對。
      ...(filters.serviceType
        ? {
            OR: [
              { serviceTypes: { has: filters.serviceType } },
              { serviceType: filters.serviceType },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      serviceType: true,
      serviceTypes: true,
      yogaStyles: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      status: true,
      requiresApproval: true,
      origin: true,
      teacherProfile: { select: { displayName: true } },
      recurringClassSeries: { select: { dayOfWeek: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ["pending", "confirmed"] } } },
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  const byDayOfWeek =
    filters.dayOfWeek === undefined
      ? rows
      : rows.filter((row) => {
          const effectiveDayOfWeek = row.recurringClassSeries?.dayOfWeek ?? taipeiDayOfWeek(row.startAt);
          return effectiveDayOfWeek === filters.dayOfWeek;
        });

  const timed = discovery ? byDayOfWeek.filter(row => matchesClassDiscoveryTime(row.startAt, discovery, now)) : byDayOfWeek;
  const filtered = (discovery ? !discovery.includeFull : filters.availableOnly)
    ? timed.filter(
        (row) =>
          getClassAvailability({
            capacity: row.capacity,
            activeEnrollmentCount: row._count.enrollments,
            startAt: row.startAt,
            now,
          }).state === "open",
      )
    : timed;

  // 明確逐欄位挑選,而不是 destructure 掉 recurringClassSeries 再 spread 剩下的——那個內部
  // 欄位只是用來算 dayOfWeek,回傳給訪客的 DTO 本來就不該含有任何關聯 id 的痕跡。
  return filtered.map((row) => ({
    id: row.id,
    title: row.title,
    serviceType: row.serviceType,
    serviceTypes: row.serviceTypes,
    yogaStyles: row.yogaStyles,
    startAt: row.startAt,
    endAt: row.endAt,
    location: row.location,
    capacity: row.capacity,
    activeEnrollmentCount: row._count.enrollments,
    requiresApproval: row.requiresApproval,
    canAcceptNewEnrollments: row.status === "open_for_enrollment" && getClassAvailability({ capacity: row.capacity, activeEnrollmentCount: row._count.enrollments, startAt: row.startAt, now }).state === "open",
    origin: row.origin,
    teacherProfile: row.teacherProfile,
  }));
}

// draft／狀態不符／非公開／老師已被暫停，一律回傳 null（not-found 語意），不揭露存在性差異
// ——比照既有 draft class session 對未登入 Visitor 的既有慣例。
export async function getPublicClassSessionDetail(
  classSessionId: string,
): Promise<PublicClassSessionDetail | null> {
  const row = await prisma.classSession.findFirst({
    where: {
      id: classSessionId,
      isPublic: true,
      status: { in: PUBLIC_STATUS_FILTER },
      teacherProfile: { status: "approved" },
    },
    select: {
      id: true,
      title: true,
      description: true,
      suitableFor: true,
      preparationNotes: true,
      serviceType: true,
      serviceTypes: true,
      yogaStyles: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      status: true,
      requiresApproval: true,
      origin: true,
      teacherProfile: { select: { displayName: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ["pending", "confirmed"] } } },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const { _count, status, ...fields } = row;
  return { ...fields, activeEnrollmentCount: _count.enrollments,
    canAcceptNewEnrollments: status === "open_for_enrollment" && getClassAvailability({ capacity: row.capacity, activeEnrollmentCount: _count.enrollments, startAt: row.startAt }).state === "open" };
}

export async function getPublicClassYogaStyles(): Promise<string[]> {
  const rows = await prisma.classSession.findMany({
    where: { isPublic: true, status: "open_for_enrollment", teacherProfile: { status: "approved" }, startAt: { gt: new Date() } },
    select: { yogaStyles: true },
  });
  return [...new Set(rows.flatMap(row => row.yogaStyles))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}
