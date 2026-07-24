import type { DemandRequestSnapshot } from "@/domain/demand-request/service";

import type { DemandRequestFormValues } from "./DemandRequestForm";

export const blankDemandRequestFormValues: DemandRequestFormValues = {
  title: "",
  serviceType: "",
  description: "",
  targetLevel: "",
  expectedParticipants: "",
  preferredAreas: "",
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
    serviceType: demandRequest.serviceType ?? "",
    description: demandRequest.description ?? "",
    targetLevel: demandRequest.targetLevel ?? "",
    expectedParticipants:
      typeof demandRequest.expectedParticipants === "number"
        ? String(demandRequest.expectedParticipants)
        : "",
    preferredAreas: demandRequest.preferredAreas.join("\n"),
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
