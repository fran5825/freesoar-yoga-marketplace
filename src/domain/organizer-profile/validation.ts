import { OrganizationType } from "@prisma/client";

export type CreateOrganizerProfileInput = {
  displayName?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
};

export type CreateOrganizerProfileValidationErrorCode =
  | "display_name_required"
  | "organization_name_required"
  | "organization_type_required"
  | "organization_type_invalid";

export type CreateOrganizerProfileValidationError = {
  field: "displayName" | "organizationName" | "organizationType";
  code: CreateOrganizerProfileValidationErrorCode;
  message: string;
};

export type CreateOrganizerProfileValidationResult =
  | {
      valid: true;
      errors: [];
    }
  | {
      valid: false;
      errors: CreateOrganizerProfileValidationError[];
    };

export function validateCreateOrganizerProfileInput(
  input: CreateOrganizerProfileInput,
): CreateOrganizerProfileValidationResult {
  const errors: CreateOrganizerProfileValidationError[] = [];

  if (isBlank(input.displayName)) {
    errors.push({
      field: "displayName",
      code: "display_name_required",
      message: "團主顯示名稱為必填欄位。",
    });
  }

  if (isBlank(input.organizationName)) {
    errors.push({
      field: "organizationName",
      code: "organization_name_required",
      message: "組織名稱為必填欄位。",
    });
  }

  if (isBlank(input.organizationType)) {
    errors.push({
      field: "organizationType",
      code: "organization_type_required",
      message: "組織類型為必填欄位。",
    });
  } else if (!isValidOrganizationType(input.organizationType as string)) {
    errors.push({
      field: "organizationType",
      code: "organization_type_invalid",
      message: "組織類型不在允許的選項內。",
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return createValidResult();
}

export type UpdateOwnOrganizationInput = {
  name?: string | null;
  type?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type UpdateOwnOrganizationValidationErrorCode =
  | "organization_name_required"
  | "organization_type_required"
  | "organization_type_invalid"
  | "contact_email_invalid";

export type UpdateOwnOrganizationValidationError = {
  field: "name" | "type" | "contactEmail";
  code: UpdateOwnOrganizationValidationErrorCode;
  message: string;
};

export type UpdateOwnOrganizationValidationResult =
  | {
      valid: true;
      errors: [];
    }
  | {
      valid: false;
      errors: UpdateOwnOrganizationValidationError[];
    };

// D4: contact 欄位在 schema 為 nullable，此處僅做基本形狀檢查；
// submit demand 時是否已填妥必填 contact 由 demand-request domain（Slice 4）另行把關。
export function validateUpdateOwnOrganizationInput(
  input: UpdateOwnOrganizationInput,
): UpdateOwnOrganizationValidationResult {
  const errors: UpdateOwnOrganizationValidationError[] = [];

  if (isBlank(input.name)) {
    errors.push({
      field: "name",
      code: "organization_name_required",
      message: "組織名稱為必填欄位。",
    });
  }

  if (isBlank(input.type)) {
    errors.push({
      field: "type",
      code: "organization_type_required",
      message: "組織類型為必填欄位。",
    });
  } else if (!isValidOrganizationType(input.type as string)) {
    errors.push({
      field: "type",
      code: "organization_type_invalid",
      message: "組織類型不在允許的選項內。",
    });
  }

  if (!isBlank(input.contactEmail) && !isValidEmailShape(input.contactEmail as string)) {
    errors.push({
      field: "contactEmail",
      code: "contact_email_invalid",
      message: "聯絡信箱格式不正確。",
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return createValidResult();
}

export type UpdateOwnOrganizerProfileInput = {
  displayName?: string | null;
};

export type UpdateOwnOrganizerProfileValidationErrorCode = "display_name_required";

export type UpdateOwnOrganizerProfileValidationError = {
  field: "displayName";
  code: UpdateOwnOrganizerProfileValidationErrorCode;
  message: string;
};

export type UpdateOwnOrganizerProfileValidationResult =
  | {
      valid: true;
      errors: [];
    }
  | {
      valid: false;
      errors: UpdateOwnOrganizerProfileValidationError[];
    };

// D3: 沿用建立時 displayName 的既有必填規則——已建立的團主資料不應該因為編輯
// 而被清空成空字串。
export function validateUpdateOwnOrganizerProfileInput(
  input: UpdateOwnOrganizerProfileInput,
): UpdateOwnOrganizerProfileValidationResult {
  const errors: UpdateOwnOrganizerProfileValidationError[] = [];

  if (isBlank(input.displayName)) {
    errors.push({
      field: "displayName",
      code: "display_name_required",
      message: "團主顯示名稱為必填欄位。",
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return createValidResult();
}

function createValidResult(): { valid: true; errors: [] } {
  return {
    valid: true,
    errors: [],
  };
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isValidOrganizationType(value: string): value is OrganizationType {
  return (Object.values(OrganizationType) as string[]).includes(value);
}

function isValidEmailShape(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
