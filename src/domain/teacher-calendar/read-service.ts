import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { availabilityByDay, type CalendarSlot } from "./availability";
import { groupItemsByDay, type CalendarItem } from "./day-items";
import { taipeiMonthBounds } from "./month";

// 我的行事曆（spec 2.5）：按月份、只查本人的摘要。不沿用清單的 listOwnClassSessionsForTeacher，
// 因為那個會讀出全部歷史課程與報名名單；這裡只讀月曆需要的欄位，已報名人數用計數。
// 權限同清單頁 D15：只要登入、有老師資料就能看自己的資料，暫停中的老師也能查看。

export type OwnTeacherCalendarMonth = {
  month: string;
  itemsByDay: Map<string, CalendarItem[]>;
  availabilityByDay: Map<string, CalendarSlot[]>;
};

export async function getOwnTeacherCalendarMonth(month: string): Promise<OwnTeacherCalendarMonth | null> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!teacherProfile) {
    return null;
  }

  const { from, to } = taipeiMonthBounds(month);
  // 和該月份重疊：開始早於月底、結束晚於月初（spec 2.2.2）。
  const overlapsMonth = { startAt: { lt: to }, endAt: { gt: from } };
  // @db.Date 用 UTC 年月日存日期；月份範圍的頭尾日期加減一天，避免邊界日漏掉，之後再按日期過濾。
  const exceptionFrom = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const exceptionTo = new Date(to.getTime() + 24 * 60 * 60 * 1000);

  const [classSessions, proposals, weekly, exceptions] = await Promise.all([
    prisma.classSession.findMany({
      where: { teacherProfileId: teacherProfile.id, ...overlapsMonth },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
        origin: true,
        capacity: true,
        _count: { select: { enrollments: { where: { status: "confirmed" } } } },
      },
    }),
    // 範圍同老師總覽 listOwnReceivedProposalsForTeacher：寄給本人、團主不是自己；
    // 已轉成課程（converted）的只顯示課程本身，所以不列。沒有日期的邀請不會符合重疊條件。
    prisma.organizerClassProposal.findMany({
      where: {
        teacherProfileId: teacherProfile.id,
        organizerProfile: { userId: { not: currentUser.id } },
        status: { in: ["pending_confirmation", "confirmed"] },
        ...overlapsMonth,
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.teacherAvailability.findMany({
      where: { teacherProfileId: teacherProfile.id },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    prisma.availabilityException.findMany({
      where: { teacherProfileId: teacherProfile.id, date: { gte: exceptionFrom, lt: exceptionTo } },
      select: { date: true, startTime: true, endTime: true, type: true },
    }),
  ]);

  const items: CalendarItem[] = [
    ...classSessions.map((row) => ({
      kind: "class" as const,
      id: row.id,
      title: row.title,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      origin: row.origin,
      capacity: row.capacity,
      confirmedCount: row._count.enrollments,
    })),
    ...proposals.flatMap((row) =>
      row.startAt && row.endAt && (row.status === "pending_confirmation" || row.status === "confirmed")
        ? [
            {
              kind: "proposal" as const,
              id: row.id,
              title: row.title,
              startAt: row.startAt,
              endAt: row.endAt,
              status: row.status,
              organizationName: row.organization.name,
            },
          ]
        : [],
    ),
  ];

  return {
    month,
    itemsByDay: groupItemsByDay(items, month),
    availabilityByDay: availabilityByDay(month, weekly, exceptions),
  };
}
