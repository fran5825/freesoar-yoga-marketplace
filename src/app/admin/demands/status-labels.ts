import type { DemandRequestStatus } from "@prisma/client";

import {
  demandRequestStatusLabels,
  demandRequestStatusToneClasses,
} from "@/app/organizer/demands/_components/status-labels";

// admin-usability 票 07：管理員看到的需求狀態文字。沿用團主端的文字，只有「已送出審核」對管理員
// 來說是「待審核」（輪到你處理）。
export function adminDemandStatusLabel(status: DemandRequestStatus): string {
  return status === "submitted" ? "待審核" : demandRequestStatusLabels[status];
}

export function adminDemandStatusToneClass(status: DemandRequestStatus): string {
  return status === "submitted"
    ? "bg-amber-100 text-amber-900"
    : demandRequestStatusToneClasses[status];
}
