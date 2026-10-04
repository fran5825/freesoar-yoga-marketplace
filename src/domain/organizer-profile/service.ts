import { OrganizationType, Prisma } from "@prisma/client";

import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  type CreateOrganizerProfileInput,
  type CreateOrganizerProfileValidationError,
  type UpdateOwnOrganizerProfileInput,
  type UpdateOwnOrganizerProfileValidationError,
  validateCreateOrganizerProfileInput,
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
      organization: {
        select: { ...organizationSelect, ownerOrganizerProfileId: true },
      },
    },
  });

  if (!organizerProfile) {
    return null;
  }

  const { organization, ...profile } = organizerProfile;

  // organizer-usability-redesign 票 02：legacy pointer 只決定「預設團體」，能不能讀到團體資料看 owner。
  // owner 不是本人（含 owner 為 null 的孤立團體）時一律不回傳，避免洩漏他人聯絡資料。
  if (!organization || organization.ownerOrganizerProfileId !== profile.id) {
    return { organizerProfile: profile, organization: null };
  }

  const { ownerOrganizerProfileId: _owner, ...ownedOrganization } = organization;
  void _owner;

  return {
    organizerProfile: profile,
    organization: ownedOrganization,
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
            contactName: input.contactName as string,
            contactEmail: input.contactEmail as string,
            contactPhone: input.contactPhone as string,
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

        // organizer-usability-redesign 票 02：第一個團體同時寫入 owner 與 legacy pointer，
        // 之後的授權一律看 owner；同一個 transaction 內完成，失敗不留半筆。
        await tx.organization.update({
          where: { id: organization.id },
          data: { ownerOrganizerProfileId: organizerProfile.id },
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
