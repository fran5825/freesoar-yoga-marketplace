// teacher-series-rollup 票 03（spec 2.1）：老師「我的課程」與管理員課程清單的系列收合。
// 屬於系列（期班或持續開課）的場次在每個分頁只出現一張系列卡；單堂獨立的課維持一場一張卡。
// 分頁篩選與排序沿用 filterAndSortClassesForTab（呼叫端先篩好再傳進來），系列卡放在它在該分頁裡第一場出現的位置。
// 卡上的堂數與人數只算這個分頁內的場次；人數算不重複學員（整期學員報 8 堂只算 1 位）。
import type { ClassSessionOrigin, ClassSessionStatus, RecurringClassSeriesKind } from "@prisma/client";

export type RollupSession = {
  id: string;
  status: ClassSessionStatus;
  origin: ClassSessionOrigin;
  startAt: Date;
  endAt: Date;
  location: string;
  recurringClassSeriesId: string | null;
  recurringClassSeries: { title: string; kind: RecurringClassSeriesKind; dayOfWeek: number | null; startTime: string; endTime: string } | null;
  enrollments: { status: string; userId: string }[];
};

// 卡片底部「最急的一件」：待確認 > 已結束待標記完成 > 草稿待開放（沿用老師總覽「待你處理」的順序）。
export type SeriesUrgent =
  | { kind: "pending"; count: number }
  | { kind: "awaiting_completion"; count: number }
  | { kind: "drafts"; count: number }
  | null;

export type SeriesRollupCard<T extends RollupSession> = {
  kind: "series";
  seriesId: string;
  title: string;
  seriesKind: RecurringClassSeriesKind;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  // 這個分頁內的場次（已依分頁排序）。
  sessions: T[];
  // 下一堂（這個分頁內最近一場尚未開始的；沒有就是分頁內第一場）。
  next: T;
  confirmedStudents: number;
  pendingStudents: number;
  urgent: SeriesUrgent;
};

export type ClassListEntry<T extends RollupSession> = { kind: "single"; session: T } | SeriesRollupCard<T>;

export function rollupClassList<T extends RollupSession>(
  sessionsInTab: T[],
  now: Date,
  options: { canCompleteOrigins?: ClassSessionOrigin[] } = {},
): ClassListEntry<T>[] {
  const canCompleteOrigins = options.canCompleteOrigins ?? ["teacher_initiated"];
  const entries: ClassListEntry<T>[] = [];
  const bySeries = new Map<string, T[]>();

  for (const session of sessionsInTab) {
    const seriesId = session.recurringClassSeriesId;

    if (!seriesId || !session.recurringClassSeries) {
      entries.push({ kind: "single", session });
      continue;
    }

    const group = bySeries.get(seriesId);

    if (group) {
      group.push(session);
      continue;
    }

    const created = [session];
    bySeries.set(seriesId, created);
    // 先放佔位，等全部收集完再補內容，保持第一場出現的位置。
    entries.push({ kind: "series", seriesId, sessions: created } as unknown as SeriesRollupCard<T>);
  }

  return entries.map((entry) => {
    if (entry.kind === "single") {
      return entry;
    }

    const sessions = entry.sessions;
    const series = sessions[0].recurringClassSeries!;
    const upcoming = sessions.filter((session) => session.startAt.getTime() > now.getTime());
    const next = [...upcoming].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0] ?? sessions[0];
    const confirmed = new Set<string>();
    const pending = new Set<string>();

    for (const session of sessions) {
      for (const enrollment of session.enrollments) {
        if (enrollment.status === "confirmed") confirmed.add(enrollment.userId);
        if (enrollment.status === "pending") pending.add(enrollment.userId);
      }
    }

    const awaitingCompletion = sessions.filter(
      (session) =>
        canCompleteOrigins.includes(session.origin) &&
        (session.status === "open_for_enrollment" || session.status === "confirmed") &&
        session.endAt.getTime() <= now.getTime(),
    ).length;
    const drafts = sessions.filter((session) => session.status === "draft").length;
    const pendingInOpen = new Set(
      sessions
        .filter((session) => session.status === "open_for_enrollment" || session.status === "confirmed")
        .flatMap((session) => session.enrollments.filter((enrollment) => enrollment.status === "pending").map((enrollment) => enrollment.userId)),
    ).size;
    const urgent: SeriesUrgent =
      pendingInOpen > 0
        ? { kind: "pending", count: pendingInOpen }
        : awaitingCompletion > 0
          ? { kind: "awaiting_completion", count: awaitingCompletion }
          : drafts > 0
            ? { kind: "drafts", count: drafts }
            : null;

    return {
      kind: "series",
      seriesId: entry.seriesId,
      title: series.title,
      seriesKind: series.kind,
      dayOfWeek: series.dayOfWeek,
      startTime: series.startTime,
      endTime: series.endTime,
      sessions,
      next,
      confirmedStudents: confirmed.size,
      pendingStudents: pending.size,
      urgent,
    };
  });
}

export function seriesUrgentLabel(urgent: SeriesUrgent): string | null {
  if (!urgent) return null;
  if (urgent.kind === "pending") return `${urgent.count} 人待確認`;
  if (urgent.kind === "awaiting_completion") return `${urgent.count} 堂已結束，待標記完成`;
  return `${urgent.count} 堂草稿待開放報名`;
}
