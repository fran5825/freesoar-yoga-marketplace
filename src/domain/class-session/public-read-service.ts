// teacher-initiated-open-classes 第 9 節（Slice D）：完全不呼叫 requireUser()，服務未登入
// Visitor 的公開瀏覽。查詢條件固定為 isPublic=true、status 在 open_for_enrollment／confirmed
// 之間、且授課老師 status = approved（比照既有「suspended 老師不可公開顯示」規則，沒有這條
// 會讓已暫停老師的舊公開課程繼續留在列表與可報名狀態）。Select 只挑選訪客該看到的最小欄位
// 集合，不揭露 organizerProfileId／organizationId／demandRequestId 這些內部關聯 id（即使值是
// null，也不該讓型別結構暗示內部設計給未登入訪客）。

import type { ClassSessionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { taipeiDayOfWeek } from "./recurring-series-dates";

export type PublicClassSessionListItem = {
  id: string;
  title: string;
  serviceType: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  teacherProfile: { displayName: string | null };
};

export type PublicClassSessionListFilters = {
  serviceType?: string;
  // 0（週日）–6，比照既有 TeacherAvailability／RecurringClassSeries 慣例。
  dayOfWeek?: number;
};

export type PublicClassSessionDetail = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
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
  const rows = await prisma.classSession.findMany({
    where: {
      isPublic: true,
      status: { in: PUBLIC_STATUS_FILTER },
      teacherProfile: { status: "approved" },
      ...(filters.serviceType ? { serviceType: filters.serviceType } : {}),
    },
    select: {
      id: true,
      title: true,
      serviceType: true,
      startAt: true,
      endAt: true,
      location: true,
      teacherProfile: { select: { displayName: true } },
      recurringClassSeries: { select: { dayOfWeek: true } },
    },
    orderBy: { startAt: "asc" },
  });

  const filtered =
    filters.dayOfWeek === undefined
      ? rows
      : rows.filter((row) => {
          const effectiveDayOfWeek = row.recurringClassSeries?.dayOfWeek ?? taipeiDayOfWeek(row.startAt);
          return effectiveDayOfWeek === filters.dayOfWeek;
        });

  // 明確逐欄位挑選,而不是 destructure 掉 recurringClassSeries 再 spread 剩下的——那個內部
  // 欄位只是用來算 dayOfWeek,回傳給訪客的 DTO 本來就不該含有任何關聯 id 的痕跡。
  return filtered.map((row) => ({
    id: row.id,
    title: row.title,
    serviceType: row.serviceType,
    startAt: row.startAt,
    endAt: row.endAt,
    location: row.location,
    teacherProfile: row.teacherProfile,
  }));
}

// draft／狀態不符／非公開／老師已被暫停，一律回傳 null（not-found 語意），不揭露存在性差異
// ——比照既有 draft class session 對未登入 Visitor 的既有慣例。
export async function getPublicClassSessionDetail(
  classSessionId: string,
): Promise<PublicClassSessionDetail | null> {
  return prisma.classSession.findFirst({
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
      serviceType: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      teacherProfile: { select: { displayName: true } },
    },
  });
}
