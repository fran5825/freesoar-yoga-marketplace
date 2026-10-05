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

import type { Prisma } from "@prisma/client";

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

const CANCELLABLE_STATUSES = new Set(["draft", "open_for_enrollment"]);

// teacher-class-scheduling 票 03：commit 之後發取消通知所需的資料，在 transaction 內就取好。
export type CancelledClassSessionNotice = {
  title: string;
  affectedMemberUserIds: string[];
};

export type CancelClassSessionForTeacherInTransactionResult =
  | { ok: true; cancelled: CancelledClassSessionNotice }
  | { ok: false; code: Exclude<CancelClassSessionForTeacherErrorCode, "cancel_failed"> };

// 比照既有 cancelClassSessionCore 的形狀：(a) 鎖住 ClassSession 並驗證 teacherProfileId 擁有權；
// (b) 檢查尚未是 cancelled；(c) 檢查狀態在可取消集合內；(d) 檢查 startAt > now；(e) 轉成
// cancelled；(f) 連帶把 confirmed／pending Enrollment 轉成 cancelled，RETURNING userId 供通知使用。
//
// teacher-class-scheduling 票 03：拆成可在呼叫端 transaction 內執行的版本。預期內的失敗在寫入前
// 「回傳」而不是拋例外，讓批次取消（從這場以後全部取消）可以在同一個 transaction 內逐場處理。
// 不發通知：由呼叫端在 commit 之後呼叫 notifyClassSessionCancelledForTeacher。
export async function cancelClassSessionForTeacherInTransaction(
  tx: Prisma.TransactionClient,
  teacherProfileId: string,
  classSessionId: string,
  hooks?: DemandLockHooks,
): Promise<CancelClassSessionForTeacherInTransactionResult> {
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
    return { ok: false, code: "class_session_not_found" };
  }

  await hooks?.onLockAcquired?.();

  const classSession = lockedClassSession[0];

  if (classSession.status === "cancelled") {
    return { ok: false, code: "class_session_already_cancelled" };
  }

  if (!CANCELLABLE_STATUSES.has(classSession.status)) {
    return { ok: false, code: "class_session_not_cancellable" };
  }

  if (classSession.startAt.getTime() <= Date.now()) {
    return { ok: false, code: "class_session_already_started" };
  }

  await tx.classSession.update({
    where: { id: classSessionId },
    data: { status: "cancelled" },
  });

  const now = new Date();
  // teacher-initiated-open-classes 第 8 節：連帶取消同步涵蓋 pending，避免等待審核中的報名
  // 被遺留成孤兒資料。
  const cancelledEnrollments = await tx.$queryRaw<{ userId: string }[]>`
      UPDATE "Enrollment"
      SET "status" = 'cancelled'::"EnrollmentStatus", "updatedAt" = ${now}
      WHERE "classSessionId" = ${classSessionId}
        AND "status" = ANY(ARRAY['confirmed', 'pending']::"EnrollmentStatus"[])
      RETURNING "userId"
    `;

  return {
    ok: true,
    cancelled: {
      title: classSession.title,
      affectedMemberUserIds: cancelledEnrollments.map((row) => row.userId),
    },
  };
}

// resolver query + notify 一律在 tx commit 之後才執行，不進 tx；例外在這裡被吞掉。
export async function notifyClassSessionCancelledForTeacher(
  teacherProfileId: string,
  cancelled: CancelledClassSessionNotice,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<void> {
  try {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      select: { userId: true },
    });

    const recipients = [
      ...(teacherProfile ? [{ userId: teacherProfile.userId, role: "self" as const }] : []),
      ...cancelled.affectedMemberUserIds.map((userId) => ({
        userId,
        role: "affected_member" as const,
      })),
    ];

    await notifyOverride("class_session_cancelled", recipients, {
      classSessionTitle: cancelled.title,
    });
  } catch (notifyError) {
    console.error("[notification] class_session_cancelled trigger failed", notifyError);
  }
}

export async function cancelClassSessionForTeacher(
  teacherProfileId: string,
  classSessionId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelClassSessionForTeacherResult> {
  try {
    const result = await prisma.$transaction((tx) =>
      cancelClassSessionForTeacherInTransaction(tx, teacherProfileId, classSessionId, hooks),
    );

    if (!result.ok) {
      return result;
    }

    await notifyClassSessionCancelledForTeacher(teacherProfileId, result.cancelled, notifyOverride);

    return { ok: true };
  } catch {
    return { ok: false, code: "cancel_failed" };
  }
}
