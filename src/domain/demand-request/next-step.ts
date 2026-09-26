import type { DemandRequestStatus } from "@prisma/client";

// organizer-usability 票 08：團主端「下一步」提示的共用文案。
// 詳情頁、總覽「待你處理」、需求列表卡片都從這裡取文案，避免同一個狀態在不同頁面說法不一樣。
// 只依需求狀態決定，不改狀態機；`kind` 讓畫面決定要不要放進「待你處理」。
export type DemandNextStepKind = "action" | "waiting" | "info";

export type DemandNextStep = {
  kind: DemandNextStepKind;
  // 詳情頁與總覽的完整說明。
  message: string;
  // 列表卡片用的一句話（較短）。
  shortMessage: string;
};

export function getDemandNextStep(input: {
  status: DemandRequestStatus;
  responseCount?: number;
}): DemandNextStep {
  const { status, responseCount } = input;

  switch (status) {
    case "draft":
      return {
        kind: "action",
        message: "這筆需求還是草稿。補齊必填欄位後，就可以送出審核。",
        shortMessage: "草稿：補齊欄位後送出審核",
      };
    case "submitted":
    case "under_review":
      return {
        kind: "waiting",
        message: "平台正在審核這筆需求。通過後會公開給合適的老師（老師在「需求池」看得到），老師回應時會通知你，再由你選擇合作的老師。",
        shortMessage: "等待平台審核",
      };
    case "published":
      return {
        kind: "waiting",
        message: "平台審核通過，合適的老師現在在「需求池」看得到這筆需求。老師回應時會通知你，再由你選擇合作的老師。",
        shortMessage: "已公開，等待老師回應",
      };
    case "teacher_responded":
      return {
        kind: "action",
        message:
          typeof responseCount === "number" && responseCount > 0
            ? `已有 ${responseCount} 位老師回應，請看看回應內容並選擇合作的老師。`
            : "已有老師回應，請看看回應內容並選擇合作的老師。",
        shortMessage: "老師已回應：請選擇合作的老師",
      };
    case "matched":
      return {
        kind: "action",
        message: "你已選定老師，請填寫課程資訊，把這筆需求建立成正式課程。",
        shortMessage: "已媒合：請建立課程",
      };
    case "converted_to_class":
      return {
        kind: "info",
        message: "課程已建立，可到「我的課程」查看報名狀況。",
        shortMessage: "課程已建立",
      };
    case "completed":
      return {
        kind: "info",
        message: "這筆需求的課程已完成。",
        shortMessage: "課程已完成",
      };
    case "cancelled":
      return {
        kind: "info",
        message: "這筆需求已停止，不會再公開給老師。需要的話可以建立新的需求。",
        shortMessage: "已取消",
      };
    case "expired":
      return {
        kind: "info",
        message: "這筆需求已過期。需要的話可以建立新的需求。",
        shortMessage: "已過期",
      };
    case "rejected":
      return {
        kind: "action",
        message: "平台退回了這筆需求。請參考退回說明，建立一筆新的需求重新提出。",
        shortMessage: "已退回：請參考說明重新提出",
      };
  }
}
