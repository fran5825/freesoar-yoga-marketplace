// teacher-showcase-photos 票 08（spec、策略「老師開課小幫手」第一版）：給老師複製貼到 LINE、IG 的固定文案。
//
// 不呼叫 AI：只是把課程資料套進固定模板。規則：
// - 沒填的欄位整行不出現（有填才顯示），不留「尚未提供」；
// - 語氣溫和、清楚、不緊迫（見 docs/context/voice-and-tone.md）：不用「最後名額」「立即搶」這類說法；
// - 報名連結用 {{ENROLL_URL}} 佔位，由畫面端（瀏覽器）換成完整網址，domain 不需要知道網域。

import { formatTaipeiDatetimeLocal } from "./timezone";
import { classDiscoveryWeekday } from "./class-discovery-filters";

export const ENROLL_URL_PLACEHOLDER = "{{ENROLL_URL}}";

export type ShareTemplateInput = {
  title: string;
  startAt: Date;
  endAt: Date;
  location: string;
  priceNote: string | null;
  suitableFor: string | null;
  preparationNotes: string | null;
  requiresApproval: boolean;
  teacherName: string | null;
  // 屬於期班或持續開課時，連結帶學員到系列或期班頁，文案也改說「這個系列」。
  isSeries: boolean;
};

export type ShareTemplates = {
  announcement: { label: string; text: string };
  reminder: { label: string; text: string };
  thanks: { label: string; text: string };
};

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function timeLine(startAt: Date, endAt: Date): string {
  const [date, start] = formatTaipeiDatetimeLocal(startAt).split("T");
  const [, end] = formatTaipeiDatetimeLocal(endAt).split("T");

  return `${date.replaceAll("-", "/")}（${classDiscoveryWeekday(startAt)}）${start}–${end}`;
}

function lines(entries: (string | null | false)[]): string {
  return entries.filter((entry): entry is string => typeof entry === "string").join("\n");
}

export function buildShareTemplates(input: ShareTemplateInput): ShareTemplates {
  const time = timeLine(input.startAt, input.endAt);
  const price = present(input.priceNote);
  const suitable = present(input.suitableFor);
  const prepare = present(input.preparationNotes);
  const teacher = present(input.teacherName);
  const signature = teacher ? `— ${teacher}` : null;

  const announcement = lines([
    `【${input.title}】`,
    `時間：${time}`,
    `地點：${input.location}`,
    price && `費用：${price}`,
    suitable && `適合對象：${suitable}`,
    prepare && `準備事項：${prepare}`,
    input.requiresApproval ? "報名後會由老師確認，確認結果會通知你。" : null,
    "",
    `報名連結：${ENROLL_URL_PLACEHOLDER}`,
    "（需要先登入飛索帳號才能報名）",
    "",
    "期待在課堂上與你相見。",
    signature,
  ]);

  const reminder = lines([
    `明天要上課囉：${input.title}`,
    `時間：${time}`,
    `地點：${input.location}`,
    prepare && `準備事項：${prepare}`,
    "",
    "如果臨時有狀況，請直接回覆我，我們再一起想辦法。",
    "期待明天見到你。",
    signature,
  ]);

  const thanks = lines([
    `謝謝你來上「${input.title}」。`,
    "希望這堂課讓你的身體和心都有一點被好好照顧。",
    "",
    input.isSeries ? "之後的場次可以從這裡看：" : "下次還想一起練習的話，可以從這裡看看接下來的課：",
    ENROLL_URL_PLACEHOLDER,
    "",
    "歡迎回覆告訴我你的感受，謝謝你。",
    signature,
  ]);

  return {
    announcement: { label: "招募公告（貼到 LINE 或 IG）", text: announcement },
    reminder: { label: "課前一天提醒", text: reminder },
    thanks: { label: "課後感謝", text: thanks },
  };
}
