import { OrganizationType, Prisma } from "@prisma/client";

import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  type CreateOrganizerProfileInput,
  type CreateOrganizerProfileValidationError,
  type UpdateOwnOrganizationInput,
  type UpdateOwnOrganizationValidationError,
  type UpdateOwnOrganizerProfileInput,
  type UpdateOwnOrganizerProfileValidationError,
  validateCreateOrganizerProfileInput,
  validateUpdateOwnOrganizationInput,
  validateUpdateOwnOrganizerProfileInput,
} from "./validation";

export type OrganizerContextOrganization = {
  id: string;
  name: string;
  type: OrganizationType;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizerContextProfile = {
  id: string;
  userId: string;
  organizationId: string | null;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OwnOrganizerContext = {
  organizerProfile: OrganizerContextProfile;
  organization: OrganizerContextOrganization | null;
};

const organizerProfileSelect = {
  id: true,
  userId: true,
  organizationId: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

export async function getOwnOrganizerContext(): Promise<OwnOrganizerContext | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const organizerProfile = await prisma.organizerProfile.findUnique({
    where: { userId: currentUser.id },
    select: {
      ...organizerProfileSelect,
      organization: { select: organizationSelect },
    },
  });

  if (!organizerProfile) {
    return null;
  }

  const { organization, ...profile } = organizerProfile;

  return {
    organizerProfile: profile,
    organization: organization ?? null,
  };
}

export type CreateOwnOrganizerProfileErrorCode =
  | "authentication_required"
  | "validation_failed"
  | "organizer_profile_already_exists"
  | "organizer_profile_create_failed";

export type CreateOwnOrganizerProfileResult =
  | {
      ok: true;
      organizerProfile: OrganizerContextProfile;
      organization: OrganizerContextOrganization;
    }
  | {
      ok: false;
      code: CreateOwnOrganizerProfileErrorCode;
      message: string;
      validationErrors?: CreateOrganizerProfileValidationError[];
    };

export async function createOwnOrganizerProfileWithOrganization(
  input: CreateOrganizerProfileInput,
): Promise<CreateOwnOrganizerProfileResult> {
  const validation = validateCreateOrganizerProfileInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "建立團主資料前，請先補齊必填欄位。",
      validationErrors: validation.errors,
    };
  }

  try {
    const currentUser = await requireUser();

    const existingProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (existingProfile) {
      return {
        ok: false,
        code: "organizer_profile_already_exists",
        message: "您已經建立過團主資料，請直接編輯既有資料。",
      };
    }

    const { organizerProfile, organization } = await prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: input.organizationName as string,
            type: input.organizationType as OrganizationType,
          },
          select: organizationSelect,
        });

        const organizerProfile = await tx.organizerProfile.create({
          data: {
            userId: currentUser.id,
            organizationId: organization.id,
            displayName: input.displayName as string,
          },
          select: organizerProfileSelect,
        });

        return { organizerProfile, organization };
      },
    );

    return {
      ok: true,
      organizerProfile,
      organization,
    };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再建立團主資料。",
      };
    }

    if (isUniqueConstraintViolation(error)) {
      return {
        ok: false,
        code: "organizer_profile_already_exists",
        message: "您已經建立過團主資料，請直接編輯既有資料。",
      };
    }

    return {
      ok: false,
      code: "organizer_profile_create_failed",
      message: "團主資料暫時無法建立，請稍後再試。",
    };
  }
}

export type UpdateOwnOrganizationErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "validation_failed"
  | "organization_update_failed";

export type UpdateOwnOrganizationResult =
  | {
      ok: true;
      organization: OrganizerContextOrganization;
    }
  | {
      ok: false;
      code: UpdateOwnOrganizationErrorCode;
      message: string;
      validationErrors?: UpdateOwnOrganizationValidationError[];
    };

export async function updateOwnOrganization(
  input: UpdateOwnOrganizationInput,
): Promise<UpdateOwnOrganizationResult> {
  const validation = validateUpdateOwnOrganizationInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "組織資料格式需要調整後才能儲存。",
      validationErrors: validation.errors,
    };
  }

  try {
    const currentUser = await requireUser();

    const organizerProfile = await prisma.organizerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { organizationId: true },
    });

    if (!organizerProfile || !organizerProfile.organizationId) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料後再編輯組織資訊。",
      };
    }

    // 雙重 own-scope 限制：organizationId 已由 server 從自己的 OrganizerProfile 解析，
    // 這裡再加一層 organizerProfiles.some(userId) 條件防止任何情境下誤用他人 id。
    const updateResult = await prisma.organization.updateMany({
      where: {
        id: organizerProfile.organizationId,
        organizerProfiles: { some: { userId: currentUser.id } },
      },
      data: {
        name: input.name as string,
        type: input.type as OrganizationType,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
      },
    });

    if (updateResult.count === 0) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料後再編輯組織資訊。",
      };
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizerProfile.organizationId },
      select: organizationSelect,
    });

    return {
      ok: true,
      organization,
    };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再編輯組織資訊。",
      };
    }

    return {
      ok: false,
      code: "organization_update_failed",
      message: "組織資訊暫時無法更新，請稍後再試。",
    };
  }
}

export type UpdateOwnOrganizerProfileErrorCode =
  | "authentication_required"
  | "organizer_profile_required"
  | "validation_failed"
  | "organizer_profile_update_failed";

export type UpdateOwnOrganizerProfileResult =
  | {
      ok: true;
      organizerProfile: OrganizerContextProfile;
    }
  | {
      ok: false;
      code: UpdateOwnOrganizerProfileErrorCode;
      message: string;
      validationErrors?: UpdateOwnOrganizerProfileValidationError[];
    };

// D1/D2/D3：OrganizerProfile 沒有 status 欄位，任何已建立 OrganizerProfile 的使用者
// 都能編輯自己的 displayName，不需要額外的狀態判斷。
export async function updateOwnOrganizerProfile(
  input: UpdateOwnOrganizerProfileInput,
): Promise<UpdateOwnOrganizerProfileResult> {
  const validation = validateUpdateOwnOrganizerProfileInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "validation_failed",
      message: "團主資料格式需要調整後才能儲存。",
      validationErrors: validation.errors,
    };
  }

  try {
    const currentUser = await requireUser();

    const updateResult = await prisma.organizerProfile.updateMany({
      where: { userId: currentUser.id },
      data: { displayName: input.displayName as string },
    });

    if (updateResult.count === 0) {
      return {
        ok: false,
        code: "organizer_profile_required",
        message: "請先建立團主資料後再編輯顯示名稱。",
      };
    }

    const organizerProfile = await prisma.organizerProfile.findUniqueOrThrow({
      where: { userId: currentUser.id },
      select: organizerProfileSelect,
    });

    return {
      ok: true,
      organizerProfile,
    };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再編輯團主顯示名稱。",
      };
    }

    return {
      ok: false,
      code: "organizer_profile_update_failed",
      message: "團主顯示名稱暫時無法更新，請稍後再試。",
    };
  }
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
