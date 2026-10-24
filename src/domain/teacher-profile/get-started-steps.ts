// teacher-first-run 票 08、09：「開始使用」三步的文字，總覽與審核中畫面共用。

export type TeacherGetStartedStepKey = "payment" | "first_class" | "public_page";

export type TeacherGetStartedStepCopy = {
  key: TeacherGetStartedStepKey;
  label: string;
  message: string;
  optional: boolean;
};

// 三步的名稱與說明。票 09 的「審核中」畫面也列同樣的三件事（只是說明、不能操作），共用這份。
// 這個檔案不能 import 伺服器端模組（prisma、session），因為申請表單是 client component。
export const TEACHER_GET_STARTED_STEPS: readonly TeacherGetStartedStepCopy[] = [
  {
    key: "payment",
    label: "填收款與聯絡",
    message: "填好收款帳號與聯絡方式，學員報名後就知道怎麼繳費、怎麼找你。",
    optional: false,
  },
  {
    key: "first_class",
    label: "開第一堂課",
    message: "建立你的第一堂課，把報名連結傳給學員。",
    optional: false,
  },
  {
    key: "public_page",
    label: "公開我的老師頁",
    message: "讓學員不用登入就能認識你的風格與理念。",
    optional: true,
  },
];
