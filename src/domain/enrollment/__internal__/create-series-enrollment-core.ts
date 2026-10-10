// teacher-class-scheduling 票 08：學員報名整期（docs/specs/teacher-class-scheduling-spec.md 4.7、第 6 節；ADR 0005）。
// __internal__：只給 service.ts 的 auth-resolving 外層與 Playwright 併發測試直接呼叫。
//
// 整段在同一個 transaction：
//   1. `FOR UPDATE` 鎖期班系列列（序列化所有改動「場次集合或整期報名」的操作），鎖內讀型態與報名方式。
//   2. 同一位學員對同一期班只能有一筆整期報名，含已退出／婉拒（推導規則 5）。
//   3. 依 id 排序鎖住尚未開始、未取消的場次；**取得場次鎖之後**才確認狀態、時間、名額與該學員既有報名
//      ——名額由場次鎖保護，單場報名不鎖系列（場次 → 老師），兩者不會互相卡住。
//   4. 鎖 TeacherProfile 並確認 approved。
//   5. 尚有草稿就不能報整期（推導規則 1）；任一場需新增報名但已滿，整期都不能報（Q24）。
//   6. 已有 pending／confirmed 單堂報名的場次併入、保留原狀態，不重複算名額；曾取消過的場次讓整期不能報（推導規則 9）。
//      讀取前先 `FOR UPDATE` 鎖住這位學員在這些場次的報名（鎖序：系列 → 場次 → 老師 → 學員既有報名；
//      學員取消、老師婉拒、管理員取消與整堂取消都不會在持有報名鎖後再去鎖場次或老師，不會形成循環）。
//   7. 建立整期報名與新增的逐場報名（來源 term_created），併入的改記為 merged_single。
// commit 之後才發一則通知（Q27）；通知失敗不影響報名結果。

import type { NotificationType } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

import { termNotificationTitle } from "../term-enrollment-copy";
import { buildEnrollmentPaymentSnapshot } from "../payment-snapshot";
import { occupyingEnrollmentWhere } from "../seat-occupancy";

export type CreateSeriesEnrollmentErrorCode =
  | "series_not_found"
  | "series_not_term"
  | "already_term_enrolled"
  | "term_no_remaining_sessions"
  | "term_not_fully_open"
  | "term_session_full"
  | "term_has_cancelled_enrollment"
  | "teacher_not_approved"
  | "create_failed";

export type CreateSeriesEnrollmentResult =
  | {
      ok: true;
      seriesEnrollmentId: string;
      status: "pending" | "confirmed";
      sessionCount: number;
      mergedCount: number;
    }
  | {
      ok: false;
      code: CreateSeriesEnrollmentErrorCode;
      // term_session_full／term_has_cancelled_enrollment：哪一場造成的，讓畫面說清楚。
      sessionStartAt?: Date;
      // term_has_cancelled_enrollment：那筆是學員自己取消的單堂報名（可以先到那一堂重新報名，R6）。
      reEnrollable?: boolean;
    };

export type SeriesEnrollmentHooks = {
  onSeriesLockAcquired?: () => void | Promise<void>;
  // 已讀取場次清單、尚未取得場次鎖之前（測試用來證明「讀取後最後一席被單場報名占走」時不會超收）。
  onBeforeSessionLock?: () => void | Promise<void>;
  onSessionsLockAcquired?: () => void | Promise<void>;
  // 已鎖住並讀取學員既有報名、尚未併入時（測試用來證明同時取消會等到併入之後）。
  onOwnEnrollmentsLocked?: () => void | Promise<void>;
};

export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

class Rejected extends Error {
  constructor(public readonly result: Extract<CreateSeriesEnrollmentResult, { ok: false }>) {
    super(result.code);
  }
}

type Outcome = {
  seriesEnrollmentId: string;
  status: "pending" | "confirmed";
  sessionCount: number;
  mergedCount: number;
  title: string;
  teacherUserId: string;
};

export async function createSeriesEnrollmentForUser(
  userId: string,
  recurringClassSeriesId: string,
  input: { notes: string | null },
  hooks?: SeriesEnrollmentHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CreateSeriesEnrollmentResult> {
  let outcome: Outcome;

  try {
    outcome = await prisma.$transaction(
      async (tx): Promise<Outcome> => {
        const lockedSeries = await tx.$queryRaw<
          {
            id: string;
            kind: string;
            teacherProfileId: string;
            title: string;
            requiresApproval: boolean;
            priceNote: string | null;
          }[]
        >`
          SELECT "id", "kind", "teacherProfileId", "title", "requiresApproval", "priceNote"
          FROM "RecurringClassSeries"
          WHERE "id" = ${recurringClassSeriesId}
          FOR UPDATE
        `;

        if (lockedSeries.length === 0) {
          throw new Rejected({ ok: false, code: "series_not_found" });
        }

        const series = lockedSeries[0];

        if (series.kind !== "term") {
          throw new Rejected({ ok: false, code: "series_not_term" });
        }

        await hooks?.onSeriesLockAcquired?.();

        const existing = await tx.seriesEnrollment.findUnique({
          where: { recurringClassSeriesId_userId: { recurringClassSeriesId, userId } },
          select: { id: true },
        });

        if (existing) {
          throw new Rejected({ ok: false, code: "already_term_enrolled" });
        }

        await hooks?.onBeforeSessionLock?.();

        const now = new Date();
        const sessions = await tx.$queryRaw<
          { id: string; status: string; capacity: number; startAt: Date }[]
        >`
          SELECT "id", "status", "capacity", "startAt" FROM "ClassSession"
          WHERE "recurringClassSeriesId" = ${recurringClassSeriesId}
            AND "status" <> 'cancelled'
            AND "startAt" > ${now}
          ORDER BY "id"
          FOR UPDATE
        `;

        await hooks?.onSessionsLockAcquired?.();

        if (sessions.length === 0) {
          throw new Rejected({ ok: false, code: "term_no_remaining_sessions" });
        }

        const lockedTeacher = await tx.$queryRaw<{ status: string; userId: string }[]>`
          SELECT "status", "userId" FROM "TeacherProfile"
          WHERE "id" = ${series.teacherProfileId}
          FOR UPDATE
        `;

        if (lockedTeacher[0]?.status !== "approved") {
          throw new Rejected({ ok: false, code: "teacher_not_approved" });
        }

        const byStart = [...sessions].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

        if (byStart.some((session) => session.status !== "open_for_enrollment")) {
          throw new Rejected({ ok: false, code: "term_not_fully_open" });
        }

        const sessionIds = byStart.map((session) => session.id);
        // 鎖住這位學員在這些場次的既有報名：讀到 pending／confirmed 之後到併入之前，學員取消或老師婉拒
        // 都要等這筆 transaction 結束，避免把剛取消的報名併入整期（推導規則 9；2026-10-09 Codex review）。
        const ownEnrollments = await tx.$queryRaw<{ id: string; classSessionId: string; status: string; cancelledBy: string | null; seriesEnrollmentId: string | null }[]>`
          SELECT "id", "classSessionId", "status", "cancelledBy", "seriesEnrollmentId" FROM "Enrollment"
          WHERE "userId" = ${userId} AND "classSessionId" = ANY(${sessionIds})
          ORDER BY "id"
          FOR UPDATE
        `;

        await hooks?.onOwnEnrollmentsLocked?.();
        const ownBySession = new Map(ownEnrollments.map((enrollment) => [enrollment.classSessionId, enrollment]));
        const activeCounts = await tx.enrollment.groupBy({
          by: ["classSessionId"],
          where: { classSessionId: { in: sessionIds }, ...occupyingEnrollmentWhere },
          _count: { _all: true },
        });
        const activeBySession = new Map(activeCounts.map((row) => [row.classSessionId, row._count._all]));

        const toMerge: string[] = [];
        const toCreate: string[] = [];

        for (const session of byStart) {
          const own = ownBySession.get(session.id);

          if (own && (own.status === "pending" || own.status === "confirmed")) {
            toMerge.push(own.id);
            continue;
          }

          if (own) {
            // 每位學員每場只能有一筆報名；已取消的那場不能被整期重新加入（推導規則 9）。
            throw new Rejected({
              ok: false,
              code: "term_has_cancelled_enrollment",
              sessionStartAt: session.startAt,
              reEnrollable: own.cancelledBy === "member" && own.seriesEnrollmentId === null,
            });
          }

          if ((activeBySession.get(session.id) ?? 0) >= session.capacity) {
            throw new Rejected({ ok: false, code: "term_session_full", sessionStartAt: session.startAt });
          }

          toCreate.push(session.id);
        }

        const status: "pending" | "confirmed" = series.requiresApproval ? "pending" : "confirmed";
        const consentedAt = new Date();
        const seriesEnrollment = await tx.seriesEnrollment.create({
          data: { recurringClassSeriesId, userId, status, notes: input.notes, consentedAt },
          select: { id: true },
        });

        // lightweight-payment-v0：期班的價格快照取系列 priceNote；併入的既有單堂報名保留它原本的快照，不覆寫（付款計畫 §6）。
        const paymentSnapshot = await buildEnrollmentPaymentSnapshot(tx, {
          teacherProfileId: series.teacherProfileId,
          priceNote: series.priceNote,
        });

        if (toCreate.length > 0) {
          await tx.enrollment.createMany({
            data: toCreate.map((classSessionId) => ({
              classSessionId,
              userId,
              status,
              notes: input.notes,
              consentedAt,
              seriesEnrollmentId: seriesEnrollment.id,
              seriesEnrollmentSource: "term_created" as const,
              ...paymentSnapshot,
            })),
          });
        }

        if (toMerge.length > 0) {
          await tx.enrollment.updateMany({
            where: { id: { in: toMerge } },
            data: { seriesEnrollmentId: seriesEnrollment.id, seriesEnrollmentSource: "merged_single" },
          });
        }

        return {
          seriesEnrollmentId: seriesEnrollment.id,
          status,
          sessionCount: byStart.length,
          mergedCount: toMerge.length,
          title: series.title,
          teacherUserId: lockedTeacher[0].userId,
        };
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof Rejected) {
      return error.result;
    }

    if (isUniqueConstraintViolation(error)) {
      // 同一位學員同時送出兩次整期報名：第二筆被 unique 擋下。
      return { ok: false, code: "already_term_enrolled" };
    }

    console.error("[series-enrollment] create failed", error);
    return { ok: false, code: "create_failed" };
  }

  try {
    const classSessionTitle = termNotificationTitle(outcome.title, outcome.sessionCount);

    if (outcome.status === "pending") {
      await notifyOverride(
        "enrollment_pending_review",
        [
          { userId, role: "self" },
          { userId: outcome.teacherUserId, role: "counterpart" },
        ],
        { classSessionTitle },
      );
    } else {
      await notifyOverride("enrollment_confirmed", [{ userId, role: "self" }], { classSessionTitle });
    }
  } catch (notifyError) {
    console.error("[notification] series enrollment trigger failed", notifyError);
  }

  return {
    ok: true,
    seriesEnrollmentId: outcome.seriesEnrollmentId,
    status: outcome.status,
    sessionCount: outcome.sessionCount,
    mergedCount: outcome.mergedCount,
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
