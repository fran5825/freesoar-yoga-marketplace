// teacher-initiated-open-classes 第 9 節（Slice D）：完全不呼叫 requireUser()，服務未登入
// Visitor 的公開瀏覽。查詢條件固定為 isPublic=true、status 在 open_for_enrollment／confirmed
// 之間、且授課老師 status = approved（比照既有「suspended 老師不可公開顯示」規則，沒有這條
// 會讓已暫停老師的舊公開課程繼續留在列表與可報名狀態）。Select 只挑選訪客該看到的最小欄位
// 集合，不揭露 organizerProfileId／organizationId／demandRequestId 這些內部關聯 id（即使值是
// null，也不該讓型別結構暗示內部設計給未登入訪客）。

import type { ClassSessionOrigin, ClassSessionStatus, TermEnrollmentMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getClassAvailability } from "./availability";
import { taipeiDayOfWeek } from "./recurring-series-dates";
import { formatTaipeiDatetimeLocal } from "./timezone";
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
  // member-flow 票 03：適合對象、準備事項（沒填是 null；票 14 起畫面不顯示該段）。
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

// 篩選後、尚未依名額排除的公開場次（逐場列表與期班卡片共用同一套篩選）。星期幾與時段在應用層判斷，
// 一律用每一場實際上課日期（票 11），目前公開列表的資料量級不需要下推成資料庫端的日期運算。
async function loadPublicRows(filters: PublicClassSessionListFilters) {
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
      // 票 12：期班的場次在找課程合併成一張卡片；只取型態與 id，不回傳給訪客的單場 DTO。
      recurringClassSeries: { select: { id: true, kind: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ["pending", "confirmed"] } } },
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  // teacher-class-scheduling 票 11：一律用每一場實際上課日期判斷星期（補課可能在別的星期），
  // 不再優先採用系列的 dayOfWeek。
  const byDayOfWeek =
    filters.dayOfWeek === undefined
      ? rows
      : rows.filter((row) => taipeiDayOfWeek(row.startAt) === filters.dayOfWeek);

  const timed = discovery ? byDayOfWeek.filter(row => matchesClassDiscoveryTime(row.startAt, discovery, now)) : byDayOfWeek;

  return { rows: timed, now, excludeFull: Boolean(discovery ? !discovery.includeFull : filters.availableOnly) };
}

type PublicRow = Awaited<ReturnType<typeof loadPublicRows>>["rows"][number];

function toPublicListItem(row: PublicRow, now: Date): PublicClassSessionListItem {
  // 明確逐欄位挑選，不把 recurringClassSeries 等內部欄位帶給訪客。
  return {
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
  };
}

function isRowOpen(row: PublicRow, now: Date): boolean {
  return (
    getClassAvailability({
      capacity: row.capacity,
      activeEnrollmentCount: row._count.enrollments,
      startAt: row.startAt,
      now,
    }).state === "open"
  );
}

export async function getPublicClassSessionListItems(
  filters: PublicClassSessionListFilters = {},
): Promise<PublicClassSessionListItem[]> {
  const { rows, now, excludeFull } = await loadPublicRows(filters);

  return (excludeFull ? rows.filter((row) => isRowOpen(row, now)) : rows).map((row) => toPublicListItem(row, now));
}

// teacher-class-scheduling 票 12：找課程的卡片。一個公開期班只顯示一張（規格 4.8、Q27）：
//   - 篩選：期班只要有任一場尚未開始的場次符合篩選就顯示；卡片上的堂數一律是整期完整數字。
//   - 可報名：只收整期 → 現在能不能報整期（剩下每一場都已開放且有空位）；整期和單堂都收 →
//     能報整期或任一場還有單堂空位。預設排除額滿時依這個判斷。
// 持續開課與單堂的公開場次維持逐場。
export type PublicTermListItem = {
  id: string;
  title: string;
  serviceType: string | null;
  serviceTypes: string[];
  yogaStyles: string[];
  location: string;
  scheduleLabel: string;
  // 符合篩選的最近一場，用來排序與顯示「下一堂」。
  nextStartAt: Date;
  totalCount: number;
  remainingCount: number;
  termEnrollmentMode: TermEnrollmentMode;
  requiresApproval: boolean;
  canEnroll: boolean;
  teacherProfile: { displayName: string | null };
};

export type PublicClassListEntry =
  | { kind: "session"; item: PublicClassSessionListItem }
  | { kind: "term"; item: PublicTermListItem };

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export async function getPublicClassListEntries(
  filters: PublicClassSessionListFilters = {},
): Promise<PublicClassListEntry[]> {
  const { rows, now, excludeFull } = await loadPublicRows(filters);
  // 每個期班「符合篩選的最近一場」，卡片的時間與地點用這一場（只改這場時可能與系列預設不同）。
  const nextRowBySeries = new Map<string, PublicRow>();
  const singleRows: PublicRow[] = [];

  for (const row of rows) {
    if (row.recurringClassSeries?.kind === "term") {
      if (!nextRowBySeries.has(row.recurringClassSeries.id)) {
        nextRowBySeries.set(row.recurringClassSeries.id, row);
      }
    } else {
      singleRows.push(row);
    }
  }

  const terms = nextRowBySeries.size
    ? await prisma.recurringClassSeries.findMany({
        where: { id: { in: [...nextRowBySeries.keys()] }, kind: "term" },
        select: {
          id: true,
          title: true,
          serviceType: true,
          serviceTypes: true,
          yogaStyles: true,
          location: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          termEnrollmentMode: true,
          requiresApproval: true,
          teacherProfile: { select: { displayName: true } },
          classSessions: {
            where: { status: { not: "cancelled" } },
            select: {
              startAt: true,
              endAt: true,
              status: true,
              capacity: true,
              _count: { select: { enrollments: { where: { status: { in: ["pending", "confirmed"] } } } } },
            },
          },
        },
      })
    : [];

  const termEntries: PublicClassListEntry[] = [];

  for (const term of terms) {
    if (!term.termEnrollmentMode) {
      continue;
    }

    const remaining = term.classSessions.filter((session) => session.startAt.getTime() > now.getTime());
    const hasSpace = (session: (typeof remaining)[number]) =>
      session.status === "open_for_enrollment" && session._count.enrollments < session.capacity;
    const canEnrollTerm = remaining.length > 0 && remaining.every(hasSpace);
    const canEnrollSingle = term.termEnrollmentMode === "term_and_single" && remaining.some(hasSpace);
    const canEnroll = term.termEnrollmentMode === "term_only" ? canEnrollTerm : canEnrollTerm || canEnrollSingle;

    if (excludeFull && !canEnroll) {
      continue;
    }

    const nextRow = nextRowBySeries.get(term.id) as PublicRow;

    termEntries.push({
      kind: "term",
      item: {
        id: term.id,
        title: term.title,
        // 風格、地點、下一堂時間都取「符合篩選的最近一場」，與篩選結果一致（只改這場時可能與系列預設不同）。
        serviceType: nextRow.serviceType,
        serviceTypes: nextRow.serviceTypes,
        yogaStyles: nextRow.yogaStyles,
        location: nextRow.location,
        scheduleLabel: `${term.dayOfWeek === null ? "指定日期" : `每${dayOfWeekLabels[term.dayOfWeek]}`} ${term.startTime}–${term.endTime}${
          remaining.some(
            (session) =>
              formatTaipeiDatetimeLocal(session.startAt).split("T")[1] !== term.startTime ||
              formatTaipeiDatetimeLocal(session.endAt).split("T")[1] !== term.endTime,
          )
            ? "（部分堂次時間不同）"
            : ""
        }`,
        nextStartAt: nextRow.startAt,
        totalCount: term.classSessions.length,
        remainingCount: remaining.length,
        termEnrollmentMode: term.termEnrollmentMode,
        requiresApproval: term.requiresApproval,
        canEnroll,
        teacherProfile: term.teacherProfile,
      },
    });
  }

  const sessionEntries: PublicClassListEntry[] = (
    excludeFull ? singleRows.filter((row) => isRowOpen(row, now)) : singleRows
  ).map((row) => ({ kind: "session", item: toPublicListItem(row, now) }));

  return [...sessionEntries, ...termEntries].sort(
    (a, b) => entryStartAt(a).getTime() - entryStartAt(b).getTime(),
  );
}

function entryStartAt(entry: PublicClassListEntry): Date {
  return entry.kind === "term" ? entry.item.nextStartAt : entry.item.startAt;
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
