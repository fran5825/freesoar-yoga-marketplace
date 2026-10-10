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
  teacher_profile_suspended: {
    self: ({ reason }) => ({
      title: "老師資格已暫停",
      body: `你的老師資格已經暫停。原因：${reason ?? ""}`,
    }),
  },
  teacher_photo_removed: {
    self: ({ reason }) => ({
      title: "有一張照片已被下架",
      body: `管理員下架了你的一張照片，它不會再出現在任何頁面。原因：${reason ?? ""}。你可以到「老師資料 › 照片」重新上傳合適的照片。`,
    }),
  },
  teacher_profile_restored: {
    self: () => ({
      title: "老師資格已恢復",
      body: "你的老師資格已經恢復，可以重新回應需求了。",
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
  demand_request_cancelled: {
    self: ({ demandTitle }) => ({
      title: "需求已取消",
      body: `你已經取消「${demandTitle ?? ""}」。`,
    }),
    affected_responder: ({ demandTitle }) => ({
      title: "需求已取消",
      body: `你回應的需求「${demandTitle ?? ""}」已經取消。`,
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
  // organizer-usability-redesign 票 12：合作邀請。收件人都是對方（counterpart）：邀請、更新、撤回給
  // 受邀老師，確認、婉拒給團主。actorLabel 是對方的顯示名稱，classSessionTitle 是邀請的課程名稱。
  class_proposal_invited: {
    counterpart: ({ actorLabel, classSessionTitle }) => ({
      title: "你收到一份合作邀請",
      body: `${actorLabel ?? "一位團主"}邀請你帶「${classSessionTitle ?? "團課"}」。請查看時間與地點，再決定確認或婉拒。`,
    }),
  },
  class_proposal_revised: {
    counterpart: ({ actorLabel, classSessionTitle }) => ({
      title: "合作邀請的內容已更新",
      body: `${actorLabel ?? "團主"}更新了「${classSessionTitle ?? "團課"}」的課程安排，請查看最新內容後再確認或婉拒。`,
    }),
  },
  class_proposal_withdrawn: {
    counterpart: ({ actorLabel, classSessionTitle, reason }) => ({
      title: "合作邀請已取消",
      body: `${actorLabel ?? "團主"}已取消「${classSessionTitle ?? "團課"}」的合作邀請，這個時段不再為這堂課保留。${reason ? `說明：${reason}` : ""}`,
    }),
  },
  class_proposal_confirmed: {
    counterpart: ({ actorLabel, classSessionTitle }) => ({
      title: "老師已確認授課",
      body: `${actorLabel ?? "老師"}已確認「${classSessionTitle ?? "團課"}」，現在可以開放團員報名。`,
    }),
  },
  class_proposal_declined: {
    counterpart: ({ actorLabel, classSessionTitle, reason }) => ({
      title: "老師婉拒了合作邀請",
      body: `${actorLabel ?? "老師"}婉拒了「${classSessionTitle ?? "團課"}」。${reason ? `原因：${reason}。` : ""}你可以修改內容後重新邀請，或改邀其他老師。`,
    }),
  },
  enrollment_confirmed: {
    self: ({ classSessionTitle }) => ({
      title: "報名成功",
      body: `你已經成功報名「${classSessionTitle ?? ""}」。`,
    }),
  },
  // teacher-initiated-open-classes 第 8 節（Gate G2/G3）：requiresApproval = true 的課程，
  // 新報名先落在 pending，發送這個事件而不是 enrollment_confirmed；老師確認後才改發
  // enrollment_confirmed。counterpart（老師）也要收到通知，否則審核機制永遠不會被觸發。
  enrollment_pending_review: {
    self: ({ classSessionTitle }) => ({
      title: "報名已送出，等待老師確認",
      body: `你已經送出「${classSessionTitle ?? ""}」的報名，老師確認後才算報名成功。`,
    }),
    counterpart: ({ classSessionTitle }) => ({
      title: "有新的報名待確認",
      body: `「${classSessionTitle ?? ""}」有新的報名，需要你確認或拒絕。`,
    }),
  },
  enrollment_cancelled: {
    self: ({ classSessionTitle }) => ({
      title: "報名已取消",
      body: `「${classSessionTitle ?? ""}」的報名已經取消。`,
    }),
  },
  // teacher-class-scheduling 票 04：老師改了時間或地點，通知該場已報名（含待確認）的學員；報名照樣保留。
  class_session_changed: {
    affected_member: ({ classSessionTitle, changeSummary }) => ({
      title: "課程時間或地點有變更",
      body: `「${classSessionTitle ?? ""}」有變更：${changeSummary ?? "上課資訊有變更"}。你的報名仍然有效，如果不能來，可以到我的報名取消。`,
    }),
  },
  class_session_cancelled: {
    self: ({ classSessionTitle }) => ({
      title: "課程已取消",
      body: `「${classSessionTitle ?? ""}」已經取消。`,
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
  class_session_completed: {
    affected_member: ({ classSessionTitle }) => ({
      title: "課程已完成，邀請留下評價",
      body: `「${classSessionTitle ?? ""}」已經完成，歡迎留下你的評價，讓其他人參考。`,
    }),
  },
  review_submitted: {
    counterpart: ({ actorLabel, classSessionTitle }) => ({
      title: "課程收到新評價",
      body: `${actorLabel ?? "一位會員"}對你的課程「${classSessionTitle ?? ""}」留下了評價。`,
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
