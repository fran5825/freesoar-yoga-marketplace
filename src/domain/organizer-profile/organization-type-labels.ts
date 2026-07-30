import type { OrganizationType } from "@prisma/client";

export const organizationTypeLabels = {
  company: "公司",
  company_club: "公司社團",
  community: "社區",
  family_group: "親友揪團",
  other: "其他",
} satisfies Record<OrganizationType, string>;

export const ORGANIZATION_TYPE_OPTIONS: { value: OrganizationType; label: string }[] =
  Object.entries(organizationTypeLabels).map(([value, label]) => ({
    value: value as OrganizationType,
    label,
  }));
