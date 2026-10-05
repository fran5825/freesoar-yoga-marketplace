export type AdminListKind = "teachers" | "demands" | "classes" | "organizations";
export type AdminRelationKey = "organizationId" | "teacherProfileId";
export type AdminListQuery = { q?: string; status?: string } & Partial<Record<AdminRelationKey, string>>;
export type NormalizedAdminListQuery = { q: string; status: string } & Partial<Record<AdminRelationKey, string>>;

const statuses: Record<AdminListKind, readonly string[]> = {
  teachers: ["pending", "approved", "suspended", "rejected", "all"],
  demands: ["pending", "published", "matched", "converted", "rejected", "cancelled", "all"],
  classes: ["all", "open", "completed", "cancelled", "draft"],
  organizations: ["all"],
};

// 第三批票 09：關聯限定只是篩選條件，不是授權；每個列表只接受自己支援的關聯，
// 值必須像資料庫 id（cuid），其他一律丟掉，避免把任意字串帶進網址或查詢。
const relationKeys: Record<AdminListKind, readonly AdminRelationKey[]> = {
  teachers: [],
  demands: ["organizationId"],
  classes: ["organizationId", "teacherProfileId"],
  // 第三批票 10：課程詳情「所屬團體」連到只看這個團體的團體列表。
  organizations: ["organizationId"],
};
const relationIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

export function normalizeAdminListQuery(kind: AdminListKind, query: AdminListQuery = {}): NormalizedAdminListQuery {
  const normalized: NormalizedAdminListQuery = {
    q: typeof query.q === "string" ? query.q.trim().slice(0, 200) : "",
    status: statuses[kind].includes(query.status ?? "") ? query.status! : statuses[kind][0],
  };
  for (const key of relationKeys[kind]) {
    const value = query[key];
    if (typeof value === "string" && relationIdPattern.test(value)) normalized[key] = value;
  }
  return normalized;
}

export function adminRelationParams(query: NormalizedAdminListQuery): Partial<Record<AdminRelationKey, string>> {
  return { organizationId: query.organizationId, teacherProfileId: query.teacherProfileId };
}

export function hasAdminRelation(query: NormalizedAdminListQuery): boolean {
  return Boolean(query.organizationId || query.teacherProfileId);
}

export function adminListHref(kind: AdminListKind, query: AdminListQuery = {}): string {
  const normalized = normalizeAdminListQuery(kind, query);
  const params = new URLSearchParams();
  for (const key of relationKeys[kind]) {
    const value = normalized[key];
    if (value) params.set(key, value);
  }
  if (normalized.status !== statuses[kind][0]) params.set("status", normalized.status);
  if (normalized.q) params.set("q", normalized.q);
  const suffix = params.toString();
  return `/admin/${kind}${suffix ? `?${suffix}` : ""}`;
}

// Return context is UI state, never authorization. Always reconstruct a known list path.
export function safeAdminReturnTo(kind: AdminListKind, value: unknown): string {
  const fallback = adminListHref(kind);
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://admin.invalid");
    if (url.origin !== "https://admin.invalid" || url.pathname !== `/admin/${kind}`) return fallback;
    return adminListHref(kind, {
      q: url.searchParams.get("q") ?? "",
      status: url.searchParams.get("status") ?? "",
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      teacherProfileId: url.searchParams.get("teacherProfileId") ?? undefined,
    });
  } catch {
    return fallback;
  }
}

export function adminDetailHref(kind: Exclude<AdminListKind, "organizations">, id: string, returnTo?: string): string {
  const path = `/admin/${kind}/${encodeURIComponent(id)}`;
  const context = safeAdminReturnTo(kind, returnTo);
  return context === adminListHref(kind) ? path : `${path}?${new URLSearchParams({ returnTo: context })}`;
}

export function adminFeedbackHref(kind: AdminListKind, returnTo: unknown, result: "success" | "error", message: string, item?: string): string {
  const url = new URL(safeAdminReturnTo(kind, returnTo), "https://admin.invalid");
  url.searchParams.set("result", result);
  url.searchParams.set("message", message);
  if (item) url.searchParams.set("item", item);
  return `${url.pathname}?${url.searchParams}`;
}

export function matchesAdminSearch(q: string, values: readonly (string | null | undefined)[]): boolean {
  const term = q.normalize("NFKC").toLocaleLowerCase();
  return !term || values.some((value) => value?.normalize("NFKC").toLocaleLowerCase().includes(term));
}

export function sortAdminClasses<T extends { id: string; startAt: Date }>(items: readonly T[], now: Date): T[] {
  return [...items].sort((a, b) => {
    const aFuture = a.startAt.getTime() > now.getTime();
    const bFuture = b.startAt.getTime() > now.getTime();
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    const difference = aFuture ? a.startAt.getTime() - b.startAt.getTime() : b.startAt.getTime() - a.startAt.getTime();
    return difference || a.id.localeCompare(b.id);
  });
}
