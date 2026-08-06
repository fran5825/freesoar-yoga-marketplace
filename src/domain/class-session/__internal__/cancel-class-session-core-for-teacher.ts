// teacher-initiated-open-classes 第 7 節：既有 cancel-class-session-core.ts 的私有
// cancelClassSessionCore(organizerProfileId: string | null, ...) 只支援兩種擁有權語意——
// null 代表 Admin（不過濾）、非 null 代表用該值過濾 organizerProfileId。這個函式沒有第三種
// 「用 teacherProfileId 過濾」的設計空間，因此複製同一段 transaction 形狀，差異只是鎖查詢的
// WHERE 用 teacherProfileId 過濾。這是刻意的取捨：複製一段已經被完整測試過的 transaction
// 形狀，比重構共用核心去容納第三種擁有權語意，對既有 Organizer/Admin 取消流程的回歸風險小
// 得多。
//
// Slice C：連帶取消的 Enrollment 涵蓋 status IN (confirmed, pending)，與既有 Organizer 版本
// （cancel-class-session-core.ts）的同一處放寬同步完成。

import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/domain/notification/create";
import type {
  DemandLockHooks,
  NotifyFn,
} from "@/domain/class-session/__internal__/cancel-class-session-core";

export type CancelClassSessionForTeacherErrorCode =
  | "class_session_not_found"
  | "class_session_already_cancelled"
  | "class_session_already_started"
  | "class_session_not_cancellable"
  | "cancel_failed";

export type CancelClassSessionForTeacherResult =
  | { ok: true }
  | { ok: false; code: CancelClassSessionForTeacherErrorCode };

class ClassSessionNotFoundError extends Error {
  constructor() {
    super("Class session not found or not owned by this teacher");
    this.name = "ClassSessionNotFoundError";
  }
}

class ClassSessionAlreadyCancelledError extends Error {
  constructor() {
    super("Class session is already cancelled");
    this.name = "ClassSessionAlreadyCancelledError";
  }
}

class ClassSessionAlreadyStartedError extends Error {
  constructor() {
    super("Class session has already started");
    this.name = "ClassSessionAlreadyStartedError";
  }
}

class ClassSessionNotCancellableError extends Error {
  constructor() {
    super("Class session is not in a cancellable state");
    this.name = "ClassSessionNotCancellableError";
  }
}

const CANCELLABLE_STATUSES = new Set(["draft", "open_for_enrollment"]);

// 比照既有 cancelClassSessionCore 的形狀：(a) 鎖住 ClassSession 並驗證 teacherProfileId 擁有權；
// (b) 檢查尚未是 cancelled；(c) 檢查狀態在可取消集合內；(d) 檢查 startAt > now；(e) 轉成
// cancelled；(f) 連帶把所有 confirmed Enrollment 轉成 cancelled，RETURNING userId 供通知使用。
export async function cancelClassSessionForTeacher(
  teacherProfileId: string,
  classSessionId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelClassSessionForTeacherResult> {
  try {
    const { title, affectedMemberUserIds } = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      const lockedClassSession = await tx.$queryRaw<
        { id: string; status: string; startAt: Date; title: string }[]
      >`
          SELECT "id", "status", "startAt", "title"
          FROM "ClassSession"
          WHERE "id" = ${classSessionId} AND "teacherProfileId" = ${teacherProfileId}
          FOR UPDATE
        `;

      if (lockedClassSession.length === 0) {
        throw new ClassSessionNotFoundError();
      }

      await hooks?.onLockAcquired?.();

      const classSession = lockedClassSession[0];

      if (classSession.status === "cancelled") {
        throw new ClassSessionAlreadyCancelledError();
      }

      if (!CANCELLABLE_STATUSES.has(classSession.status)) {
        throw new ClassSessionNotCancellableError();
      }

      if (classSession.startAt.getTime() <= Date.now()) {
        throw new ClassSessionAlreadyStartedError();
      }

      await tx.classSession.update({
        where: { id: classSessionId },
        data: { status: "cancelled" },
      });

      const now = new Date();
      // teacher-initiated-open-classes 第 8 節：連帶取消同步涵蓋 pending，跟既有 organizer/
      // admin 版（cancel-class-session-core.ts）的同一處修正一起完成，避免老師自建課程被
      // 取消時，等待審核中的報名被遺留成孤兒資料。
      const cancelledEnrollments = await tx.$queryRaw<{ userId: string }[]>`
          UPDATE "Enrollment"
          SET "status" = 'cancelled'::"EnrollmentStatus", "updatedAt" = ${now}
          WHERE "classSessionId" = ${classSessionId}
            AND "status" = ANY(ARRAY['confirmed', 'pending']::"EnrollmentStatus"[])
          RETURNING "userId"
        `;

      return {
        title: classSession.title,
        affectedMemberUserIds: cancelledEnrollments.map((row) => row.userId),
      };
    });

    // resolver query + notify 一律在 tx commit 之後才執行，不進 tx；例外在這裡被吞掉。
    try {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        select: { userId: true },
      });

      const recipients = [
        ...(teacherProfile ? [{ userId: teacherProfile.userId, role: "self" as const }] : []),
        ...affectedMemberUserIds.map((userId) => ({ userId, role: "affected_member" as const })),
      ];

      await notifyOverride("class_session_cancelled", recipients, { classSessionTitle: title });
    } catch (notifyError) {
      console.error("[notification] class_session_cancelled trigger failed", notifyError);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof ClassSessionNotFoundError) {
      return { ok: false, code: "class_session_not_found" };
    }

    if (error instanceof ClassSessionAlreadyCancelledError) {
      return { ok: false, code: "class_session_already_cancelled" };
    }

    if (error instanceof ClassSessionAlreadyStartedError) {
      return { ok: false, code: "class_session_already_started" };
    }

    if (error instanceof ClassSessionNotCancellableError) {
      return { ok: false, code: "class_session_not_cancellable" };
    }

    return { ok: false, code: "cancel_failed" };
  }
}
