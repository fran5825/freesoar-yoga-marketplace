import type { DemandRequestSnapshot } from "@/domain/demand-request/service";

export const demandRequestStatusLabels: Record<
  DemandRequestSnapshot["status"],
  string
> = {
  draft: "草稿",
  submitted: "已送出審核",
  under_review: "審核中",
  published: "已公開",
  teacher_responded: "老師已回應",
  matched: "已媒合",
  converted_to_class: "已轉為課程",
  completed: "已完成",
  cancelled: "已取消",
  expired: "已過期",
  rejected: "已退回",
};

export const demandRequestStatusToneClasses: Record<
  DemandRequestSnapshot["status"],
  string
> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-sky-100 text-sky-800",
  under_review: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  teacher_responded: "bg-emerald-100 text-emerald-800",
  matched: "bg-emerald-100 text-emerald-800",
  converted_to_class: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-700",
  expired: "bg-gray-100 text-gray-700",
  rejected: "bg-amber-100 text-amber-900",
};

export const demandRequestTargetLevelLabels: Record<string, string> = {
  beginner: "初學",
  general: "一般",
  advanced: "進階",
  mixed: "混合程度",
};

export const demandRequestFrequencyLabels: Record<string, string> = {
  single: "單堂",
  weekly: "每週",
  biweekly: "雙週",
  monthly: "每月",
};

export function formatDemandRequestDateTime(value: Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatDemandRequestDate(value: Date): string {
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(
    value,
  );
}
