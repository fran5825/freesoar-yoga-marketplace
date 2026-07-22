import type { DemandRequestStatus } from "@prisma/client";

import {
  type DemandRequestApplicationInput,
  type DemandRequestValidationError,
  validateDemandRequestSubmit,
} from "./validation";

export type DemandRequestSubmitTransitionErrorCode =
  | "submit_validation_failed"
  | "submitted_demand_cannot_resubmit"
  | "published_demand_cannot_resubmit"
  // D11：rejected 為終局狀態，不提供原地 resubmit，organizer 需另建新 demand。
  | "rejected_demand_is_terminal"
  // 涵蓋 D9 保留但本輪未接線的其餘狀態（under_review/teacher_responded/matched/
  // converted_to_class/completed/cancelled/expired），理論上不會由本 slice 的 flow 產生。
  | "demand_not_in_draft";

export type DemandRequestSubmitTransitionResult =
  | {
      allowed: true;
      from: "draft";
      to: "submitted";
    }
  | {
      allowed: false;
      from: DemandRequestStatus;
      to: "submitted";
      code: DemandRequestSubmitTransitionErrorCode;
      validationErrors?: DemandRequestValidationError[];
    };

export function validateDemandRequestSubmitTransition(
  from: DemandRequestStatus,
  input: DemandRequestApplicationInput,
): DemandRequestSubmitTransitionResult {
  if (from === "submitted") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "submitted_demand_cannot_resubmit",
    };
  }

  if (from === "published") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "published_demand_cannot_resubmit",
    };
  }

  if (from === "rejected") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "rejected_demand_is_terminal",
    };
  }

  if (from !== "draft") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "demand_not_in_draft",
    };
  }

  const validation = validateDemandRequestSubmit(input);

  if (!validation.valid) {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "submit_validation_failed",
      validationErrors: validation.errors,
    };
  }

  return {
    allowed: true,
    from,
    to: "submitted",
  };
}

export type DemandRequestPublishTransitionErrorCode =
  | "draft_demand_cannot_publish"
  | "published_demand_cannot_publish_again"
  | "rejected_demand_cannot_publish"
  // 涵蓋 D9 保留但本輪未接線的其餘狀態。
  | "demand_not_submitted";

export type DemandRequestPublishTransitionResult =
  | {
      allowed: true;
      from: "submitted";
      to: "published";
    }
  | {
      allowed: false;
      from: DemandRequestStatus;
      to: "published";
      code: DemandRequestPublishTransitionErrorCode;
    };

export function validateDemandRequestPublishTransition(
  from: DemandRequestStatus,
): DemandRequestPublishTransitionResult {
  if (from === "submitted") {
    return {
      allowed: true,
      from,
      to: "published",
    };
  }

  if (from === "draft") {
    return {
      allowed: false,
      from,
      to: "published",
      code: "draft_demand_cannot_publish",
    };
  }

  if (from === "published") {
    return {
      allowed: false,
      from,
      to: "published",
      code: "published_demand_cannot_publish_again",
    };
  }

  if (from === "rejected") {
    return {
      allowed: false,
      from,
      to: "published",
      code: "rejected_demand_cannot_publish",
    };
  }

  return {
    allowed: false,
    from,
    to: "published",
    code: "demand_not_submitted",
  };
}

export type DemandRequestRejectTransitionErrorCode =
  | "draft_demand_cannot_reject"
  | "published_demand_cannot_reject"
  | "rejected_demand_cannot_reject_again"
  // 涵蓋 D9 保留但本輪未接線的其餘狀態。
  | "demand_not_submitted";

export type DemandRequestRejectTransitionResult =
  | {
      allowed: true;
      from: "submitted";
      to: "rejected";
    }
  | {
      allowed: false;
      from: DemandRequestStatus;
      to: "rejected";
      code: DemandRequestRejectTransitionErrorCode;
    };

export function validateDemandRequestRejectTransition(
  from: DemandRequestStatus,
): DemandRequestRejectTransitionResult {
  if (from === "submitted") {
    return {
      allowed: true,
      from,
      to: "rejected",
    };
  }

  if (from === "draft") {
    return {
      allowed: false,
      from,
      to: "rejected",
      code: "draft_demand_cannot_reject",
    };
  }

  if (from === "published") {
    return {
      allowed: false,
      from,
      to: "rejected",
      code: "published_demand_cannot_reject",
    };
  }

  if (from === "rejected") {
    return {
      allowed: false,
      from,
      to: "rejected",
      code: "rejected_demand_cannot_reject_again",
    };
  }

  return {
    allowed: false,
    from,
    to: "rejected",
    code: "demand_not_submitted",
  };
}
