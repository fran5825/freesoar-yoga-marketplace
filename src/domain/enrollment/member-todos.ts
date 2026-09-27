import type { OwnEnrollment } from "./read-service";

// 學員「待你處理」的項目（/member/enrollments 與 /member/dashboard 共用）。
// - pending：報名已送出、老師還沒確認，課程尚未開始，學員只需要知道「在等老師」。
// - review：報名已成立（confirmed）、課程已完成、自己還沒留評價。
// 只用 listOwnEnrollmentsForMember() 已帶出的欄位判斷，不需要額外查詢。
export type MemberTodoKind = "pending" | "review";

export type MemberTodo = {
  kind: MemberTodoKind;
  enrollmentId: string;
  classSessionId: string;
  title: string;
};

export function getMemberTodos(
  enrollments: OwnEnrollment[],
  now: Date = new Date(),
): MemberTodo[] {
  const todos: MemberTodo[] = [];

  for (const enrollment of enrollments) {
    const { classSession } = enrollment;
    const base = {
      enrollmentId: enrollment.id,
      classSessionId: classSession.id,
      title: classSession.title,
    };

    if (
      enrollment.status === "pending" &&
      classSession.status !== "cancelled" &&
      classSession.status !== "completed" &&
      classSession.startAt.getTime() > now.getTime()
    ) {
      todos.push({ kind: "pending", ...base });
    }

    if (
      enrollment.status === "confirmed" &&
      classSession.status === "completed" &&
      classSession.reviews.length === 0
    ) {
      todos.push({ kind: "review", ...base });
    }
  }

  // 待評價（學員要動手）排在待老師確認（學員只能等）前面。
  return todos.sort((a, b) => Number(b.kind === "review") - Number(a.kind === "review"));
}
