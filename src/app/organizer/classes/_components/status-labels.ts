import type { ClassSessionStatus } from "@prisma/client";

// D9：本輪只接線 (none)→draft，其餘保留但無 transition，文案先備齊避免未來再補。
export const classSessionStatusLabels: Record<ClassSessionStatus, string> = {
  draft: "草稿",
  pending_confirmation: "待確認",
  open_for_enrollment: "開放報名",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
};

export const classSessionStatusToneClasses: Record<ClassSessionStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_confirmation: "bg-sky-100 text-sky-800",
  open_for_enrollment: "bg-emerald-100 text-emerald-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-700",
};
