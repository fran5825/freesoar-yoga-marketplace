import type { NotificationType } from "@prisma/client";

export type NotificationSenderInput = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
};

export type NotificationSender = (notification: NotificationSenderInput) => Promise<void>;

// D2：本輪唯一的 NotificationSender 實作。對 channel="in_app" 而言，記錄成功寫入
// 資料庫就等於已經送達（收件人可在 /notifications 讀到），所以不做任何額外網路呼叫。
// 未來要接真的 email provider，只需要新增另一個實作同一介面的 adapter（例如
// emailNotificationSender），呼叫端與 notifyUsers 的邏輯完全不用改。
export const inAppNotificationSender: NotificationSender = async () => {};
