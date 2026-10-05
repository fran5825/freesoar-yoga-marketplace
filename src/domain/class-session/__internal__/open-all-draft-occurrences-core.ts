// teacher-class-scheduling 票 01：系列「全部開放報名」的核心。不依賴登入狀態（呼叫端傳入
// teacherProfileId），讓 Playwright 能直接驗證 own-scope、資格檢查與併發行為；對外的登入檢查在
// service.ts 的 openAllDraftOccurrencesForTeacher。
//
// 鎖定：先 `FOR UPDATE` 鎖本人系列列（改動系列場次集合的序列化邊界，見
// docs/specs/teacher-class-scheduling-spec.md 第 6 節），鎖內確認老師為 approved，再把尚未開始的
// 草稿一次改成 open_for_enrollment。單場「開放報名」本來就不發通知，這裡也不發。

import { prisma } from "@/lib/prisma";

export type OpenAllDraftOccurrencesForTeacherErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "teacher_not_approved"
  | "series_not_found";

export type OpenAllDraftOccurrencesForTeacherResult =
  | { ok: true; openedCount: number }
  | { ok: false; code: OpenAllDraftOccurrencesForTeacherErrorCode; message: string };

export async function openAllDraftOccurrencesForTeacherProfile(
  teacherProfileId: string,
  recurringClassSeriesId: string,
): Promise<OpenAllDraftOccurrencesForTeacherResult> {
  return prisma.$transaction(async (tx): Promise<OpenAllDraftOccurrencesForTeacherResult> => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "RecurringClassSeries"
      WHERE "id" = ${recurringClassSeriesId} AND "teacherProfileId" = ${teacherProfileId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      return {
        ok: false,
        code: "series_not_found",
        message: "找不到這個課程系列，或你沒有權限操作。",
      };
    }

    const teacherProfile = await tx.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      select: { status: true },
    });

    if (teacherProfile?.status !== "approved") {
      return {
        ok: false,
        code: "teacher_not_approved",
        message: "只有審核通過的老師才能開放報名。",
      };
    }

    const updated = await tx.classSession.updateMany({
      where: {
        recurringClassSeriesId,
        teacherProfileId,
        // organizer-usability-redesign 票 09：老師端只動自己開的課（系列場次本來就是 teacher_initiated，
        // 這裡再明確限定，與單堂開放／取消一致）。
        origin: "teacher_initiated",
        status: "draft",
        startAt: { gt: new Date() },
      },
      data: { status: "open_for_enrollment" },
    });

    return { ok: true, openedCount: updated.count };
  });
}

