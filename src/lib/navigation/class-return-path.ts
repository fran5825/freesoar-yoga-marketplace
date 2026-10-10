import { classDiscoveryHref, parseClassDiscoveryFilters } from "@/domain/class-session/class-discovery-filters";

// 僅為學員端「返回哪一頁」的 context，不是通用 callback 或授權來源。
// 白名單：/classes（含合法篩選）、/member/enrollments、/member/dashboard、
// /classes/terms/{id}、/classes/series/{id}（後兩者可再帶一層上一層來源，不能再巢狀）。
const DEFAULT_RETURN_PATH = "/classes";
const FAKE_ORIGIN = "https://freesoar.invalid";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_RETURN_LENGTH = 600;

function parseReturnPath(value: unknown, allowNested: boolean): string | null {
  if (typeof value !== "string" || value.length > MAX_RETURN_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//") || /\|%5c/i.test(value)) return null;
  try {
    const url = new URL(value, FAKE_ORIGIN);
    if (url.origin !== FAKE_ORIGIN || url.hash) return null;
    const { pathname, searchParams } = url;

    if (pathname === "/classes") {
      const { filters, errors } = parseClassDiscoveryFilters(Object.fromEntries(searchParams));
      return errors.length ? null : classDiscoveryHref(filters);
    }
    if (pathname === "/member/enrollments" || pathname === "/member/dashboard") {
      return url.search ? null : pathname;
    }
    const parent = pathname.match(/^\/classes\/(terms|series)\/([^/]+)$/);
    if (parent && ID_PATTERN.test(parent[2])) {
      const keys = [...searchParams.keys()];
      if (keys.some((key) => key !== "returnTo") || searchParams.getAll("returnTo").length > 1) return null;
      const inner = searchParams.get("returnTo");
      if (inner === null) return pathname;
      if (!allowNested) return null;
      const safeInner = parseReturnPath(inner, false);
      if (!safeInner) return null;
      return safeInner === DEFAULT_RETURN_PATH ? pathname : `${pathname}?returnTo=${encodeURIComponent(safeInner)}`;
    }
    return null;
  } catch {
    return null;
  }
}

// 單堂頁用：可以是期班頁／持續開課頁，且那一頁自己的來源也保留一層。
export function safeClassReturnPath(value: unknown): string {
  return parseReturnPath(value, true) ?? DEFAULT_RETURN_PATH;
}

// 期班頁、持續開課頁用：只接受不再巢狀的來源。
export function safeParentReturnPath(value: unknown): string {
  return parseReturnPath(value, false) ?? DEFAULT_RETURN_PATH;
}

// 返回連結的文字跟目的地一致。
export function classReturnLabel(returnTo: string): string {
  const safe = safeClassReturnPath(returnTo);
  if (safe.startsWith("/member/enrollments")) return "返回我的報名";
  if (safe.startsWith("/member/dashboard")) return "返回首頁";
  if (safe.startsWith("/classes/terms/")) return "返回期班";
  if (safe.startsWith("/classes/series/")) return "返回持續開課";
  return "返回課程列表";
}

function withReturnTo(path: string, returnTo: string): string {
  const safe = safeParentReturnPath(returnTo);
  return safe === DEFAULT_RETURN_PATH ? path : `${path}?returnTo=${encodeURIComponent(safe)}`;
}

export function classDetailHref(id: string, returnTo: string): string {
  const safe = safeClassReturnPath(returnTo);
  return `/classes/${encodeURIComponent(id)}${safe === DEFAULT_RETURN_PATH ? "" : `?returnTo=${encodeURIComponent(safe)}`}`;
}

// 期班頁、持續開課頁的連結：returnTo 是「這一頁的來源」。
export function termDetailHref(id: string, returnTo: string): string {
  return withReturnTo(`/classes/terms/${encodeURIComponent(id)}`, returnTo);
}

export function seriesDetailHref(id: string, returnTo: string): string {
  return withReturnTo(`/classes/series/${encodeURIComponent(id)}`, returnTo);
}
