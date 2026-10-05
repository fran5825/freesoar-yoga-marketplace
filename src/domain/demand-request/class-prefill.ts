import { getDemandLocationItems } from "@/domain/demand-request/location";
import type { DemandRequestSnapshot } from "@/domain/demand-request/service";

// organizer-usability-redesign 票 11：已媒合需求建立課程時，表單先帶入需求裡「確定」的欄位。
// - 地點：只有一個明確地點（或只勾線上）才帶入；舊資料有多個縣市時不猜，留空讓團主填。
// - 名額：預計人數在課程允許範圍（1–500）內才帶入。
// - 說明：直接帶入需求說明，團主可以再改。
// - 開始／結束時間不帶入：偏好時段、頻率、開始日期都不是確定的上課時間，只整理成參考文字。
export type ClassPrefillFromDemand = {
  location: string;
  capacity: number | null;
  description: string;
  scheduleHint: string | null;
};

const CLASS_CAPACITY_MIN = 1;
const CLASS_CAPACITY_MAX = 500;

export function getClassPrefillFromDemand(
  demand: Pick<
    DemandRequestSnapshot,
    | "preferredAreas"
    | "isOnline"
    | "expectedParticipants"
    | "description"
    | "preferredStartDate"
    | "preferredTimeSlots"
    | "frequency"
    | "classLengthMinutes"
  >,
  // 日期格式與頻率文字由畫面層傳入，讓這裡和需求內容區塊的顯示一致。
  display: { formatDate: (value: Date) => string; frequencyLabels: Record<string, string> },
): ClassPrefillFromDemand {
  const locationItems = getDemandLocationItems(demand);
  const capacity =
    typeof demand.expectedParticipants === "number" &&
    Number.isInteger(demand.expectedParticipants) &&
    demand.expectedParticipants >= CLASS_CAPACITY_MIN &&
    demand.expectedParticipants <= CLASS_CAPACITY_MAX
      ? demand.expectedParticipants
      : null;

  const hints: string[] = [];
  if (demand.preferredStartDate) {
    hints.push(`希望 ${display.formatDate(demand.preferredStartDate)} 開始`);
  }
  const timeSlots = demand.preferredTimeSlots.filter((slot) => slot.trim().length > 0);
  if (timeSlots.length > 0) {
    hints.push(`時段 ${timeSlots.join("、")}`);
  }
  if (demand.frequency) {
    hints.push(display.frequencyLabels[demand.frequency] ?? demand.frequency);
  }
  if (typeof demand.classLengthMinutes === "number") {
    hints.push(`每堂 ${demand.classLengthMinutes} 分鐘`);
  }

  return {
    location: locationItems.length === 1 ? locationItems[0] : "",
    capacity,
    description: demand.description ?? "",
    scheduleHint: hints.length > 0 ? hints.join("、") : null,
  };
}
