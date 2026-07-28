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

export type NotificationRecipient = {
  userId: string;
  role: NotificationRecipientRole;
};

// 各 NotificationType 的文案函式（見 copy.ts）依需要挑選這裡的欄位使用，
// 未用到的欄位保持 undefined 即可。
export type NotificationPayload = {
  actorLabel?: string;
  reason?: string;
  demandTitle?: string;
  classSessionTitle?: string;
};
