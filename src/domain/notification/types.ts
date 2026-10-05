import type { NotificationTargetType } from "@prisma/client";

// affected_member：class_session_cancelled 專用，區別於 counterpart（授課 Teacher）——
// 同一個事件需要對 Teacher 與被連帶取消的 Member 各自給不同文案，不能共用 counterpart。
// affected_responder：demand_request_cancelled 專用，代表因連帶取消而被轉為 declined
// 的 Teacher——語意上跟 affected_member 是同一種「連帶受影響的第三方」，但角色名稱
// 刻意精確描述對象（Teacher／回應者，不是 Member／報名者），不共用 affected_member。
export type NotificationRecipientRole =
  | "self"
  | "admin"
  | "counterpart"
  | "affected_member"
  | "affected_responder";

// organizer-usability-redesign 票 12：通知可直達的單筆頁。targetType 是白名單 enum，連結由
// link.ts 依 type 推導，不存網址；同一個事件給不同角色時，各收件人可以有不同的 target。
export type NotificationTarget = {
  type: NotificationTargetType;
  id: string;
};

export type NotificationRecipient = {
  userId: string;
  role: NotificationRecipientRole;
  target?: NotificationTarget;
};

// 票 12：同一事件的識別（例如「邀請 id＋transitionSeq」）。每位收件人的 eventKey＝
// `${eventKeyBase}:${userId}`，重試時資料庫的 unique 限制擋下第二筆，視為已發送。
export type NotifyOptions = {
  eventKeyBase?: string;
};

// 各 NotificationType 的文案函式（見 copy.ts）依需要挑選這裡的欄位使用，
// 未用到的欄位保持 undefined 即可。
export type NotificationPayload = {
  actorLabel?: string;
  reason?: string;
  demandTitle?: string;
  classSessionTitle?: string;
  // teacher-class-scheduling 票 04：改課時「改了什麼」的一句話摘要（只列有改的時間／地點）。
  changeSummary?: string;
};
