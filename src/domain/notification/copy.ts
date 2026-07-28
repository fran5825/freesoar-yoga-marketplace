import type { NotificationType } from "@prisma/client";

import type { NotificationPayload, NotificationRecipientRole } from "./types";

type NotificationCopy = { title: string; body: string };
type CopyBuilder = (payload: NotificationPayload) => NotificationCopy;
type CopyTable = Partial<
  Record<NotificationType, Partial<Record<NotificationRecipientRole, CopyBuilder>>>
>;

// D8：只涵蓋 D1 落地的 11 個事件；語氣依 notification-spec.md 的「Email Copy 原則」——
// 繁體中文、清楚溫和、不用「立即搶購」等焦慮式用語。
const COPY_TABLE: CopyTable = {
  teacher_application_submitted: {
    self: () => ({
      title: "老師申請已送出",
      body: "我們已經收到你的老師申請，審核後會通知你下一步。",
    }),
    admin: ({ actorLabel }) => ({
      title: "有新的老師申請待審核",
      body: `${actorLabel ?? "一位老師"}送出了申請，請前往後台查看。`,
    }),
  },
  teacher_application_approved: {
    self: () => ({
      title: "老師申請已通過",
      body: "你的老師申請已經通過審核，現在可以開始回應需求了。",
    }),
  },
  teacher_application_rejected: {
    self: ({ reason }) => ({
      title: "老師申請審核結果",
      body: reason
        ? `很抱歉，你的老師申請這次未通過審核。原因：${reason}`
        : "很抱歉，你的老師申請這次未通過審核。",
    }),
  },
  demand_request_submitted: {
    self: () => ({
      title: "需求已送出",
      body: "我們已經收到你的需求，審核後才會公開給合適的老師。",
    }),
    admin: ({ actorLabel }) => ({
      title: "有新的需求待審核",
      body: `${actorLabel ?? "一位團主"}送出了新的需求，請前往後台查看。`,
    }),
  },
  demand_request_published: {
    self: () => ({
      title: "需求已發布",
      body: "你的需求已經進入需求池，老師可以開始回應了。",
    }),
  },
  demand_request_rejected: {
    self: ({ reason }) => ({
      title: "需求審核結果",
      body: reason
        ? `很抱歉，你的需求這次未通過審核。原因：${reason}`
        : "很抱歉，你的需求這次未通過審核。",
    }),
  },
  demand_response_submitted: {
    counterpart: ({ actorLabel, demandTitle }) => ({
      title: "有老師回應了你的需求",
      body: `${actorLabel ?? "一位老師"}回應了你的需求「${demandTitle ?? ""}」，請前往查看。`,
    }),
    admin: () => ({
      title: "有新的需求回應",
      body: "有老師回應了一筆需求，請留意媒合進度。",
    }),
  },
  demand_response_selected: {
    self: () => ({
      title: "已選定老師",
      body: "你已經選定老師，媒合成立。",
    }),
    counterpart: ({ demandTitle }) => ({
      title: "你被選中了",
      body: `你的回應已被選中，需求「${demandTitle ?? ""}」媒合成立，接下來會由團主建立課程場次。`,
    }),
  },
  class_session_created: {
    self: ({ classSessionTitle }) => ({
      title: "課程已建立",
      body: `課程「${classSessionTitle ?? ""}」已經建立完成。`,
    }),
    counterpart: ({ classSessionTitle }) => ({
      title: "課程已建立",
      body: `你的課程「${classSessionTitle ?? ""}」已經建立完成。`,
    }),
  },
  enrollment_confirmed: {
    self: ({ classSessionTitle }) => ({
      title: "報名成功",
      body: `你已經成功報名「${classSessionTitle ?? ""}」。`,
    }),
  },
  enrollment_cancelled: {
    self: ({ classSessionTitle }) => ({
      title: "報名已取消",
      body: `你已經取消「${classSessionTitle ?? ""}」的報名。`,
    }),
  },
  class_session_cancelled: {
    self: ({ classSessionTitle }) => ({
      title: "課程已取消",
      body: `你已經取消「${classSessionTitle ?? ""}」。`,
    }),
    counterpart: ({ classSessionTitle }) => ({
      title: "課程已取消",
      body: `你的課程「${classSessionTitle ?? ""}」已經取消。`,
    }),
    affected_member: ({ classSessionTitle }) => ({
      title: "課程已取消",
      body: `「${classSessionTitle ?? ""}」已經取消，你的報名也一併取消了。`,
    }),
  },
};

export function buildNotificationCopy(
  type: NotificationType,
  role: NotificationRecipientRole,
  payload: NotificationPayload,
): NotificationCopy {
  const builder = COPY_TABLE[type]?.[role];

  if (!builder) {
    throw new Error(`No notification copy defined for type="${type}" role="${role}"`);
  }

  return builder(payload);
}
