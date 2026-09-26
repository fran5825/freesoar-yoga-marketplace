import type { ClassSessionOrigin, ClassSessionStatus } from "@prisma/client";

// teacher-usability 第 06／08 票：老師端課程「下一步」的共用文案。
// 課程詳情頁、課程列表卡片、老師總覽「待你處理」都從這裡取，避免同一個狀態在不同頁面說法不一樣。
// 只依課程狀態、來源、待確認報名數與時間決定，不改狀態機；`kind` 讓畫面決定要不要放進「待你處理」。
export type TeacherClassNextStepKind = "action" | "waiting" | "info";

export type TeacherClassNextStep = {
  kind: TeacherClassNextStepKind;
  // 詳情頁與總覽的完整說明。
  message: string;
  // 列表卡片用的一句話（較短）。
  shortMessage: string;
};

export function getTeacherClassNextStep(input: {
  status: ClassSessionStatus;
  origin: ClassSessionOrigin;
  pendingEnrollmentCount: number;
  endAt: Date;
  now?: Date;
}): TeacherClassNextStep {
  const { status, origin, pendingEnrollmentCount } = input;
  const now = input.now ?? new Date();
  const isOwnClass = origin === "teacher_initiated";
  const hasEnded = input.endAt.getTime() <= now.getTime();

  // 待確認報名最優先：學員在等老師回覆。
  if (
    pendingEnrollmentCount > 0 &&
    (status === "open_for_enrollment" || status === "confirmed")
  ) {
    return {
      kind: "action",
      message: `有 ${pendingEnrollmentCount} 筆報名等你確認，請看看報名備註後確認或婉拒。`,
      shortMessage: `${pendingEnrollmentCount} 筆報名待確認`,
    };
  }

  switch (status) {
    case "draft":
      return isOwnClass
        ? {
            kind: "action",
            message: "課程已建立但還沒開放報名。確認內容沒問題後，按「開放報名」讓學員可以報名。",
            shortMessage: "草稿：請開放報名",
          }
        : {
            kind: "waiting",
            message: "團主還在準備這堂課，開放報名後會出現在這裡。",
            shortMessage: "等待團主開放報名",
          };
    case "pending_confirmation":
      return {
        kind: "waiting",
        message: "這堂課正在等待確認。",
        shortMessage: "等待確認",
      };
    case "open_for_enrollment":
    case "confirmed":
      if (hasEnded) {
        return isOwnClass
          ? {
              kind: "action",
              message: "課程時間已經過了。上完課後請按「標記完成」，學員才會收到留下評價的邀請。",
              shortMessage: "已結束：請標記完成",
            }
          : {
              kind: "waiting",
              message: "課程時間已經過了，等待團主標記完成。",
              shortMessage: "已結束，等待團主標記完成",
            };
      }

      return {
        kind: "info",
        message: "課程正在開放報名，報名狀況會即時顯示在這裡。",
        shortMessage: "開放報名中",
      };
    case "completed":
      return {
        kind: "info",
        message: "課程已完成，學員的評價會顯示在這裡。",
        shortMessage: "已完成",
      };
    case "cancelled":
      return {
        kind: "info",
        message: "這堂課已取消。",
        shortMessage: "已取消",
      };
  }
}

// teacher-usability 第 08、09 票：老師總覽「待你處理」清單。
// 排序依急迫度：① 報名待確認 ② 團主已選定你、等待建立課程（等待中，不是老師要做的事）
// ③ 課程時間已過、還沒標記完成 ④ 草稿課程還沒開放報名。同一類裡依上課時間由近到遠。
export type TeacherTodoItem = {
  kind: "action" | "waiting";
  label: string;
  message: string;
  href: string;
};

type TodoClassInput = {
  id: string;
  title: string;
  status: ClassSessionStatus;
  origin: ClassSessionOrigin;
  startAt: Date;
  endAt: Date;
  enrollments: { status: string }[];
};

export function buildTeacherTodoItems(input: {
  classSessions: TodoClassInput[];
  selectedResponsesAwaitingClass: { demandRequestId: string; demandTitle: string }[];
  now?: Date;
}): TeacherTodoItem[] {
  const now = input.now ?? new Date();
  const byStart = [...input.classSessions].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const pending: TeacherTodoItem[] = [];
  const ended: TeacherTodoItem[] = [];
  const drafts: TeacherTodoItem[] = [];

  for (const classSession of byStart) {
    const pendingCount = classSession.enrollments.filter(
      (enrollment) => enrollment.status === "pending",
    ).length;
    const nextStep = getTeacherClassNextStep({
      status: classSession.status,
      origin: classSession.origin,
      pendingEnrollmentCount: pendingCount,
      endAt: classSession.endAt,
      now,
    });

    if (nextStep.kind !== "action") {
      continue;
    }

    const item: TeacherTodoItem = {
      kind: "action",
      label: nextStep.shortMessage,
      message: `「${classSession.title}」${nextStep.message}`,
      href: `/teacher/classes/${classSession.id}`,
    };

    if (pendingCount > 0) {
      pending.push(item);
    } else if (classSession.status === "draft") {
      drafts.push(item);
    } else {
      ended.push(item);
    }
  }

  const awaitingClass: TeacherTodoItem[] = input.selectedResponsesAwaitingClass.map(
    (response) => ({
      kind: "waiting",
      label: "等待團主建立課程",
      message: `團主已選你合作「${response.demandTitle}」，正在安排課程，建立後會出現在「我的課程」。`,
      href: `/teacher/demands/${response.demandRequestId}`,
    }),
  );

  return [...pending, ...awaitingClass, ...ended, ...drafts];
}
