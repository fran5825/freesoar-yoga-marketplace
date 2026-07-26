import type { DemandResponseStatus } from "@prisma/client";

export type DemandResponseWithdrawTransitionErrorCode =
  | "withdrawn_response_cannot_withdraw_again"
  | "selected_response_cannot_withdraw"
  // 涵蓋 D7 保留但本輪未接線的其餘狀態（shortlisted/declined/expired）。
  | "response_not_submitted";

export type DemandResponseWithdrawTransitionResult =
  | {
      allowed: true;
      from: "submitted";
      to: "withdrawn";
    }
  | {
      allowed: false;
      from: DemandResponseStatus;
      to: "withdrawn";
      code: DemandResponseWithdrawTransitionErrorCode;
    };

// D10：withdraw 不檢查 DemandRequest 當下狀態，只檢查 own response 自身狀態。
// D7：本輪只接線 submitted→withdrawn；selected 防禦性禁止（比照既有禁止條件）。
export function validateDemandResponseWithdrawTransition(
  from: DemandResponseStatus,
): DemandResponseWithdrawTransitionResult {
  if (from === "submitted") {
    return { allowed: true, from, to: "withdrawn" };
  }

  if (from === "withdrawn") {
    return {
      allowed: false,
      from,
      to: "withdrawn",
      code: "withdrawn_response_cannot_withdraw_again",
    };
  }

  if (from === "selected") {
    return {
      allowed: false,
      from,
      to: "withdrawn",
      code: "selected_response_cannot_withdraw",
    };
  }

  return {
    allowed: false,
    from,
    to: "withdrawn",
    code: "response_not_submitted",
  };
}

export type DemandResponseSelectTransitionErrorCode =
  | "response_already_selected"
  // 涵蓋 D1 保留但本輪未接線的其餘狀態（shortlisted/declined/withdrawn/expired）。
  | "response_not_submitted";

export type DemandResponseSelectTransitionResult =
  | {
      allowed: true;
      from: "submitted";
      to: "selected";
    }
  | {
      allowed: false;
      from: DemandResponseStatus;
      to: "selected";
      code: DemandResponseSelectTransitionErrorCode;
    };

// D1：本輪只接線 submitted→selected（跳過 shortlisted 兩階段）。
export function validateDemandResponseSelectTransition(
  from: DemandResponseStatus,
): DemandResponseSelectTransitionResult {
  if (from === "submitted") {
    return { allowed: true, from, to: "selected" };
  }

  if (from === "selected") {
    return {
      allowed: false,
      from,
      to: "selected",
      code: "response_already_selected",
    };
  }

  return {
    allowed: false,
    from,
    to: "selected",
    code: "response_not_submitted",
  };
}

export type DemandResponseDeclineTransitionErrorCode =
  // 涵蓋 D1/D3 保留但本輪未接線或不適用的其餘狀態。
  "response_not_submitted";

export type DemandResponseDeclineTransitionResult =
  | {
      allowed: true;
      from: "submitted";
      to: "declined";
    }
  | {
      allowed: false;
      from: DemandResponseStatus;
      to: "declined";
      code: DemandResponseDeclineTransitionErrorCode;
    };

// D3：select 成功時，同一 demand 底下其餘 submitted response 自動轉 declined。
export function validateDemandResponseDeclineTransition(
  from: DemandResponseStatus,
): DemandResponseDeclineTransitionResult {
  if (from === "submitted") {
    return { allowed: true, from, to: "declined" };
  }

  return {
    allowed: false,
    from,
    to: "declined",
    code: "response_not_submitted",
  };
}
