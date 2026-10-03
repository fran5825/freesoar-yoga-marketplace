import type { ClassSessionStatus } from "@prisma/client";

// 我的課程的分類（teacher-usability-redesign 票 04，規格 Q16）。
// 只是畫面上的分組，不是新的課程狀態，也不改變任何操作的時間限制。
export const TEACHER_CLASS_LIST_TABS = ["upcoming", "drafts", "past", "all"] as const;

export type TeacherClassListTab = (typeof TEACHER_CLASS_LIST_TABS)[number];

export const teacherClassListTabLabels: Record<TeacherClassListTab, string> = {
  upcoming: "即將上課",
  drafts: "草稿",
  past: "過往",
  all: "全部",
};

// 「全部」分頁可以只看已取消的課。
export type TeacherClassListStatusFilter = "cancelled";

type ClassForTab = { status: ClassSessionStatus; startAt: Date; endAt: Date };

// 即將上課：還沒結束（含進行中），排除草稿、已取消、已完成。
export function isUpcomingClass(classSession: ClassForTab, now: Date): boolean {
  return (
    classSession.endAt.getTime() > now.getTime() &&
    classSession.status !== "draft" &&
    classSession.status !== "cancelled" &&
    classSession.status !== "completed"
  );
}

// 過往：排除草稿與已取消；已結束（含結束了但還沒標記完成）或已完成。
export function isPastClass(classSession: ClassForTab, now: Date): boolean {
  if (classSession.status === "draft" || classSession.status === "cancelled") {
    return false;
  }

  return classSession.status === "completed" || classSession.endAt.getTime() <= now.getTime();
}

export function filterAndSortClassesForTab<T extends ClassForTab>(
  classSessions: T[],
  tab: TeacherClassListTab,
  now: Date,
  statusFilter: TeacherClassListStatusFilter | null = null,
): T[] {
  const byStartAsc = (a: T, b: T) => a.startAt.getTime() - b.startAt.getTime();

  switch (tab) {
    case "upcoming":
      return classSessions.filter((item) => isUpcomingClass(item, now)).sort(byStartAsc);
    case "drafts":
      // 草稿依狀態分類，日期過了也留在這裡。
      return classSessions.filter((item) => item.status === "draft").sort(byStartAsc);
    case "past":
      return classSessions
        .filter((item) => isPastClass(item, now))
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    case "all":
      return classSessions
        .filter((item) => statusFilter === null || item.status === statusFilter)
        .sort(byStartAsc);
  }
}
