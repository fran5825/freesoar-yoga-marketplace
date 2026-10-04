import { classDiscoveryHref, parseClassDiscoveryFilters } from "@/domain/class-session/class-discovery-filters";

// 僅為找課返回 context，不是通用 callback 或授權來源。
export function safeClassReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /\\|%5c/i.test(value)) return "/classes";
  try {
    const url = new URL(value, "https://freesoar.invalid");
    if (url.origin !== "https://freesoar.invalid" || url.pathname !== "/classes" || url.hash) return "/classes";
    const { filters, errors } = parseClassDiscoveryFilters(Object.fromEntries(url.searchParams));
    return errors.length ? "/classes" : classDiscoveryHref(filters);
  } catch {
    return "/classes";
  }
}

export function classDetailHref(id: string, returnTo: string): string {
  const safe = safeClassReturnPath(returnTo);
  return `/classes/${encodeURIComponent(id)}${safe === "/classes" ? "" : `?returnTo=${encodeURIComponent(safe)}`}`;
}
