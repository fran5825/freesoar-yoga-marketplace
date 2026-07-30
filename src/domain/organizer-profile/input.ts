import type {
  CreateOrganizerProfileInput,
  UpdateOwnOrganizationInput,
  UpdateOwnOrganizerProfileInput,
} from "./validation";

export type CreateOrganizerProfileFormInput = {
  displayName: string;
  organizationName: string;
  organizationType: string;
};

export function normalizeCreateOrganizerProfileInput(
  input: CreateOrganizerProfileFormInput,
): CreateOrganizerProfileInput {
  return {
    displayName: normalizeOptionalString(input.displayName),
    organizationName: normalizeOptionalString(input.organizationName),
    organizationType: normalizeOptionalString(input.organizationType),
  };
}

export type UpdateOwnOrganizationFormInput = {
  name: string;
  type: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export function normalizeUpdateOwnOrganizationInput(
  input: UpdateOwnOrganizationFormInput,
): UpdateOwnOrganizationInput {
  return {
    name: normalizeOptionalString(input.name),
    type: normalizeOptionalString(input.type),
    contactName: normalizeOptionalString(input.contactName),
    contactEmail: normalizeOptionalString(input.contactEmail),
    contactPhone: normalizeOptionalString(input.contactPhone),
  };
}

export type UpdateOwnOrganizerProfileFormInput = {
  displayName: string;
};

export function normalizeUpdateOwnOrganizerProfileInput(
  input: UpdateOwnOrganizerProfileFormInput,
): UpdateOwnOrganizerProfileInput {
  return {
    displayName: normalizeOptionalString(input.displayName),
  };
}

function normalizeOptionalString(value: string): string | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue;
}
