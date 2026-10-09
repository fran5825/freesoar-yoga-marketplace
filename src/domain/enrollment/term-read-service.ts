// teacher-class-scheduling 票 08：學員端的期班頁讀取（docs/specs/teacher-class-scheduling-spec.md 4.7、4.8）。
//
// 可見性比照單堂課：
//   - 訪客：只有公開（系列 isPublic）、老師已通過審核、且至少一場已開放報名的期班；其他一律 null。
//   - 已登入學員：至少一場已開放報名或已完成（拿到連結就能看，與單堂一致），或自己已有整期報名。
// 只逐場列出學員本來就看得到的場次（已開放報名、已完成）；草稿只計入堂數，不列日期與連結。
// 不回傳任何內部關聯 id 以外的資料（老師只回顯示名稱）。

import type { EnrollmentStatus, SeriesEnrollmentStatus, TermEnrollmentMode } from "@prisma/client";

import { getClassAvailability } from "@/domain/class-session/availability";
import { prisma } from "@/lib/prisma";

export type TermSessionView = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: "open_for_enrollment" | "completed";
  capacity: number;
  activeEnrollmentCount: number;
  ownEnrollmentStatus: EnrollmentStatus | null;
  // 單堂報名可用（整期和單堂都收、已開放、未開始、有名額、自己還沒有這場的報名）。
  canEnrollSingle: boolean;
};

export type TermEnrollBlock =
  | { reason: "no_remaining_sessions" }
  | { reason: "not_fully_open"; draftCount: number }
  | { reason: "session_full"; startAt: Date }
  | { reason: "has_cancelled_enrollment"; startAt: Date }
  | { reason: "teacher_not_approved" };

export type TermDetail = {
  id: string;
  title: string;
  description: string | null;
  suitableFor: string | null;
  preparationNotes: string | null;
  location: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number | null;
  termEnrollmentMode: TermEnrollmentMode;
  requiresApproval: boolean;
  teacherDisplayName: string | null;
  // 整期堂數（不含已取消）、剩餘堂數（尚未開始、未取消）、其中還是草稿的堂數。
  totalCount: number;
  remainingCount: number;
  draftCount: number;
  firstStartAt: Date | null;
  lastStartAt: Date | null;
  sessions: TermSessionView[];
  ownSeriesEnrollment: { id: string; status: SeriesEnrollmentStatus } | null;
  // null 表示現在可以報整期（已登入、尚未報過）；訪客看到的是「登入後能不能報」的同一個判斷。
  termEnrollBlock: TermEnrollBlock | null;
};

export async function getTermDetailForViewer(
  recurringClassSeriesId: string,
  userId: string | null,
): Promise<TermDetail | null> {
  const series = await prisma.recurringClassSeries.findFirst({
    where: { id: recurringClassSeriesId, kind: "term" },
    select: {
      id: true,
      title: true,
      description: true,
      suitableFor: true,
      preparationNotes: true,
      location: true,
      startTime: true,
      endTime: true,
      dayOfWeek: true,
      termEnrollmentMode: true,
      requiresApproval: true,
      isPublic: true,
      teacherProfile: { select: { displayName: true, status: true } },
      classSessions: {
        where: { status: { not: "cancelled" } },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          capacity: true,
          _count: { select: { enrollments: { where: { status: { in: ["pending", "confirmed"] } } } } },
        },
      },
    },
  });

  if (!series || !series.termEnrollmentMode) {
    return null;
  }

  const ownSeriesEnrollment = userId
    ? await prisma.seriesEnrollment.findUnique({
        where: { recurringClassSeriesId_userId: { recurringClassSeriesId, userId } },
        select: { id: true, status: true },
      })
    : null;
  const hasOpen = series.classSessions.some((session) => session.status === "open_for_enrollment");
  const hasOpenOrCompleted =
    hasOpen || series.classSessions.some((session) => session.status === "completed");
  const teacherApproved = series.teacherProfile.status === "approved";

  const visible = userId
    ? hasOpenOrCompleted || ownSeriesEnrollment !== null
    : series.isPublic && teacherApproved && hasOpen;

  if (!visible) {
    return null;
  }

  const now = new Date();
  const ownEnrollments = userId
    ? await prisma.enrollment.findMany({
        where: { userId, classSessionId: { in: series.classSessions.map((session) => session.id) } },
        select: { classSessionId: true, status: true },
      })
    : [];
  const ownBySession = new Map(ownEnrollments.map((enrollment) => [enrollment.classSessionId, enrollment.status]));
  const remaining = series.classSessions.filter((session) => session.startAt.getTime() > now.getTime());
  const draftCount = remaining.filter((session) => session.status === "draft").length;

  const sessions: TermSessionView[] = series.classSessions
    .filter(
      (session): session is typeof session & { status: "open_for_enrollment" | "completed" } =>
        session.status === "open_for_enrollment" || session.status === "completed",
    )
    .map((session) => {
      const ownEnrollmentStatus = ownBySession.get(session.id) ?? null;
      const open =
        session.status === "open_for_enrollment" &&
        getClassAvailability({
          capacity: session.capacity,
          activeEnrollmentCount: session._count.enrollments,
          startAt: session.startAt,
          now,
        }).state === "open";

      return {
        id: session.id,
        startAt: session.startAt,
        endAt: session.endAt,
        status: session.status,
        capacity: session.capacity,
        activeEnrollmentCount: session._count.enrollments,
        ownEnrollmentStatus,
        canEnrollSingle:
          series.termEnrollmentMode === "term_and_single" && teacherApproved && open && ownEnrollmentStatus === null,
      };
    });

  return {
    id: series.id,
    title: series.title,
    description: series.description,
    suitableFor: series.suitableFor,
    preparationNotes: series.preparationNotes,
    location: series.location,
    startTime: series.startTime,
    endTime: series.endTime,
    dayOfWeek: series.dayOfWeek,
    termEnrollmentMode: series.termEnrollmentMode,
    requiresApproval: series.requiresApproval,
    teacherDisplayName: series.teacherProfile.displayName,
    totalCount: series.classSessions.length,
    remainingCount: remaining.length,
    draftCount,
    firstStartAt: series.classSessions[0]?.startAt ?? null,
    lastStartAt: series.classSessions.at(-1)?.startAt ?? null,
    sessions,
    ownSeriesEnrollment,
    termEnrollBlock: computeTermEnrollBlock(remaining, draftCount, ownBySession, teacherApproved),
  };
}

// 與 create-series-enrollment-core.ts 的檢查同一套規則（畫面用；實際報名仍在鎖內重新判斷）。
function computeTermEnrollBlock(
  remaining: { id: string; startAt: Date; status: string; capacity: number; _count: { enrollments: number } }[],
  draftCount: number,
  ownBySession: Map<string, EnrollmentStatus>,
  teacherApproved: boolean,
): TermEnrollBlock | null {
  if (remaining.length === 0) {
    return { reason: "no_remaining_sessions" };
  }

  if (!teacherApproved) {
    return { reason: "teacher_not_approved" };
  }

  if (draftCount > 0) {
    return { reason: "not_fully_open", draftCount };
  }

  for (const session of remaining) {
    const own = ownBySession.get(session.id);

    if (own === "pending" || own === "confirmed") {
      continue;
    }

    if (own) {
      return { reason: "has_cancelled_enrollment", startAt: session.startAt };
    }

    if (session._count.enrollments >= session.capacity) {
      return { reason: "session_full", startAt: session.startAt };
    }
  }

  return null;
}

// 單堂課程頁用：這一場屬於哪個期班（只有期班才回傳）。
export async function getTermSummaryForClassSession(
  classSessionId: string,
): Promise<{ id: string; title: string; termEnrollmentMode: TermEnrollmentMode; totalCount: number } | null> {
  const row = await prisma.classSession.findUnique({
    where: { id: classSessionId },
    select: {
      recurringClassSeries: {
        select: {
          id: true,
          title: true,
          kind: true,
          termEnrollmentMode: true,
          _count: { select: { classSessions: { where: { status: { not: "cancelled" } } } } },
        },
      },
    },
  });
  const series = row?.recurringClassSeries;

  if (!series || series.kind !== "term" || !series.termEnrollmentMode) {
    return null;
  }

  return {
    id: series.id,
    title: series.title,
    termEnrollmentMode: series.termEnrollmentMode,
    totalCount: series._count.classSessions,
  };
}
