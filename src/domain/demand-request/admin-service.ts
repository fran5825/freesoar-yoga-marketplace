import type { OrganizationType } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  validateDemandRequestPublishTransition,
  validateDemandRequestRejectTransition,
} from "./state";
import {
  type DemandRequestRejectionReasonErrorCode,
  validateDemandRequestRejectionReason,
} from "./validation";

export type SubmittedDemandRequestForAdmin = {
  id: string;
  title: string | null;
  serviceType: string | null;
  description: string | null;
  targetLevel: string | null;
  expectedParticipants: number | null;
  preferredAreas: string[];
  preferredTimeSlots: string[];
  preferredStartDate: Date | null;
  classLengthMinutes: number | null;
  frequency: string | null;
  budgetRange: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    name: string;
    type: OrganizationType;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  organizerProfile: {
    displayName: string;
  };
};

export type DemandRequestPublishErrorCode =
  | "admin_permission_required"
  | "demand_request_not_found"
  | "demand_request_not_submitted"
  | "demand_request_publish_failed";

export type DemandRequestPublishResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: DemandRequestPublishErrorCode;
      message: string;
    };

export type DemandRequestRejectErrorCode =
  | "admin_permission_required"
  | "demand_request_not_found"
  | "demand_request_not_submitted"
  | "rejection_reason_invalid"
  | "demand_request_reject_failed";

export type DemandRequestRejectResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: DemandRequestRejectErrorCode;
      message: string;
      rejectionReasonError?: DemandRequestRejectionReasonErrorCode;
    };

const submittedDemandRequestSelect = {
  id: true,
  title: true,
  serviceType: true,
  description: true,
  targetLevel: true,
  expectedParticipants: true,
  preferredAreas: true,
  preferredTimeSlots: true,
  preferredStartDate: true,
  classLengthMinutes: true,
  frequency: true,
  budgetRange: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: {
      name: true,
      type: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
    },
  },
  organizerProfile: {
    select: {
      displayName: true,
    },
  },
} as const;

export async function listSubmittedDemandRequestsForAdmin(): Promise<
  SubmittedDemandRequestForAdmin[]
> {
  await requireAdmin();

  return prisma.demandRequest.findMany({
    where: { status: "submitted" },
    orderBy: { updatedAt: "asc" },
    select: submittedDemandRequestSelect,
  });
}

export async function publishSubmittedDemandRequest(
  demandRequestId: string,
): Promise<DemandRequestPublishResult> {
  try {
    await requireAdmin();

    const publishResult = await prisma.demandRequest.updateMany({
      where: {
        id: demandRequestId,
        status: "submitted",
      },
      data: { status: "published" },
    });

    if (publishResult.count === 0) {
      const existingDemand = await prisma.demandRequest.findUnique({
        where: { id: demandRequestId },
        select: { status: true },
      });

      if (!existingDemand) {
        return {
          ok: false,
          code: "demand_request_not_found",
          message: "找不到這筆需求。",
        };
      }

      const transition = validateDemandRequestPublishTransition(
        existingDemand.status,
      );

      if (!transition.allowed) {
        return {
          ok: false,
          code: "demand_request_not_submitted",
          message: "只有已送出審核的需求可以公開。",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    if (isAdminPermissionRequiredError(error)) {
      return {
        ok: false,
        code: "admin_permission_required",
        message: "需要 Admin 權限才能公開此需求。",
      };
    }

    return {
      ok: false,
      code: "demand_request_publish_failed",
      message: "需求暫時無法公開，請稍後再試。",
    };
  }
}

export async function rejectSubmittedDemandRequest(
  demandRequestId: string,
  rejectionReason: string | null | undefined,
): Promise<DemandRequestRejectResult> {
  try {
    await requireAdmin();

    const reasonValidation =
      validateDemandRequestRejectionReason(rejectionReason);

    if (!reasonValidation.valid) {
      return {
        ok: false,
        code: "rejection_reason_invalid",
        message: reasonValidation.message,
        rejectionReasonError: reasonValidation.code,
      };
    }

    const rejectResult = await prisma.demandRequest.updateMany({
      where: {
        id: demandRequestId,
        status: "submitted",
      },
      data: {
        status: "rejected",
        rejectionReason: reasonValidation.normalizedReason,
      },
    });

    if (rejectResult.count === 0) {
      const existingDemand = await prisma.demandRequest.findUnique({
        where: { id: demandRequestId },
        select: { status: true },
      });

      if (!existingDemand) {
        return {
          ok: false,
          code: "demand_request_not_found",
          message: "找不到這筆需求。",
        };
      }

      const transition = validateDemandRequestRejectTransition(
        existingDemand.status,
      );

      if (!transition.allowed) {
        return {
          ok: false,
          code: "demand_request_not_submitted",
          message: "只有已送出審核的需求可以退回。",
        };
      }
    }

    return { ok: true };
  } catch (error) {
    if (isAdminPermissionRequiredError(error)) {
      return {
        ok: false,
        code: "admin_permission_required",
        message: "需要 Admin 權限才能退回此需求。",
      };
    }

    return {
      ok: false,
      code: "demand_request_reject_failed",
      message: "需求暫時無法退回，請稍後再試。",
    };
  }
}

function isAdminPermissionRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Authentication required" ||
      error.message === "Admin access required")
  );
}
