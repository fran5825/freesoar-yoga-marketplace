import type { TeacherProfileStatus } from "@prisma/client";

// admin-usability 票 06：老師審核列表與詳情頁共用的狀態文字與顏色。
export const adminTeacherStatusLabels: Record<TeacherProfileStatus, string> = {
  draft: "草稿",
  submitted: "待審核",
  approved: "已通過",
  rejected: "已退回",
  suspended: "已暫停",
};

export const adminTeacherStatusToneClasses: Record<TeacherProfileStatus, string> = {
  draft: "bg-sand text-ink",
  submitted: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-sand text-ink",
  suspended: "bg-rose-100 text-rose-800",
};
