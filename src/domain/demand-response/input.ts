import type { DemandResponseSubmitInput } from "./validation";

export type DemandResponseSubmitFormInput = {
  message: string;
  proposedTimeSlots: string[];
  proposedPrice: string;
};

export function normalizeDemandResponseSubmitInput(
  input: DemandResponseSubmitFormInput,
): DemandResponseSubmitInput {
  return {
    message: input.message,
    proposedTimeSlots: input.proposedTimeSlots,
    proposedPrice: input.proposedPrice,
  };
}
