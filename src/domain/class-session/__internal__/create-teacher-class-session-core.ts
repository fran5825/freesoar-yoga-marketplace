// teacher-initiated-open-classes 第 7 節：老師直接建課的核心，形狀比照既有
// create-class-session-core.ts，但不鎖 DemandRequest（老師自建課程沒有對應的 DemandRequest），
// 改為直接驗證呼叫者的 TeacherProfile.status === 'approved'（比照既有 demand-response
// 資格檢查慣例，單純讀取，不額外加鎖——TOCTOU 防護只在第 8 節的 enrollment 資格檢查上做，
// 這裡刻意不重複套用，維持跟已審查過的計畫範圍一致）。
//
// __internal__：不是通用 API，只給 (1) service.ts 的 createOwnClassSessionForTeacher 與
// generate-recurring-occurrences-core.ts 呼叫，(2) Playwright 併發測試直接呼叫。

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  lockTeacherScheduleAndCheckConflict,
  type ConflictLockHooks,
} from "@/domain/class-session/conflict-check";
import { notifyUsers } from "@/domain/notification/create";
import { formatDateRange } from "@/domain/notification/date-range";

export type CreateTeacherClassSessionInput = {
  title: string;
  description: string | null;
  // member-flow 票 03：選填；系列生成等未帶的呼叫端維持 null。
  suitableFor?: string | null;
  preparationNotes?: string | null;
  // lightweight-payment-v0：價格文字，老師選填；系列生成與補課複製系列的 priceNote。
  priceNote?: string | null;
  serviceType: string;
  serviceTypes?: string[];
  // 瑜伽類型：選填，沒帶就是空清單（與既有呼叫端相容）；老師建課的必填檢查在 validation 層。
  yogaStyles?: string[];
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
  // teacher-class-scheduling 票 01：建立後直接開放報名（狀態寫成 open_for_enrollment）。
  // 單場「開放報名」本來就不發通知，所以這裡也不多發。呼叫端須保證 startAt 在未來。
  openForEnrollment?: boolean;
};

export type CreateClassSessionForTeacherErrorCode =
  | "teacher_not_approved"
  | "recurring_series_not_found"
  | "teacher_schedule_conflict"
  | "create_failed";

export type CreateClassSessionForTeacherResult =
  | { ok: true; classSessionId: string }
  | { ok: false; code: CreateClassSessionForTeacherErrorCode };

// teacher-class-scheduling 票 01：commit 之後發通知所需的資料。在 transaction 內就取好，
// 不必在 commit 後再查（呼叫端的外層 transaction 還沒 commit 時，全域連線看不到新課）。
export type CreatedClassSessionNotice = {
  classSessionId: string;
  title: string;
  teacherUserId: string;
  // teacher-series-rollup 票 07：同一系列一次建立多堂時合併成一則（堂數、日期範圍、系列 id）。
  startAt: Date;
  recurringClassSeriesId: string | null;
};

export type CreateClassSessionForTeacherInTransactionResult =
  | { ok: true; created: CreatedClassSessionNotice }
  | { ok: false; code: Exclude<CreateClassSessionForTeacherErrorCode, "create_failed"> };

// teacher-class-scheduling 票 01：在呼叫端提供的 transaction 內建立一堂課。預期內的失敗
// （未通過審核、系列不屬於自己、撞課）都在寫入之前判斷並「回傳」，不拋例外，讓呼叫端（例如
// 系列生成）可以在同一個 transaction 裡跳過這一場、繼續下一場。不發通知：通知由呼叫端在
// 外層 transaction commit 之後用 notifyClassSessionsCreated 發送。
//
// 鎖定：撞課檢查會鎖 TeacherProfile。呼叫端若要先鎖 RecurringClassSeries，順序是
// 「系列 → 老師」，符合 docs/specs/teacher-class-scheduling-spec.md 第 6 節的全站鎖定順序。
export async function createClassSessionForTeacherInTransaction(
  tx: Prisma.TransactionClient,
  teacherProfileId: string,
  input: CreateTeacherClassSessionInput,
  hooks?: ConflictLockHooks,
): Promise<CreateClassSessionForTeacherInTransactionResult> {
  const teacherProfile = await tx.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: { status: true, userId: true },
  });

  if (!teacherProfile || teacherProfile.status !== "approved") {
    return { ok: false, code: "teacher_not_approved" };
  }

  if (input.recurringClassSeriesId) {
    const series = await tx.recurringClassSeries.findFirst({
      where: { id: input.recurringClassSeriesId, teacherProfileId },
      select: { id: true },
    });

    if (!series) {
      return { ok: false, code: "recurring_series_not_found" };
    }
  }

  // teacher-initiated-open-classes 第 6 節：先鎖 TeacherProfile 再查重疊、再寫入。hooks 轉交給
  // conflict-check 本身，因為真正的 FOR UPDATE 是在那個函式裡發出的。
  const conflict = await lockTeacherScheduleAndCheckConflict(
    tx,
    teacherProfileId,
    input.startAt,
    input.endAt,
    undefined,
    hooks,
  );

  if (conflict) {
    return { ok: false, code: "teacher_schedule_conflict" };
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
      suitableFor: input.suitableFor ?? null,
      preparationNotes: input.preparationNotes ?? null,
      priceNote: input.priceNote ?? null,
      serviceType: input.serviceType,
      serviceTypes: input.serviceTypes ?? [input.serviceType],
      yogaStyles: input.yogaStyles ?? [],
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location,
      capacity: input.capacity,
      isPublic: input.isPublic,
      requiresApproval: input.requiresApproval === true,
      status: input.openForEnrollment === true ? "open_for_enrollment" : "draft",
    },
    select: { id: true, title: true, startAt: true, recurringClassSeriesId: true },
  });

  return {
    ok: true,
    created: {
      classSessionId: classSession.id,
      title: classSession.title,
      teacherUserId: teacherProfile.userId,
      startAt: classSession.startAt,
      recurringClassSeriesId: classSession.recurringClassSeriesId,
    },
  };
}

// D4/D7 既有慣例：通知一律在 transaction commit 之後才發送，不進 transaction；通知失敗只記錄，
// 不撤銷已建立的課程。
export async function notifyClassSessionsCreated(
  createdList: CreatedClassSessionNotice[],
): Promise<void> {
  // teacher-series-rollup 票 07（ADR 0008）：同一位老師、同一個系列一次建立的多堂只發一則
  // （站內與 email 都是），內文寫堂數與日期範圍；不屬於系列的單堂維持一堂一則。
  const groups = new Map<string, CreatedClassSessionNotice[]>();

  for (const created of createdList) {
    const key = created.recurringClassSeriesId ? `${created.teacherUserId}:${created.recurringClassSeriesId}` : `single:${created.classSessionId}`;
    groups.set(key, [...(groups.get(key) ?? []), created]);
  }

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const first = sorted[0];

    try {
      await notifyUsers(
        "class_session_created",
        // 驗收發現：單堂沒有 target 時，同時是團主的老師會被連到團主的課程頁；單堂直達老師端那堂課。
        [
          sorted.length > 1
            ? { userId: first.teacherUserId, role: "self" }
            : { userId: first.teacherUserId, role: "self", target: { type: "teacher_class_session", id: first.classSessionId } },
        ],
        {
          classSessionTitle: first.title,
          ...(sorted.length > 1 ? { sessionCount: sorted.length, dateRange: formatDateRange(sorted[0].startAt, sorted.at(-1)!.startAt) } : {}),
        },
        undefined,
        // 一次建立多堂的批次通知連到系列頁。
        { recurringClassSeriesId: first.recurringClassSeriesId, linkToSeries: sorted.length > 1 },
      );
    } catch (notifyError) {
      console.error("[notification] class_session_created trigger failed", notifyError);
    }
  }
}

// D1/D2（Slice A）：Teacher own-scoped，一次到位建立單堂課。資格檢查（approved）→ conflict-check
// （鎖 TeacherProfile）→ 若帶 recurringClassSeriesId 驗證屬於自己 → 建立，origin 固定為
// teacher_initiated，demandRequestId／organizerProfileId／organizationId 皆為 null。
export async function createClassSessionForTeacher(
  teacherProfileId: string,
  input: CreateTeacherClassSessionInput,
  hooks?: ConflictLockHooks,
): Promise<CreateClassSessionForTeacherResult> {
  try {
    const result = await prisma.$transaction((tx) =>
      createClassSessionForTeacherInTransaction(tx, teacherProfileId, input, hooks),
    );

    if (!result.ok) {
      return result;
    }

    await notifyClassSessionsCreated([result.created]);

    return { ok: true, classSessionId: result.created.classSessionId };
  } catch (error) {
    console.error("[class-session] createClassSessionForTeacher failed", error);

    return { ok: false, code: "create_failed" };
  }
}
