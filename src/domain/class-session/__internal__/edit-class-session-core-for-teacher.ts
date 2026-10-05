// teacher-class-scheduling 票 04：老師改課（單堂）。
//
// 可以改：標題、說明、課程風格、瑜伽類型、時間、地點、人數上限。不能改：是否需要確認報名（推導規則 6）、
// 公開設定（票 06）。只限老師自己開的課（origin = teacher_initiated）、狀態為 draft／open_for_enrollment、
// 尚未開始，且老師為 approved。
// 票 05：系列中的場次也可以用這個核心「只改這場」（可以改日期，產品主人決定 D）；系列設定不變。
// 「改這場和之後所有場次」在 edit-series-from-occurrence-core.ts。
//
// 所有條件都在 server 端、同一個 transaction 內檢查（不靠 UI 隱藏）：
//   1. `FOR UPDATE` 鎖住這堂課（own-scope 寫在 WHERE）——與單場報名搶同一把鎖。
//   2. 鎖內檢查 origin／系列／狀態／開始時間。
//   3. 鎖 TeacherProfile 並確認 approved（與管理員暫停互相排隊）。
//   4. 驗證欄位（沿用建立單堂的規則）；時間有變才跑撞課檢查（排除自己）。
//   5. 人數上限不得低於 pending + confirmed（在課程鎖內計數，新報名無法插隊）。
// 鎖定順序「場次 → 老師」與單場報名相同（docs/specs/teacher-class-scheduling-spec.md 第 6 節）。
// 改課不改變任何狀態；已報名的報名原樣保留。改時間或地點時，commit 之後通知該場 pending／confirmed 學員。
//
// 不依賴登入狀態（呼叫端傳入 teacherProfileId），讓測試能直接驗證；登入檢查在 service.ts。

import { prisma } from "@/lib/prisma";
import { lockTeacherScheduleAndCheckConflict } from "@/domain/class-session/conflict-check";
import { notifyUsers } from "@/domain/notification/create";

import { formatTaipeiShortDatetime } from "../timezone";
import {
  validateClassSessionCreate,
  type ClassSessionValidationError,
} from "../validation";

export type EditClassSessionForTeacherInput = {
  title?: string | null;
  description?: string | null;
  serviceTypes?: string[] | null;
  yogaStyles?: string[] | null;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  capacity?: number | null;
};

export type EditClassSessionForTeacherErrorCode =
  | "class_session_not_found"
  | "class_session_not_editable"
  | "class_session_already_started"
  | "teacher_not_approved"
  | "validation_failed"
  | "teacher_schedule_conflict"
  | "capacity_below_enrolled";

export type EditClassSessionForTeacherResult =
  | { ok: true; notifiedMemberCount: number; timeChanged: boolean; locationChanged: boolean }
  | {
      ok: false;
      code: EditClassSessionForTeacherErrorCode;
      validationErrors?: ClassSessionValidationError[];
      // capacity_below_enrolled 時回傳目前已報名（含待確認）人數，讓畫面說清楚。
      enrolledCount?: number;
    };

export type EditClassSessionHooks = {
  onSessionLockAcquired?: () => void | Promise<void>;
};

type ChangeNotice = {
  title: string;
  newStartAt: Date;
  newEndAt: Date;
  newLocation: string;
  timeChanged: boolean;
  locationChanged: boolean;
  memberUserIds: string[];
};

class EditRejected extends Error {
  constructor(public readonly result: Extract<EditClassSessionForTeacherResult, { ok: false }>) {
    super(result.code);
  }
}

export async function editClassSessionForTeacher(
  teacherProfileId: string,
  classSessionId: string,
  input: EditClassSessionForTeacherInput,
  hooks?: EditClassSessionHooks,
): Promise<EditClassSessionForTeacherResult> {
  let notice: ChangeNotice;

  try {
    notice = await prisma.$transaction(async (tx): Promise<ChangeNotice> => {
      const locked = await tx.$queryRaw<
        {
          id: string;
          status: string;
          origin: string;
          recurringClassSeriesId: string | null;
          startAt: Date;
          endAt: Date;
          location: string;
        }[]
      >`
        SELECT "id", "status", "origin", "recurringClassSeriesId", "startAt", "endAt", "location"
        FROM "ClassSession"
        WHERE "id" = ${classSessionId} AND "teacherProfileId" = ${teacherProfileId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new EditRejected({ ok: false, code: "class_session_not_found" });
      }

      await hooks?.onSessionLockAcquired?.();

      const current = locked[0];

      if (
        current.origin !== "teacher_initiated" ||
        (current.status !== "draft" && current.status !== "open_for_enrollment")
      ) {
        throw new EditRejected({ ok: false, code: "class_session_not_editable" });
      }

      if (current.startAt.getTime() <= Date.now()) {
        throw new EditRejected({ ok: false, code: "class_session_already_started" });
      }

      const lockedTeacher = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "TeacherProfile" WHERE "id" = ${teacherProfileId} FOR UPDATE
      `;

      if (lockedTeacher[0]?.status !== "approved") {
        throw new EditRejected({ ok: false, code: "teacher_not_approved" });
      }

      const validation = validateClassSessionCreate(
        {
          title: input.title,
          description: input.description,
          serviceTypes: input.serviceTypes,
          yogaStyles: input.yogaStyles,
          startAt: input.startAt,
          endAt: input.endAt,
          location: input.location,
          capacity: input.capacity,
        },
        { requireYogaStyles: true },
      );

      if (!validation.valid) {
        throw new EditRejected({
          ok: false,
          code: "validation_failed",
          validationErrors: validation.errors,
        });
      }

      const next = validation.normalized;
      const timeChanged =
        next.startAt.getTime() !== current.startAt.getTime() ||
        next.endAt.getTime() !== current.endAt.getTime();
      const locationChanged = next.location !== current.location;

      if (timeChanged) {
        const conflict = await lockTeacherScheduleAndCheckConflict(
          tx,
          teacherProfileId,
          next.startAt,
          next.endAt,
          classSessionId,
        );

        if (conflict) {
          throw new EditRejected({ ok: false, code: "teacher_schedule_conflict" });
        }
      }

      const activeEnrollments = await tx.enrollment.findMany({
        where: { classSessionId, status: { in: ["pending", "confirmed"] } },
        select: { userId: true },
      });

      if (next.capacity < activeEnrollments.length) {
        throw new EditRejected({
          ok: false,
          code: "capacity_below_enrolled",
          enrolledCount: activeEnrollments.length,
        });
      }

      await tx.classSession.update({
        where: { id: classSessionId },
        data: {
          title: next.title,
          description: next.description,
          serviceType: next.serviceType,
          serviceTypes: next.serviceTypes,
          yogaStyles: next.yogaStyles,
          startAt: next.startAt,
          endAt: next.endAt,
          location: next.location,
          capacity: next.capacity,
        },
      });

      return {
        title: next.title,
        newStartAt: next.startAt,
        newEndAt: next.endAt,
        newLocation: next.location,
        timeChanged,
        locationChanged,
        memberUserIds:
          timeChanged || locationChanged ? activeEnrollments.map((enrollment) => enrollment.userId) : [],
      };
    });
  } catch (error) {
    if (error instanceof EditRejected) {
      return error.result;
    }

    throw error;
  }

  // 通知一律在 commit 之後；失敗只記錄，不撤銷已完成的修改。
  if (notice.memberUserIds.length > 0) {
    try {
      await notifyUsers(
        "class_session_changed",
        notice.memberUserIds.map((userId) => ({ userId, role: "affected_member" as const })),
        { classSessionTitle: notice.title, changeSummary: buildChangeSummary(notice) },
      );
    } catch (notifyError) {
      console.error("[notification] class_session_changed trigger failed", notifyError);
    }
  }

  return {
    ok: true,
    notifiedMemberCount: notice.memberUserIds.length,
    timeChanged: notice.timeChanged,
    locationChanged: notice.locationChanged,
  };
}

const taipeiTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// 只列出真的有改的項目，例如「上課時間改為 10/13（二）19:30–20:30；地點改為 台北市…」。
export function buildChangeSummary(notice: {
  newStartAt: Date;
  newEndAt: Date;
  newLocation: string;
  timeChanged: boolean;
  locationChanged: boolean;
}): string {
  const parts: string[] = [];

  if (notice.timeChanged) {
    parts.push(
      `上課時間改為 ${formatTaipeiShortDatetime(notice.newStartAt)}–${taipeiTimeFormatter.format(notice.newEndAt)}`,
    );
  }

  if (notice.locationChanged) {
    parts.push(`地點改為 ${notice.newLocation}`);
  }

  return parts.join("；");
}
