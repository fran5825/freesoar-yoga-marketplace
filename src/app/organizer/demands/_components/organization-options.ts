import type { OwnOrganization } from "@/domain/organization/service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";

import type { DemandRequestOrganizationOption } from "./DemandRequestForm";

// organizer-usability-redesign 票 04：需求表單的團體選項。只有本人擁有的團體（由 service 以 owner 查出）。
export function toDemandRequestOrganizationOptions(
  organizations: OwnOrganization[],
): DemandRequestOrganizationOption[] {
  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    typeLabel: organizationTypeLabels[organization.type],
    isContactComplete: organization.isContactComplete,
  }));
}

// 決定表單一開始選哪個團體：從「新增團體」回來時帶的 organizationId（必須是自己的）優先，
// 其次是 fallback（既有需求的團體），再來是預設團體，最後是第一個。
export function pickInitialOrganizationId(
  organizations: OwnOrganization[],
  requestedId: string | undefined,
  fallbackId: string | null,
): string | null {
  const owns = (id: string | null | undefined) =>
    Boolean(id) && organizations.some((organization) => organization.id === id);

  if (owns(requestedId)) {
    return requestedId as string;
  }

  if (owns(fallbackId)) {
    return fallbackId;
  }

  return (
    organizations.find((organization) => organization.isDefault)?.id ??
    organizations[0]?.id ??
    null
  );
}

// 未登入轉到登入頁時，只把允許的預選參數接回原路徑（cuid 形式），其他 query 一律不帶。
export function withOrganizationParam(path: string, organizationId: string | undefined): string {
  if (!organizationId || !/^[a-z0-9]{10,40}$/i.test(organizationId)) {
    return path;
  }
  return `${path}?organizationId=${encodeURIComponent(organizationId)}`;
}
