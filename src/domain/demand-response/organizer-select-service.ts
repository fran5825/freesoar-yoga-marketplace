import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { selectDemandResponseForOrganizer } from "./__internal__/select-and-submit-core";

export type SelectDemandResponseErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "demand_response_not_found"
  | "response_not_submitted"
  | "response_demand_already_matched"
  | "demand_response_select_failed";

export type SelectDemandResponseResult =
  | { ok: true; demandResponseId: string; demandRequestId: string }
  | { ok: false; code: SelectDemandResponseErrorCode; message: string };

// D2：select 一律 own-scoped，organizerProfileId 一律從 session 解析，不信任 client 輸入。
// 實際的鎖／原子 select／decline-others／matched 邏輯都在 __internal__ 的 pure 核心，
// 這裡只負責把目前使用者解析成受信任的 organizerProfileId。
export async function selectDemandResponse(
  demandResponseId: string,
): Promise<SelectDemandResponseResult> {
  let organizerProfileId: string;

  try {
    const currentUser = await requireUser();

    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!organizerProfile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "找不到你的團主資料。",
      };
    }

    organizerProfileId = organizerProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再選定老師。",
      };
    }

    throw error;
  }

  const result = await selectDemandResponseForOrganizer(
    organizerProfileId,
    demandResponseId,
  );

  if (result.ok) {
    return {
      ok: true,
      demandResponseId: result.demandResponseId,
      demandRequestId: result.demandRequestId,
    };
  }

  if (result.code === "demand_response_not_found") {
    return {
      ok: false,
      code: "demand_response_not_found",
      message: "找不到這筆回應，或你沒有權限操作。",
    };
  }

  if (result.code === "response_not_submitted") {
    return {
      ok: false,
      code: "response_not_submitted",
      message: "這筆回應目前狀態不允許選定，請重新整理後確認狀態。",
    };
  }

  if (result.code === "response_demand_already_matched") {
    return {
      ok: false,
      code: "response_demand_already_matched",
      message: "這則需求已經選定過老師了。",
    };
  }

  return {
    ok: false,
    code: "demand_response_select_failed",
    message: "選定暫時無法完成，請稍後再試。",
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
