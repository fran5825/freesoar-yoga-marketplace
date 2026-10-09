import type { DemandRequestStatus } from "@prisma/client";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { listAdminUserIds } from "@/domain/notification/admin-recipients";
import { notifyUsers } from "@/domain/notification/create";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { cancelDemandRequestForOrganizer } from "./__internal__/cancel-demand-request-core";
import {
  type DemandRequestSubmitTransitionErrorCode,
  validateDemandRequestSubmitTransition,
} from "./state";
import {
  type DemandRequestApplicationInput,
  type DemandRequestValidationError,
  isOrganizationContactComplete,
  validateDemandRequestDraft,
} from "./validation";

export type DemandRequestSnapshot = {
  id: string;
  organizerProfileId: string;
  organizationId: string;
  title: string | null;
  serviceType: string | null; // 主要類型＝serviceTypes 的第一個
  serviceTypes: string[];
  description: string | null;
  targetLevel: string | null;
  expectedParticipants: number | null;
  preferredAreas: string[];
  isOnline: boolean;
  preferredTimeSlots: string[];
  preferredStartDate: Date | null;
  classLengthMinutes: number | null;
  frequency: string | null;
  budgetRange: string | null;
  status: DemandRequestStatus;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const demandRequestSelect = {
  id: true,
  organizerProfileId: true,
  organizationId: true,
  title: true,
  serviceType: true,
  serviceTypes: true,
  description: true,
  targetLevel: true,
  expectedParticipants: true,
  preferredAreas: true,
  isOnline: true,
  preferredTimeSlots: true,
  preferredStartDate: true,
  classLengthMinutes: true,
  frequency: true,
  budgetRange: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

// organizer-usability-redesign 票 11：團主自己的需求列表／詳情額外帶出兩個衍生值。
// - effectiveResponseCount：還在等團主選擇的老師回應數＝DemandResponse.status = submitted 且
//   老師 status = approved（與選師 guard 相同：被暫停老師的回應選不了，不算）。需求狀態不會 persist teacher_responded，下一步提示改依這個數字判斷。
// - classSessionId：轉成課程後對應的 ClassSession，讓「下一步」直接連到那一堂課。
export type OwnDemandRequestSummary = DemandRequestSnapshot & {
  effectiveResponseCount: number;
  classSessionId: string | null;
};

const ownDemandRequestSummarySelect = {
  ...demandRequestSelect,
  classSession: { select: { id: true } },
  _count: {
    select: {
      demandResponses: {
        where: {
          status: "submitted" as const,
          teacherProfile: { status: "approved" as const },
        },
      },
    },
  },
} as const;

function toOwnDemandRequestSummary<
  T extends DemandRequestSnapshot & {
    classSession: { id: string } | null;
    _count: { demandResponses: number };
  },
>(row: T): OwnDemandRequestSummary {
  const { classSession, _count, ...snapshot } = row;

  return {
    ...snapshot,
    effectiveResponseCount: _count.demandResponses,
    classSessionId: classSession?.id ?? null,
  };
}

export type DemandRequestDraftSaveErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "draft_validation_failed"
  | "demand_request_not_found"
  | "organization_not_found"
  | "draft_save_failed";

export type DemandRequestDraftSaveResult =
  | {
      ok: true;
      demandRequest: DemandRequestSnapshot;
    }
  | {
      ok: false;
      code: DemandRequestDraftSaveErrorCode;
      message: string;
      validationErrors?: DemandRequestValidationError[];
    };

export type DemandRequestSubmitErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "demand_request_not_found"
  | "organization_not_found"
  | "organization_contact_incomplete"
  | DemandRequestSubmitTransitionErrorCode
  | "demand_request_submit_failed";

export type DemandRequestSubmitResult =
  | {
      ok: true;
      demandRequest: DemandRequestSnapshot;
    }
  | {
      ok: false;
      code: DemandRequestSubmitErrorCode;
      message: string;
      validationErrors?: DemandRequestValidationError[];
    };

export async function getOwnDemandRequestList(): Promise<OwnDemandRequestSummary[]> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return [];
  }

  const rows = await prisma.demandRequest.findMany({
    where: { organizerProfile: { userId: currentUser.id } },
    orderBy: { updatedAt: "desc" },
    select: ownDemandRequestSummarySelect,
  });

  return rows.map(toOwnDemandRequestSummary);
}

export async function getOwnDemandRequestDetail(
  demandRequestId: string,
): Promise<OwnDemandRequestSummary | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const row = await prisma.demandRequest.findFirst({
    where: {
      id: demandRequestId,
      organizerProfile: { userId: currentUser.id },
    },
    select: ownDemandRequestSummarySelect,
  });

  return row ? toOwnDemandRequestSummary(row) : null;
}

// organizer-usability-redesign 票 04：requestedOrganizationId 是團主在表單選的團體；
// 沒有提供時用本人最早建立的團體（createdAt／id 穩定排序）。兩種情況都必須是本人擁有的團體。
// 草稿可以換團體；已送出的需求不會走到這裡（更新只允許 draft）。
export async function saveOwnDemandRequestDraft(
  input: DemandRequestApplicationInput,
  demandRequestId?: string,
  requestedOrganizationId?: string,
): Promise<DemandRequestDraftSaveResult> {
  const validation = validateDemandRequestDraft(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "draft_validation_failed",
      message: "草稿資料格式需要調整後才能儲存。",
      validationErrors: validation.errors,
    };
  }

  try {
    await requireUser();

    const organizerContext = await getOwnOrganizerContext();

    if (!organizerContext) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料後再建立需求。",
      };
    }

    const organizerProfileId = organizerContext.organizerProfile.id;
    const organizationId =
      requestedOrganizationId ?? organizerContext.organization?.id;

    if (!organizationId) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團體後再建立需求。",
      };
    }

    // organizer-usability-redesign 票 02／04：授權看 owner，團體不是本人擁有的就不能拿來建需求。
    const ownedOrganization = await prisma.organization.findFirst({
      where: { id: organizationId, ownerOrganizerProfileId: organizerProfileId },
      select: { id: true },
    });

    if (!ownedOrganization) {
      return requestedOrganizationId
        ? {
            ok: false,
            code: "organization_not_found",
            message: "找不到這個團體，或你沒有權限使用。",
          }
        : {
            ok: false,
            code: "organizer_profile_required",
            message: "請先建立團主資料後再建立需求。",
          };
    }

    if (!demandRequestId) {
      const demandRequest = await prisma.demandRequest.create({
        data: {
          organizerProfileId,
          organizationId,
          ...toDemandRequestData(input),
          status: "draft",
        },
        select: demandRequestSelect,
      });

      return {
        ok: true,
        demandRequest,
      };
    }

    // 狀態守衛直接寫進 updateMany 的 where，避免 check-then-write 競態覆寫非 draft 資料。
    const updateResult = await prisma.demandRequest.updateMany({
      where: {
        id: demandRequestId,
        organizerProfileId,
        status: "draft",
        // 票 02：需求自己所屬的團體也必須是本人擁有的。
        organization: { ownerOrganizerProfileId: organizerProfileId },
      },
      data: {
        ...toDemandRequestData(input),
        // 票 04：草稿可以換成另一個自己擁有的團體（上面已驗證 owner）。
        ...(requestedOrganizationId ? { organizationId: ownedOrganization.id } : {}),
      },
    });

    if (updateResult.count === 0) {
      return {
        ok: false,
        code: "demand_request_not_found",
        message: "找不到這筆需求草稿，或目前狀態不允許編輯。",
      };
    }

    const demandRequest = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demandRequestId },
      select: demandRequestSelect,
    });

    return {
      ok: true,
      demandRequest,
    };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再建立或儲存需求草稿。",
      };
    }

    return {
      ok: false,
      code: "draft_save_failed",
      message: "需求草稿暫時無法儲存，請稍後再試。",
    };
  }
}

export async function submitOwnDemandRequest(
  input: DemandRequestApplicationInput,
  demandRequestId: string,
  requestedOrganizationId?: string,
): Promise<DemandRequestSubmitResult> {
  try {
    await requireUser();

    const organizerContext = await getOwnOrganizerContext();

    if (!organizerContext) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料後再送出需求。",
      };
    }

    const organizerProfileId = organizerContext.organizerProfile.id;

    // 票 02：需求自己所屬的團體必須是本人擁有的；聯絡資料完整度也以這個團體為準，
    // 不看 legacy pointer 指向的預設團體。
    const existingDemand = await prisma.demandRequest.findFirst({
      where: {
        id: demandRequestId,
        organizerProfileId,
        organization: { ownerOrganizerProfileId: organizerProfileId },
      },
      select: {
        ...demandRequestSelect,
        organization: {
          select: { contactName: true, contactEmail: true, contactPhone: true },
        },
      },
    });

    if (!existingDemand) {
      return {
        ok: false,
        code: "demand_request_not_found",
        message: "找不到這筆需求，或您沒有權限操作。",
      };
    }

    const transition = validateDemandRequestSubmitTransition(
      existingDemand.status,
      input,
    );

    if (!transition.allowed) {
      if (transition.code === "submit_validation_failed") {
        return {
          ok: false,
          code: "submit_validation_failed",
          message: "送出需求前，請先補齊必填欄位。",
          validationErrors: transition.validationErrors,
        };
      }

      return {
        ok: false,
        code: transition.code,
        message: submitTransitionBlockedMessage(transition.code),
      };
    }

    // 票 04：送出時可以同時換成另一個自己擁有的團體（仍是 draft 才能換）；
    // 聯絡資料完整度以送出後實際所屬的團體為準。
    let targetOrganization = existingDemand.organization;
    let targetOrganizationId = existingDemand.organizationId;

    if (requestedOrganizationId && requestedOrganizationId !== existingDemand.organizationId) {
      const requestedOrganization = await prisma.organization.findFirst({
        where: { id: requestedOrganizationId, ownerOrganizerProfileId: organizerProfileId },
        select: { id: true, contactName: true, contactEmail: true, contactPhone: true },
      });

      if (!requestedOrganization) {
        return {
          ok: false,
          code: "organization_not_found",
          message: "找不到這個團體，或你沒有權限使用。",
        };
      }

      targetOrganization = requestedOrganization;
      targetOrganizationId = requestedOrganization.id;
    }

    // D4：submit 前必須驗證所連 Organization 的必填 contact 完整
    // （contact 欄位在 schema 為 nullable，這是 application-layer 的權威把關）。
    if (!isOrganizationContactComplete(targetOrganization)) {
      return {
        ok: false,
        code: "organization_contact_incomplete",
        message: "請先至團主資料頁補齊組織聯絡資訊，才能送出需求。",
      };
    }

    // 提交必須原子地一併寫入已驗證的表單值與 status，且狀態守衛防止並行 submit 後被 stale draft 覆寫。
    const submitResult = await prisma.demandRequest.updateMany({
      where: {
        id: demandRequestId,
        organizerProfileId,
        status: "draft",
        organization: { ownerOrganizerProfileId: organizerProfileId },
      },
      data: {
        ...toDemandRequestData(input),
        organizationId: targetOrganizationId,
        status: "submitted",
      },
    });

    if (submitResult.count === 0) {
      const currentDemand = await prisma.demandRequest.findUniqueOrThrow({
        where: { id: demandRequestId },
        select: demandRequestSelect,
      });

      const retryTransition = validateDemandRequestSubmitTransition(
        currentDemand.status,
        input,
      );

      if (
        !retryTransition.allowed &&
        retryTransition.code !== "submit_validation_failed"
      ) {
        return {
          ok: false,
          code: retryTransition.code,
          message: submitTransitionBlockedMessage(retryTransition.code),
        };
      }

      return {
        ok: false,
        code: "demand_request_submit_failed",
        message: "需求暫時無法送出，請稍後再試。",
      };
    }

    const demandRequest = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demandRequestId },
      select: demandRequestSelect,
    });

    try {
      const adminIds = await listAdminUserIds();
      await notifyUsers(
        "demand_request_submitted",
        [
          { userId: organizerContext.organizerProfile.userId, role: "self" },
          ...adminIds.map((id) => ({ userId: id, role: "admin" as const })),
        ],
        { actorLabel: organizerContext.organizerProfile.displayName },
      );
    } catch (notifyError) {
      console.error("[notification] demand_request_submitted trigger failed", notifyError);
    }

    return {
      ok: true,
      demandRequest,
    };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再送出需求。",
      };
    }

    return {
      ok: false,
      code: "demand_request_submit_failed",
      message: "需求暫時無法送出，請稍後再試。",
    };
  }
}

function toDemandRequestData(input: DemandRequestApplicationInput) {
  return {
    title: input.title ?? null,
    // 主要類型固定存第一個選項，課程建立時預設帶入；完整清單存在 serviceTypes。
    serviceType: input.serviceTypes?.[0] ?? null,
    serviceTypes: input.serviceTypes ?? [],
    description: input.description ?? null,
    targetLevel: input.targetLevel ?? null,
    expectedParticipants: input.expectedParticipants ?? null,
    preferredAreas: input.preferredAreas ?? [],
    isOnline: input.isOnline ?? false,
    preferredTimeSlots: input.preferredTimeSlots ?? [],
    preferredStartDate: input.preferredStartDate ?? null,
    classLengthMinutes: input.classLengthMinutes ?? null,
    frequency: input.frequency ?? null,
    budgetRange: input.budgetRange ?? null,
  };
}

function submitTransitionBlockedMessage(
  code: Exclude<DemandRequestSubmitTransitionErrorCode, "submit_validation_failed">,
): string {
  if (code === "submitted_demand_cannot_resubmit") {
    return "此需求已送出審核中，不能重複送出。";
  }

  if (code === "published_demand_cannot_resubmit") {
    return "此需求已公開，不能重複送出。";
  }

  if (code === "rejected_demand_is_terminal") {
    return "此需求已被退回，請建立新的需求重新提出。";
  }

  return "此需求目前狀態不允許送出，請重新整理後確認狀態。";
}

export type CancelOwnDemandRequestErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "demand_request_not_found"
  | "demand_request_already_cancelled"
  | "demand_request_not_cancellable"
  | "demand_request_cancel_failed";

export type CancelOwnDemandRequestResult =
  | { ok: true }
  | {
      ok: false;
      code: CancelOwnDemandRequestErrorCode;
      message: string;
    };

// D1/D2/D5：Organizer own-scoped。實際的鎖／原子狀態轉換／連帶取消 DemandResponse 邏輯
// 都在 __internal__ 的 pure 核心（跟既有的 submit/select/createClassSession 三個
// mutation 搶同一把 DemandRequest 鎖，見 D5），這裡只負責把目前使用者解析成受信任的
// organizerProfileId。
export async function cancelOwnDemandRequest(
  demandRequestId: string,
): Promise<CancelOwnDemandRequestResult> {
  let organizerProfileId: string;

  try {
    await requireUser();
    const organizerContext = await getOwnOrganizerContext();

    if (!organizerContext) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "找不到你的團主資料。",
      };
    }

    organizerProfileId = organizerContext.organizerProfile.id;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再取消需求。",
      };
    }

    throw error;
  }

  const result = await cancelDemandRequestForOrganizer(organizerProfileId, demandRequestId);

  if (result.ok) {
    return { ok: true };
  }

  if (result.code === "demand_request_not_found") {
    return {
      ok: false,
      code: "demand_request_not_found",
      message: "找不到這則需求，或你沒有權限操作。",
    };
  }

  if (result.code === "demand_request_already_cancelled") {
    return {
      ok: false,
      code: "demand_request_already_cancelled",
      message: "這則需求已經取消過了。",
    };
  }

  if (result.code === "demand_request_not_cancellable") {
    return {
      ok: false,
      code: "demand_request_not_cancellable",
      message: "這則需求目前狀態不允許取消。",
    };
  }

  return {
    ok: false,
    code: "demand_request_cancel_failed",
    message: "需求暫時無法取消，請稍後再試。",
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}
