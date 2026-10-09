import { OrganizationType } from "@prisma/client";

import { isOrganizationContactComplete } from "@/domain/demand-request/validation";
import {
  type UpdateOwnOrganizationInput,
  type UpdateOwnOrganizationValidationError,
  validateUpdateOwnOrganizationInput,
} from "@/domain/organizer-profile/validation";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// organizer-usability-redesign 票 03：「我的團體」。一位團主可以擁有多個團體，
// 讀寫一律以 Organization.ownerOrganizerProfileId 判斷（spec 13.1、13.4），
// 查詢 WHERE 同時帶團體 id 與 owner，不先讀後比對；不是自己的團體一律當作不存在。
// 新增團體可以先存不完整的聯絡資料，送出需求或合作邀請前才檢查完整度。

export type OwnOrganization = {
  id: string;
  name: string;
  type: OrganizationType;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isContactComplete: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const organizationSelect = {
  id: true,
  name: true,
  type: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  createdAt: true,
  updatedAt: true,
} as const;

// 票 15a：預設團體由 owner 決定；相同建立時間仍有穩定順序。
export const ownedOrganizationOrderBy = [
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

type OrganizationRow = {
  id: string;
  name: string;
  type: OrganizationType;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toOwnOrganization(
  row: OrganizationRow,
  defaultOrganizationId: string | null,
): OwnOrganization {
  return {
    ...row,
    isContactComplete: isOrganizationContactComplete(row),
    isDefault: row.id === defaultOrganizationId,
  };
}

async function getOwnOrganizerProfileRef(userId: string) {
  return prisma.organizerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      ownedOrganizations: {
        select: { id: true },
        orderBy: ownedOrganizationOrderBy,
        take: 1,
      },
    },
  });
}

export async function listOwnOrganizations(): Promise<OwnOrganization[]> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return [];
  }

  const profile = await getOwnOrganizerProfileRef(currentUser.id);

  if (!profile) {
    return [];
  }

  const rows = await prisma.organization.findMany({
    where: { ownerOrganizerProfileId: profile.id },
    select: organizationSelect,
    orderBy: ownedOrganizationOrderBy,
  });

  return rows.map((row) => toOwnOrganization(row, rows[0]?.id ?? null));
}

export async function getOwnOrganization(
  organizationId: string,
): Promise<OwnOrganization | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const profile = await getOwnOrganizerProfileRef(currentUser.id);

  if (!profile) {
    return null;
  }

  const row = await prisma.organization.findFirst({
    where: { id: organizationId, ownerOrganizerProfileId: profile.id },
    select: organizationSelect,
  });

  return row ? toOwnOrganization(row, profile.ownedOrganizations[0]?.id ?? null) : null;
}

export type SaveOwnOrganizationErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "organization_not_found"
  | "validation_failed"
  | "organization_save_failed";

export type SaveOwnOrganizationResult =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      code: SaveOwnOrganizationErrorCode;
      message: string;
      validationErrors?: UpdateOwnOrganizationValidationError[];
    };

function toOrganizationData(input: UpdateOwnOrganizationInput) {
  return {
    name: input.name as string,
    type: input.type as OrganizationType,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
  };
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}

export async function createOwnOrganization(
  input: UpdateOwnOrganizationInput,
): Promise<SaveOwnOrganizationResult> {
  const validation = validateUpdateOwnOrganizationInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "團體資料需要調整後才能儲存。",
      validationErrors: validation.errors,
    };
  }

  try {
    const currentUser = await requireUser();
    const profile = await getOwnOrganizerProfileRef(currentUser.id);

    if (!profile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料，再新增團體。",
      };
    }

    // owner 一律由 server 寫入，不接受 client 指定。
    const organization = await prisma.organization.create({
      data: { ...toOrganizationData(input), ownerOrganizerProfileId: profile.id },
      select: { id: true },
    });

    return { ok: true, organizationId: organization.id };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再新增團體。",
      };
    }

    return {
      ok: false,
      code: "organization_save_failed",
      message: "團體資料暫時無法儲存，請稍後再試。",
    };
  }
}

export async function updateOwnOrganization(
  organizationId: string,
  input: UpdateOwnOrganizationInput,
): Promise<SaveOwnOrganizationResult> {
  const validation = validateUpdateOwnOrganizationInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "團體資料需要調整後才能儲存。",
      validationErrors: validation.errors,
    };
  }

  try {
    const currentUser = await requireUser();
    const profile = await getOwnOrganizerProfileRef(currentUser.id);

    if (!profile) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料，再編輯團體。",
      };
    }

    const updateResult = await prisma.organization.updateMany({
      where: { id: organizationId, ownerOrganizerProfileId: profile.id },
      data: toOrganizationData(input),
    });

    if (updateResult.count === 0) {
      return {
        ok: false,
        code: "organization_not_found",
        message: "找不到這個團體，或你沒有權限編輯。",
      };
    }

    return { ok: true, organizationId };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再編輯團體。",
      };
    }

    return {
      ok: false,
      code: "organization_save_failed",
      message: "團體資料暫時無法儲存，請稍後再試。",
    };
  }
}
