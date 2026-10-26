import type { ClassSessionStatus } from "@prisma/client";

import { getClassDraftKind } from "./draft-kind";

// organizer-post-match-handoff 票 02（spec「總覽「待你處理」」）：團主建完課、還沒開放報名的課，
// 放進總覽「待你處理」，點了直達那堂課。只列「可開放的草稿」：開課時間已過的草稿開放與取消都會失敗，
// 列出來也無法處理。按「開放報名」成功後狀態不再是 draft，自然不會再出現。
export type OrganizerClassTodoItem = {
  title: string;
  message: string;
  href: string;
};

export function buildOrganizerClassTodoItems(
  classSessions: { id: string; title: string; status: ClassSessionStatus; startAt: Date }[],
  now: Date = new Date(),
): OrganizerClassTodoItem[] {
  return classSessions
    .filter((classSession) => getClassDraftKind(classSession, now) === "openable_draft")
    .map((classSession) => ({
      title: `「${classSession.title}」還沒開放報名`,
      message: "學員還看不到這堂課",
      href: `/organizer/classes/${classSession.id}`,
    }));
}
