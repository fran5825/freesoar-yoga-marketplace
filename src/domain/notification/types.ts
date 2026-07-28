// affected_member：class_session_cancelled 專用，區別於 counterpart（授課 Teacher）——
// 同一個事件需要對 Teacher 與被連帶取消的 Member 各自給不同文案，不能共用 counterpart。
export type NotificationRecipientRole =
  | "self"
  | "admin"
  | "counterpart"
  | "affected_member";

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
