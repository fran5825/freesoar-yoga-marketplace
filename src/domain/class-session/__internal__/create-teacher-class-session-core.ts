// teacher-initiated-open-classes 第 7 節：老師直接建課的核心，形狀比照既有
// create-class-session-core.ts，但不鎖 DemandRequest（老師自建課程沒有對應的 DemandRequest），
// 改為直接驗證呼叫者的 TeacherProfile.status === 'approved'（比照既有 demand-response
// 資格檢查慣例，單純讀取，不額外加鎖——TOCTOU 防護只在第 8 節的 enrollment 資格檢查上做，
// 這裡刻意不重複套用，維持跟已審查過的計畫範圍一致）。
//
// __internal__：不是通用 API，只給 (1) service.ts 的 createOwnClassSessionForTeacher 與
// generate-recurring-occurrences-core.ts 呼叫，(2) Playwright 併發測試直接呼叫。

import { prisma } from "@/lib/prisma";
import {
  lockTeacherScheduleAndCheckConflict,
  type ConflictLockHooks,
} from "@/domain/class-session/conflict-check";
import { notifyUsers } from "@/domain/notification/create";

export type CreateTeacherClassSessionInput = {
  title: string;
  description: string | null;
  serviceType: string;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  isPublic: boolean;
  // 第 8 節（Gate G2/G3）：老師可選擇這堂課的新報名是否需要自己確認才算成立。選填，
  // 預設 false（跟既有行為一致）——維持與 validateClassSessionCreate() 共用的既有呼叫端
  // （單堂建課的 validation.normalized 沒有這個欄位）相容，不強制每個呼叫端都要帶。
  requiresApproval?: boolean;
  recurringClassSeriesId?: string;
};

export type CreateClassSessionForTeacherErrorCode =
  | "teacher_not_approved"
  | "recurring_series_not_found"
  | "teacher_schedule_conflict"
  | "create_failed";

export type CreateClassSessionForTeacherResult =
  | { ok: true; classSessionId: string }
  | { ok: false; code: CreateClassSessionForTeacherErrorCode };

class TeacherNotApprovedError extends Error {
  constructor() {
    super("Teacher profile is not approved");
    this.name = "TeacherNotApprovedError";
  }
}

class RecurringSeriesNotFoundError extends Error {
  constructor() {
    super("Recurring class series not found or not owned by this teacher");
    this.name = "RecurringSeriesNotFoundError";
  }
}

class TeacherScheduleConflictError extends Error {
  constructor() {
    super("Teacher already has another class session in this time range");
    this.name = "TeacherScheduleConflictError";
  }
}

// D1/D2（Slice A）：Teacher own-scoped，一次到位建立。資格檢查（approved）→ conflict-check
// （一律先鎖 TeacherProfile，鎖定順序與 Organizer 路徑一致）→ 若帶 recurringClassSeriesId
// 驗證屬於自己 → 建立，origin 固定為 teacher_initiated，demandRequestId／
// organizerProfileId／organizationId 皆為 null。
export async function createClassSessionForTeacher(
  teacherProfileId: string,
  input: CreateTeacherClassSessionInput,
  hooks?: ConflictLockHooks,
): Promise<CreateClassSessionForTeacherResult> {
  try {
    const classSessionId = await prisma.$transaction(async (tx) => {
      const teacherProfile = await tx.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: { status: true },
      });

      if (!teacherProfile || teacherProfile.status !== "approved") {
        throw new TeacherNotApprovedError();
      }

      if (input.recurringClassSeriesId) {
        const series = await tx.recurringClassSeries.findFirst({
          where: { id: input.recurringClassSeriesId, teacherProfileId },
          select: { id: true },
        });

        if (!series) {
          throw new RecurringSeriesNotFoundError();
        }
      }

      // teacher-initiated-open-classes 第 6 節：一律先鎖 TeacherProfile 再進行其他任何
      // 查詢/寫入——這裡是本函式唯一取得的鎖，鎖定順序天然與 Organizer 路徑一致（兩者都是
      // 「先鎖 TeacherProfile」）。hooks 轉交給 conflict-check 本身，因為真正的 FOR UPDATE
      // 是在那個函式裡發出的，同步點必須開在鎖真正被取得的地方，不能開在這裡（此處尚未鎖）。
      const conflict = await lockTeacherScheduleAndCheckConflict(
        tx,
        teacherProfileId,
        input.startAt,
        input.endAt,
        undefined,
        hooks,
      );

      if (conflict) {
        throw new TeacherScheduleConflictError();
      }

      const classSession = await tx.classSession.create({
        data: {
          origin: "teacher_initiated",
          teacherProfileId,
          demandRequestId: null,
          organizerProfileId: null,
          organizationId: null,
          recurringClassSeriesId: input.recurringClassSeriesId ?? null,
          title: input.title,
          description: input.description,
          serviceType: input.serviceType,
          startAt: input.startAt,
          endAt: input.endAt,
          location: input.location,
          capacity: input.capacity,
          isPublic: input.isPublic,
          requiresApproval: input.requiresApproval === true,
        },
        select: { id: true },
      });

      return classSession.id;
    });

    // D4/D7 既有慣例：resolver query + notifyUsers 一律在 tx commit 之後才執行，不進 tx。
    try {
      const detail = await prisma.classSession.findUnique({
        where: { id: classSessionId },
        select: { title: true, teacherProfile: { select: { userId: true } } },
      });

      if (detail) {
        await notifyUsers(
          "class_session_created",
          [{ userId: detail.teacherProfile.userId, role: "self" }],
          { classSessionTitle: detail.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] class_session_created trigger failed", notifyError);
    }

    return { ok: true, classSessionId };
  } catch (error) {
    if (error instanceof TeacherNotApprovedError) {
      return { ok: false, code: "teacher_not_approved" };
    }

    if (error instanceof RecurringSeriesNotFoundError) {
      return { ok: false, code: "recurring_series_not_found" };
    }

    if (error instanceof TeacherScheduleConflictError) {
      return { ok: false, code: "teacher_schedule_conflict" };
    }

    return { ok: false, code: "create_failed" };
  }
}
