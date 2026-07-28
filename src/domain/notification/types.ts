export type NotificationRecipientRole = "self" | "admin" | "counterpart";

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
