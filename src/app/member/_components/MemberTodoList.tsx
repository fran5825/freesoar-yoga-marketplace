import Link from "next/link";

import type { MemberTodo } from "@/domain/enrollment/member-todos";
import { classDetailHref } from "@/lib/navigation/class-return-path";

const todoCopy: Record<MemberTodo["kind"], { label: string; text: string }> = {
  review: { label: "待評價", text: "課程已結束，留下你的評價吧" },
  pending: { label: "等老師確認", text: "報名已送出，老師確認後會顯示在「通知」" },
};

// inline-member-actions 票 04：「待你處理」（輪到學員）沒有事項就整張不出現，有事項時放在頁面第一張卡；
// 「等待老師確認」不算待你處理，另外一張卡、放在原本的位置，沒有同樣不出現。domain 判斷不變。
type TodoReturnTo = "/member/dashboard" | "/member/enrollments";

export function MemberTodoList({ todos, returnTo }: { todos: MemberTodo[]; returnTo: TodoReturnTo }) {
  const review = todos.filter((todo) => todo.kind === "review");

  return review.length > 0 ? <TodoSection todos={review} heading="待你處理" id="member-todo-heading" returnTo={returnTo} /> : null;
}

export function MemberWaitingList({ todos, returnTo }: { todos: MemberTodo[]; returnTo: TodoReturnTo }) {
  const pending = todos.filter((todo) => todo.kind === "pending");

  return pending.length > 0 ? <TodoSection todos={pending} heading="等待老師確認" id="member-waiting-heading" returnTo={returnTo} /> : null;
}

function TodoSection({ todos, heading, id, returnTo }: { todos: MemberTodo[]; heading: string; id: string; returnTo: string }) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-ink/15 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-ink" id={id}>
        {heading}
      </h2>
      {todos.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-soft">目前沒有待處理事項</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {todos.map((todo) => (
            <li key={`${todo.kind}-${todo.enrollmentId}`}>
              <Link
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-ink/10 px-4 py-3 transition hover:border-pine/40 hover:bg-pine-tint/60"
                href={
                  todo.kind === "review"
                    ? `/member/enrollments#enrollment-${todo.enrollmentId}`
                    : classDetailHref(todo.classSessionId, returnTo)
                }
              >
                <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
                  {todoCopy[todo.kind].label}
                </span>
                <span className="min-w-0 break-words text-sm font-medium text-ink">
                  {todo.title}
                </span>
                <span className="text-sm text-ink-soft">{todoCopy[todo.kind].text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
