// inline-member-enroll 票 06（spec 2.1、2.3）：三處列表（系列頁、單堂頁同系列列表、期班頁每一堂）共用的「場次列」。
// 每一列要顯示什麼（報名、重新報名、取消報名、整期的請假／取消請假、或只有原因文字）在這裡一次算好，元件只負責顯示。
// 單堂與整期的操作資格沿用既有規則，不另外發明：
//   - 整期的列：getTermRowControl（請假、取消請假、不能取消請假的原因）。
//   - 自己取消過的單堂：getReEnrollState（能不能重新報名、為什麼不能）。
//   - 有效的單堂報名能不能取消：與 cancelOwnEnrollment 相同（處理中／已報名、尚未開始）。
//   - 沒有紀錄能不能報：與 createEnrollmentForUser 的前置條件相同（開放報名、未開始、老師 approved、有名額、不是只收整期）。
// 實際送出時 service 仍在鎖內重新判斷；這裡只是讓畫面不出現送出後必然失敗的按鈕。
//
// loadEnrollRows 只讀呼叫端傳入的場次（呼叫端已依自己的可見性規則篩過），不另外放寬可見性。
import type {
  ClassSessionStatus,
  EnrollmentCancelledBy,
  EnrollmentStatus,
  SeriesEnrollmentStatus,
  TermEnrollmentMode,
} from "@prisma/client";

import { getClassAvailability } from "@/domain/class-session/availability";
import { prisma } from "@/lib/prisma";

import { getReEnrollState } from "./re-enroll-eligibility";
import { occupyingEnrollmentWhere } from "./seat-occupancy";
import { getTermRowControl, type TermRowControl } from "./term-row-controls";

export type EnrollRowReason =
  | "full"
  | "started"
  | "closed"
  | "teacher_unavailable"
  | "term_only"
  | "blocked_teacher"
  | "blocked_admin"
  | "blocked_other"
  | "series_withdrawn"
  | "series_declined";

export type EnrollRowState =
  // 沒有紀錄可以報名，或自己取消過、可以重新報名（reEnroll）。
  | { kind: "enroll"; reEnroll: boolean }
  // 不能報名（或不能重新報名）的原因，沒有按鈕。
  | { kind: "reason"; reason: EnrollRowReason }
  // 自己的單堂報名（處理中／已報名）；canCancel＝尚未開始，可以取消報名。
  | { kind: "single"; status: "pending" | "confirmed"; canCancel: boolean }
  // 自己的整期報名那一堂：動作完全由 TermRowControl 決定（請假、取消請假、原因、無）。
  | { kind: "term"; status: EnrollmentStatus; control: TermRowControl }
  // 其他已結束的紀錄（例如已出席），只顯示狀態。
  | { kind: "status_only"; status: EnrollmentStatus };

export type EnrollRowInput = {
  classStatus: ClassSessionStatus | string;
  startAt: Date;
  capacity: number;
  occupiedCount: number;
  teacherApproved: boolean;
  termEnrollmentMode: TermEnrollmentMode | null;
  own: {
    status: EnrollmentStatus;
    cancelledBy: EnrollmentCancelledBy | null;
    seriesEnrollmentId: string | null;
    seriesEnrollmentStatus: SeriesEnrollmentStatus | null;
  } | null;
  now?: Date;
};

export function computeEnrollRowState(input: EnrollRowInput): EnrollRowState {
  const now = input.now ?? new Date();
  const own = input.own;

  if (own?.seriesEnrollmentId) {
    // 整期已退出或被婉拒：被連帶取消的那幾堂只說原因（spec 2.1）；已上過、紀錄仍有效的場次照常顯示狀態。
    if (own.status === "cancelled" && own.seriesEnrollmentStatus === "withdrawn") {
      return { kind: "reason", reason: "series_withdrawn" };
    }

    if (own.status === "cancelled" && own.seriesEnrollmentStatus === "declined") {
      return { kind: "reason", reason: "series_declined" };
    }

    return {
      kind: "term",
      status: own.status,
      control: getTermRowControl({
        status: own.status,
        cancelledBy: own.cancelledBy,
        seriesEnrollmentId: own.seriesEnrollmentId,
        seriesEnrollmentStatus: own.seriesEnrollmentStatus,
        termEnrollmentMode: input.termEnrollmentMode,
        classStatus: input.classStatus,
        startAt: input.startAt,
        capacity: input.capacity,
        occupiedCount: input.occupiedCount,
        teacherApproved: input.teacherApproved,
        now,
      }),
    };
  }

  if (own && (own.status === "pending" || own.status === "confirmed")) {
    return { kind: "single", status: own.status, canCancel: input.startAt.getTime() > now.getTime() };
  }

  if (own && own.status === "cancelled") {
    const state = getReEnrollState({
      status: own.status,
      cancelledBy: own.cancelledBy,
      seriesEnrollmentId: null,
      seriesEnrollmentStatus: null,
      termEnrollmentMode: input.termEnrollmentMode,
      classStatus: input.classStatus,
      startAt: input.startAt,
      capacity: input.capacity,
      occupiedCount: input.occupiedCount,
      teacherApproved: input.teacherApproved,
      now,
    });

    switch (state.state) {
      case "available":
        return { kind: "enroll", reEnroll: true };
      case "full":
        return { kind: "reason", reason: "full" };
      case "started":
        return { kind: "reason", reason: "started" };
      case "teacher_unavailable":
        return { kind: "reason", reason: "teacher_unavailable" };
      case "blocked":
        if (state.reason === "teacher") return { kind: "reason", reason: "blocked_teacher" };
        if (state.reason === "admin") return { kind: "reason", reason: "blocked_admin" };
        if (state.reason === "term_only") return { kind: "reason", reason: "term_only" };
        return { kind: "reason", reason: "blocked_other" };
      default:
        return { kind: "reason", reason: "blocked_other" };
    }
  }

  if (own) {
    return { kind: "status_only", status: own.status };
  }

  if (input.startAt.getTime() <= now.getTime() || input.classStatus === "completed") {
    return { kind: "reason", reason: "started" };
  }

  if (input.classStatus !== "open_for_enrollment") {
    return { kind: "reason", reason: "closed" };
  }

  if (input.termEnrollmentMode === "term_only") {
    return { kind: "reason", reason: "term_only" };
  }

  if (!input.teacherApproved) {
    return { kind: "reason", reason: "teacher_unavailable" };
  }

  const availability = getClassAvailability({
    capacity: input.capacity,
    activeEnrollmentCount: input.occupiedCount,
    startAt: input.startAt,
    now,
  });

  return availability.state === "open" ? { kind: "enroll", reEnroll: false } : { kind: "reason", reason: "full" };
}

export type EnrollRow = {
  classSessionId: string;
  startAt: Date;
  endAt: Date;
  remainingSeats: number;
  requiresApproval: boolean;
  // spec 2.3：這一場實際適用的價格與繳費規則（沒填是 null）。
  priceNote: string | null;
  paymentRulesText: string | null;
  ownEnrollmentId: string | null;
  termEnrollmentMode: TermEnrollmentMode | null;
  state: EnrollRowState;
};

// 列的穩定 ID（spec 2.2）：用場次 id，沒報名的列也有。
export function enrollRowId(classSessionId: string): string {
  return `session-row-${classSessionId}`;
}

export async function loadEnrollRows(classSessionIds: string[], userId: string | null): Promise<Map<string, EnrollRow>> {
  if (classSessionIds.length === 0) {
    return new Map();
  }

  const [sessions, ownRows] = await Promise.all([
    prisma.classSession.findMany({
      where: { id: { in: classSessionIds } },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        capacity: true,
        requiresApproval: true,
        priceNote: true,
        teacherProfile: { select: { status: true, paymentRulesText: true } },
        recurringClassSeries: { select: { kind: true, termEnrollmentMode: true } },
        _count: { select: { enrollments: { where: occupyingEnrollmentWhere } } },
      },
    }),
    userId
      ? prisma.enrollment.findMany({
          where: { userId, classSessionId: { in: classSessionIds } },
          select: {
            id: true,
            classSessionId: true,
            status: true,
            cancelledBy: true,
            seriesEnrollmentId: true,
            seriesEnrollment: { select: { status: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const ownBySession = new Map(ownRows.map((row) => [row.classSessionId, row]));
  const now = new Date();

  return new Map(
    sessions.map((session) => {
      const own = ownBySession.get(session.id);
      const termEnrollmentMode =
        session.recurringClassSeries?.kind === "term" ? session.recurringClassSeries.termEnrollmentMode : null;

      return [
        session.id,
        {
          classSessionId: session.id,
          startAt: session.startAt,
          endAt: session.endAt,
          remainingSeats: Math.max(session.capacity - session._count.enrollments, 0),
          requiresApproval: session.requiresApproval,
          priceNote: session.priceNote,
          paymentRulesText: session.teacherProfile.paymentRulesText,
          ownEnrollmentId: own?.id ?? null,
          termEnrollmentMode,
          state: computeEnrollRowState({
            classStatus: session.status,
            startAt: session.startAt,
            capacity: session.capacity,
            occupiedCount: session._count.enrollments,
            teacherApproved: session.teacherProfile.status === "approved",
            termEnrollmentMode,
            own: own
              ? {
                  status: own.status,
                  cancelledBy: own.cancelledBy,
                  seriesEnrollmentId: own.seriesEnrollmentId,
                  seriesEnrollmentStatus: own.seriesEnrollment?.status ?? null,
                }
              : null,
            now,
          }),
        },
      ];
    }),
  );
}
