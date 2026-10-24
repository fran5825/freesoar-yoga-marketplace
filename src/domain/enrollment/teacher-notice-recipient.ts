import type { NotificationRecipient, NotificationTarget } from "@/domain/notification/types";

// teacher-first-run 票 04、05：報名成立、學員自己取消時，加一位授課老師（counterpart）收件人，帶老師自己的 target。
// 老師報名自己的課（或找不到老師）時回傳空陣列——老師不會因為自己的操作收到給老師的那則。
export function teacherNoticeRecipient(
  teacherUserId: string | null | undefined,
  memberUserId: string,
  target: NotificationTarget,
): NotificationRecipient[] {
  if (!teacherUserId || teacherUserId === memberUserId) {
    return [];
  }

  return [{ userId: teacherUserId, role: "counterpart", target }];
}
