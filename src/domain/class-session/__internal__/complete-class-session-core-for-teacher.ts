// teacher-initiated-open-classes 第 7 節：複製既有 completeOwnClassSession
// （src/domain/class-session/service.ts）的單一 updateMany 形狀，過濾條件改為
// teacherProfileId。Codex round 2 修正——completeOwnClassSession 成功後不只是單一
// updateMany，還會在 tx commit 之後查出所有 confirmed enrollment 並發送
// class_session_completed 通知（邀請留下評價）；這裡必須複製這整段 post-commit 通知邏輯，
// 不能只複製 updateMany，否則老師自建課程完成後學生完全不會收到評價邀請，同一個
// ClassSession model 的「完成」行為會依來源不同而不一致。

import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/domain/notification/create";

export type CompleteClassSessionForTeacherErrorCode =
  | "class_session_not_found"
  | "class_session_already_completed"
  | "class_session_not_completable"
  | "class_session_not_ended"
  | "class_session_complete_failed";

export type CompleteClassSessionForTeacherResult =
  | { ok: true }
  | { ok: false; code: CompleteClassSessionForTeacherErrorCode };

// 比照既有 completeOwnClassSession：單一 organizer/teacher、單一狀態欄位翻轉，沒有多方競爭
// 同一資源的併發場景，不需要 $transaction + FOR UPDATE。只在函式最開頭呼叫一次 `new Date()`，
// 同時用於 updateMany 的 guard 與失敗後分類查詢的比較，避免兩次獨立取時在極端邊界下互相矛盾。
export async function completeClassSessionForTeacher(
  teacherProfileId: string,
  classSessionId: string,
): Promise<CompleteClassSessionForTeacherResult> {
  const now = new Date();

  const updateResult = await prisma.classSession.updateMany({
    where: {
      id: classSessionId,
      teacherProfileId,
      status: "open_for_enrollment",
      endAt: { lte: now },
    },
    data: { status: "completed" },
  });

  if (updateResult.count > 0) {
    try {
      const detail = await prisma.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          title: true,
          enrollments: {
            where: { status: "confirmed" },
            select: { userId: true },
          },
        },
      });

      if (detail && detail.enrollments.length > 0) {
        await notifyUsers(
          "class_session_completed",
          detail.enrollments.map((enrollment) => ({
            userId: enrollment.userId,
            role: "affected_member" as const,
          })),
          { classSessionTitle: detail.title },
        );
      }
    } catch (notifyError) {
      console.error("[notification] class_session_completed trigger failed", notifyError);
    }

    return { ok: true };
  }

  const classSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, teacherProfileId },
    select: { status: true, endAt: true },
  });

  if (!classSession) {
    return { ok: false, code: "class_session_not_found" };
  }

  if (classSession.status === "completed") {
    return { ok: false, code: "class_session_already_completed" };
  }

  if (classSession.status !== "open_for_enrollment") {
    return { ok: false, code: "class_session_not_completable" };
  }

  if (classSession.endAt.getTime() > now.getTime()) {
    return { ok: false, code: "class_session_not_ended" };
  }

  return { ok: false, code: "class_session_complete_failed" };
}
