import {
  type TeacherProfileApplicationInput,
  type TeacherProfileValidationError,
  validateTeacherProfileSubmit,
} from "./validation";

export type TeacherProfileStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "suspended";

export type TeacherProfileSubmitTransitionErrorCode =
  | "submit_validation_failed"
  | "submitted_profile_cannot_resubmit"
  | "approved_profile_cannot_resubmit"
  | "suspended_profile_cannot_resubmit";

export type TeacherProfileApproveTransitionErrorCode =
  | "draft_profile_cannot_approve"
  | "approved_profile_cannot_approve_again"
  | "rejected_profile_cannot_approve"
  | "suspended_profile_cannot_approve";

export type TeacherProfileSubmitTransitionResult =
  | {
      allowed: true;
      from: "draft" | "rejected";
      to: "submitted";
    }
  | {
      allowed: false;
      from: TeacherProfileStatus;
      to: "submitted";
      code: TeacherProfileSubmitTransitionErrorCode;
      validationErrors?: TeacherProfileValidationError[];
    };

export type TeacherProfileApproveTransitionResult =
  | {
      allowed: true;
      from: "submitted";
      to: "approved";
    }
  | {
      allowed: false;
      from: TeacherProfileStatus;
      to: "approved";
      code: TeacherProfileApproveTransitionErrorCode;
    };

export function validateTeacherProfileSubmitTransition(
  from: TeacherProfileStatus,
  input: TeacherProfileApplicationInput,
): TeacherProfileSubmitTransitionResult {
  if (from === "submitted") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "submitted_profile_cannot_resubmit",
    };
  }

  if (from === "approved") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "approved_profile_cannot_resubmit",
    };
  }

  if (from === "suspended") {
    return {
      allowed: false,
      from,
      to: "submitted",
      code: "suspended_profile_cannot_resubmit",
    };
  }

  const validation = validateTeacherProfileSubmit(input);

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

export function validateTeacherProfileApproveTransition(
  from: TeacherProfileStatus,
): TeacherProfileApproveTransitionResult {
  if (from === "submitted") {
    return {
      allowed: true,
      from,
      to: "approved",
    };
  }

  if (from === "draft") {
    return {
      allowed: false,
      from,
      to: "approved",
      code: "draft_profile_cannot_approve",
    };
  }

  if (from === "approved") {
    return {
      allowed: false,
      from,
      to: "approved",
      code: "approved_profile_cannot_approve_again",
    };
  }

  if (from === "rejected") {
    return {
      allowed: false,
      from,
      to: "approved",
      code: "rejected_profile_cannot_approve",
    };
  }

  return {
    allowed: false,
    from,
    to: "approved",
    code: "suspended_profile_cannot_approve",
  };
}
