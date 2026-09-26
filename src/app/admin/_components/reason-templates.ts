import type { ReasonTemplate } from "./ReasonTemplateField";

// admin-usability 票 05：退回原因的常用範本。文字草擬中，等 Franz 確認後定案（見票 05）。
// 每一句都要 ≥ 10 字（伺服器端的下限），語氣溫和、具體，寫出「要怎麼改」。
export const teacherRejectionTemplates: ReasonTemplate[] = [
  {
    label: "教學經歷不夠具體",
    text: "教學經歷需要更具體，請補充帶領團課的實際經驗、年資與大約授課時數，補充後歡迎重新送審。",
  },
  {
    label: "簡介與風格太簡短",
    text: "老師簡介與教學風格目前比較簡短，請多描述你的課程特色與適合的學員，讓團主更容易認識你。",
  },
  {
    label: "必填資料不完整",
    text: "部分必填資料尚未完整或不易辨識，請確認服務地區、授課形式與擅長類型後重新送審。",
  },
];

export const demandRejectionTemplates: ReasonTemplate[] = [
  {
    label: "需求說明太簡略",
    text: "需求說明過於簡略，請補充上課對象、人數與希望呈現的課程樣貌，讓老師能評估是否適合。",
  },
  {
    label: "時段地點預算不明",
    text: "時段、地點或預算目前還不夠明確，請補充後再送出審核，老師才能判斷是否能配合。",
  },
  {
    label: "聯絡資料不完整",
    text: "聯絡資料尚未完整，請確認聯絡人姓名與聯絡方式後重新送審。",
  },
];
