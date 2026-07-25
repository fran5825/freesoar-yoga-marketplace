import { isValidPreferredTimeSlot } from "@/domain/demand-request/service-types";

export type DemandResponseSubmitInput = {
  message?: string | null;
  proposedTimeSlots?: string[] | null;
  proposedPrice?: string | null;
};

export const MESSAGE_MIN_LENGTH = 10;
export const MESSAGE_MAX_LENGTH = 1000;
const PROPOSED_PRICE_MAX_LENGTH = 500;

export type DemandResponseValidationErrorCode =
  | "message_required"
  | "message_too_short"
  | "message_too_long"
  | "proposed_time_slots_required"
  | "proposed_time_slots_invalid"
  | "proposed_price_too_long";

export type DemandResponseValidationError = {
  field: "message" | "proposedTimeSlots" | "proposedPrice";
  code: DemandResponseValidationErrorCode;
  message: string;
};

export type DemandResponseValidationResult =
  | {
      valid: true;
      normalized: {
        message: string;
        proposedTimeSlots: string[];
        proposedPrice: string | null;
      };
    }
  | {
      valid: false;
      errors: DemandResponseValidationError[];
    };

// D4：message trim 後 10–1000 字（定案，比照 rejectionReason 先例）。
// D6：proposedTimeSlots 至少一項，且必須落在與 Organizer plan 共用的受控清單內。
export function validateDemandResponseSubmit(
  input: DemandResponseSubmitInput,
): DemandResponseValidationResult {
  const errors: DemandResponseValidationError[] = [];
  const normalizedMessage =
    typeof input.message === "string" ? input.message.trim() : "";
  const normalizedTimeSlots = (input.proposedTimeSlots ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const normalizedPrice =
    typeof input.proposedPrice === "string" && input.proposedPrice.trim().length > 0
      ? input.proposedPrice.trim()
      : null;

  if (normalizedMessage.length === 0) {
    errors.push({
      field: "message",
      code: "message_required",
      message: "回覆內容為必填。",
    });
  } else if (normalizedMessage.length < MESSAGE_MIN_LENGTH) {
    errors.push({
      field: "message",
      code: "message_too_short",
      message: `回覆內容至少需要 ${MESSAGE_MIN_LENGTH} 個字。`,
    });
  } else if (normalizedMessage.length > MESSAGE_MAX_LENGTH) {
    errors.push({
      field: "message",
      code: "message_too_long",
      message: `回覆內容不可超過 ${MESSAGE_MAX_LENGTH} 個字。`,
    });
  }

  if (normalizedTimeSlots.length === 0) {
    errors.push({
      field: "proposedTimeSlots",
      code: "proposed_time_slots_required",
      message: "請至少選擇一個可配合時段。",
    });
  } else if (!normalizedTimeSlots.every(isValidPreferredTimeSlot)) {
    errors.push({
      field: "proposedTimeSlots",
      code: "proposed_time_slots_invalid",
      message: "可配合時段包含不在允許清單內的選項。",
    });
  }

  if (normalizedPrice && normalizedPrice.length > PROPOSED_PRICE_MAX_LENGTH) {
    errors.push({
      field: "proposedPrice",
      code: "proposed_price_too_long",
      message: `建議價格說明不可超過 ${PROPOSED_PRICE_MAX_LENGTH} 個字。`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    normalized: {
      message: normalizedMessage,
      proposedTimeSlots: normalizedTimeSlots,
      proposedPrice: normalizedPrice,
    },
  };
}
