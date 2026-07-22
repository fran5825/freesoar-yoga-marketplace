"use server";

import {
  normalizeDemandRequestInput,
  type DemandRequestFormInput,
} from "@/domain/demand-request/input";
import {
  saveOwnDemandRequestDraft,
  submitOwnDemandRequest,
  type DemandRequestDraftSaveErrorCode,
  type DemandRequestSubmitErrorCode,
} from "@/domain/demand-request/service";
import type { DemandRequestValidationError } from "@/domain/demand-request/validation";

type DemandRequestActionSnapshot = {
  id: string;
};

export type SaveDemandRequestDraftActionResult =
  | {
      ok: true;
      demandRequest: DemandRequestActionSnapshot;
    }
  | {
      ok: false;
      code: DemandRequestDraftSaveErrorCode;
      message: string;
      validationErrors?: DemandRequestValidationError[];
    };

export type SubmitDemandRequestActionResult =
  | {
      ok: true;
      demandRequest: DemandRequestActionSnapshot;
    }
  | {
      ok: false;
      code: DemandRequestSubmitErrorCode;
      message: string;
      validationErrors?: DemandRequestValidationError[];
    };

export async function saveEditDemandRequestDraftAction(
  input: DemandRequestFormInput,
  demandRequestId?: string,
): Promise<SaveDemandRequestDraftActionResult> {
  if (!demandRequestId) {
    return {
      ok: false,
      code: "demand_request_not_found",
      message: "找不到這筆需求草稿，或您沒有權限操作。",
    };
  }

  try {
    const normalizedInput = normalizeDemandRequestInput(input);
    const result = await saveOwnDemandRequestDraft(
      normalizedInput,
      demandRequestId,
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      demandRequest: { id: result.demandRequest.id },
    };
  } catch {
    return {
      ok: false,
      code: "draft_save_failed",
      message: "需求草稿暫時無法儲存，請稍後再試。",
    };
  }
}

export async function submitEditDemandRequestAction(
  input: DemandRequestFormInput,
  demandRequestId?: string,
): Promise<SubmitDemandRequestActionResult> {
  if (!demandRequestId) {
    return {
      ok: false,
      code: "demand_request_not_found",
      message: "找不到這筆需求，或您沒有權限操作。",
    };
  }

  try {
    const normalizedInput = normalizeDemandRequestInput(input);
    const result = await submitOwnDemandRequest(
      normalizedInput,
      demandRequestId,
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      demandRequest: { id: result.demandRequest.id },
    };
  } catch {
    return {
      ok: false,
      code: "demand_request_submit_failed",
      message: "需求暫時無法送出，請稍後再試。",
    };
  }
}
