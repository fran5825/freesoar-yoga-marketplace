import type { ClassSessionOrigin, ClassSessionStatus } from "@prisma/client";

import { formatTaipeiShortDatetime } from "./timezone";

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
// teacher-class-scheduling 票 01：同一個系列的草稿合併成一張卡片（連到系列頁、列出最近日期），
// 單堂草稿卡片也顯示日期，避免出現好幾張一模一樣、看不出是哪天的卡片。
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
  recurringClassSeriesId?: string | null;
  recurringClassSeries?: { title: string } | null;
};

// 合併卡片上最多列出幾個日期。
const SERIES_DRAFT_DATES_SHOWN = 3;

// teacher-class-scheduling 票 02：每週固定系列快排完時，提醒老師「生成更多」。排在最後（⑤），
// 因為還沒影響到已排定的課。
type SeriesNeedingMoreInput = {
  id: string;
  title: string;
  remainingCount: number;
  lastUpcomingStartAt: Date | null;
};

export function buildTeacherTodoItems(input: {
  classSessions: TodoClassInput[];
  selectedResponsesAwaitingClass: { demandRequestId: string; demandTitle: string }[];
  seriesNeedingMore?: SeriesNeedingMoreInput[];
  now?: Date;
}): TeacherTodoItem[] {
  const now = input.now ?? new Date();
  const byStart = [...input.classSessions].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const pending: TeacherTodoItem[] = [];
  const ended: TeacherTodoItem[] = [];
  const drafts: TeacherTodoItem[] = [];
  // 系列草稿：依系列分組，保留第一次出現（最近一場）的位置，排序與其他草稿一致。
  const seriesDrafts = new Map<string, { title: string; startAts: Date[]; index: number }>();

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

    if (pendingCount === 0 && classSession.status === "draft" && classSession.recurringClassSeriesId) {
      const group = seriesDrafts.get(classSession.recurringClassSeriesId);

      if (group) {
        group.startAts.push(classSession.startAt);
      } else {
        seriesDrafts.set(classSession.recurringClassSeriesId, {
          title: classSession.recurringClassSeries?.title ?? classSession.title,
          startAts: [classSession.startAt],
          index: drafts.length,
        });
        // 先放一個位置，迴圈結束後換成合併卡片。
        drafts.push({ kind: "action", label: "", message: "", href: "" });
      }

      continue;
    }

    const datePrefix =
      classSession.status === "draft" ? `（${formatTaipeiShortDatetime(classSession.startAt)}）` : "";
    const item: TeacherTodoItem = {
      kind: "action",
      label: nextStep.shortMessage,
      message: `「${classSession.title}」${datePrefix}${nextStep.message}`,
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

  for (const [seriesId, group] of seriesDrafts) {
    const shownDates = group.startAts
      .slice(0, SERIES_DRAFT_DATES_SHOWN)
      .map((startAt) => formatTaipeiShortDatetime(startAt))
      .join("、");
    const moreText =
      group.startAts.length > SERIES_DRAFT_DATES_SHOWN
        ? ` 等 ${group.startAts.length} 場`
        : "";

    drafts[group.index] = {
      kind: "action",
      label: `草稿：${group.startAts.length} 場還沒開放報名`,
      message: `「${group.title}」系列的 ${shownDates}${moreText}還是草稿。到系列頁確認後，可以按「全部開放報名」一次開放。`,
      href: `/teacher/classes/series/${seriesId}`,
    };
  }

  const awaitingClass: TeacherTodoItem[] = input.selectedResponsesAwaitingClass.map(
    (response) => ({
      kind: "waiting",
      label: "等待團主建立課程",
      message: `團主已選你合作「${response.demandTitle}」，正在安排課程，建立後會出現在「我的課程」。`,
      href: `/teacher/demands/${response.demandRequestId}`,
    }),
  );

  const generateMore: TeacherTodoItem[] = (input.seriesNeedingMore ?? []).map((series) => ({
    kind: "action",
    label:
      series.remainingCount === 0 ? "常態班：已經沒有之後的場次" : `常態班：只剩 ${series.remainingCount} 場`,
    message:
      series.remainingCount === 0 || !series.lastUpcomingStartAt
        ? `「${series.title}」已經沒有之後的場次。要繼續上課的話，到系列頁按「生成更多」。`
        : `「${series.title}」最後一場是 ${formatTaipeiShortDatetime(series.lastUpcomingStartAt)}。要繼續上課的話，到系列頁按「生成更多」。`,
    href: `/teacher/classes/series/${series.id}#generate-more`,
  }));

  return [...pending, ...awaitingClass, ...ended, ...drafts, ...generateMore];
}
