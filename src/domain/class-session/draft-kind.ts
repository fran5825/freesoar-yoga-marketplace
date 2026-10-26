import type { ClassSessionStatus } from "@prisma/client";

// organizer-post-match-handoff 票 01（spec「草稿分兩種」）：團主課程還沒開放報名時分兩種。
// - openable_draft：還是草稿、開課時間還沒到，按「開放報名」就能開放。
// - expired_draft：還是草稿、開課時間已到或已過。開放（openOwnClassSessionForEnrollment 要求
//   startAt > now）與取消都會失敗，團主也沒有改課功能，畫面不能再引導去按「開放報名」。
// 總覽、課程列表、課程頁、需求下一步共用這個判斷，不各自比時間。
export type ClassDraftKind = "openable_draft" | "expired_draft" | "not_draft";

export function getClassDraftKind(
  classSession: { status: ClassSessionStatus; startAt: Date },
  now: Date = new Date(),
): ClassDraftKind {
  if (classSession.status !== "draft") {
    return "not_draft";
  }

  // 與 service 的 `startAt: { gt: now }` 一致：剛好等於現在也算已過。
  return classSession.startAt.getTime() > now.getTime() ? "openable_draft" : "expired_draft";
}
