import type { DemandRequestSnapshot } from "@/domain/demand-request/service";

import type { DemandRequestFormValues } from "./DemandRequestForm";

export const blankDemandRequestFormValues: DemandRequestFormValues = {
  title: "",
  serviceTypes: [],
  description: "",
  targetLevel: "",
  expectedParticipants: "",
  preferredAreas: "",
  isOnline: false,
  preferredTimeSlots: [],
  classLengthMinutes: "",
  frequency: "",
  preferredStartDate: "",
  budgetRange: "",
};

export function toDemandRequestFormValues(
  demandRequest: DemandRequestSnapshot,
): DemandRequestFormValues {
  return {
    title: demandRequest.title ?? "",
    // 舊資料若只有 serviceType（還沒被 migration 複製到 serviceTypes），退回用它。
    serviceTypes:
      demandRequest.serviceTypes.length > 0
        ? demandRequest.serviceTypes
        : demandRequest.serviceType
          ? [demandRequest.serviceType]
          : [],
    description: demandRequest.description ?? "",
    targetLevel: demandRequest.targetLevel ?? "",
    expectedParticipants:
      typeof demandRequest.expectedParticipants === "number"
        ? String(demandRequest.expectedParticipants)
        : "",
    // 2026-09-21 以前的草稿可能存了多個縣市，合併成一行讓團主改寫成具體地址。
    preferredAreas: demandRequest.preferredAreas.join("、"),
    isOnline: demandRequest.isOnline,
    preferredTimeSlots: demandRequest.preferredTimeSlots,
    classLengthMinutes:
      typeof demandRequest.classLengthMinutes === "number"
        ? String(demandRequest.classLengthMinutes)
        : "",
    frequency: demandRequest.frequency ?? "",
    preferredStartDate: demandRequest.preferredStartDate
      ? demandRequest.preferredStartDate.toISOString().slice(0, 10)
      : "",
    budgetRange: demandRequest.budgetRange ?? "",
  };
}
