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

export async function saveNewDemandRequestDraftAction(
  input: DemandRequestFormInput,
  demandRequestId?: string,
): Promise<SaveDemandRequestDraftActionResult> {
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

export async function submitNewDemandRequestAction(
  input: DemandRequestFormInput,
  demandRequestId?: string,
): Promise<SubmitDemandRequestActionResult> {
  try {
    const normalizedInput = normalizeDemandRequestInput(input);

    let targetId = demandRequestId;

    if (!targetId) {
      const draftResult = await saveOwnDemandRequestDraft(normalizedInput);

      if (!draftResult.ok) {
        if (
          draftResult.code === "authentication_required" ||
          draftResult.code === "organizer_profile_required"
        ) {
          return {
            ok: false,
            code: draftResult.code,
            message: draftResult.message,
          };
        }

        return {
          ok: false,
          code: "demand_request_submit_failed",
          message: draftResult.message,
        };
      }

      targetId = draftResult.demandRequest.id;
    }

    const result = await submitOwnDemandRequest(normalizedInput, targetId);

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
