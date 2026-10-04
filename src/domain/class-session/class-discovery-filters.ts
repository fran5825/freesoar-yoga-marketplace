export type DiscoveryParams = Record<string, string | string[] | undefined>;

export function classDiscoveryWeekday(date: Date): string {
  return ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][new Date(date.getTime() + 8 * 3600_000).getUTCDay()];
}
export const DATE_RANGES = ["all", "today", "week", "month", "custom"] as const;
export const TIME_RANGES = ["all", "morning", "afternoon", "evening"] as const;
export type ClassDiscoveryFilters = {
  dateRange: (typeof DATE_RANGES)[number];
  dateFrom: string;
  dateTo: string;
  timeOfDay: (typeof TIME_RANGES)[number];
  location: string;
  yogaStyle: string;
  serviceType: string;
  dayOfWeek?: number;
  includeFull: boolean;
};

function value(params: DiscoveryParams, key: string): string {
  const raw = params[key];
  return (typeof raw === "string" ? raw : raw?.[0] ?? "").trim();
}

export function taipeiDateStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return local === value ? date : null;
}

export function parseClassDiscoveryFilters(params: DiscoveryParams = {}) {
  const errors: string[] = [];
  const date = value(params, "dateRange") || "all";
  const time = value(params, "timeOfDay") || "all";
  const day = value(params, "dayOfWeek");
  if (!(DATE_RANGES as readonly string[]).includes(date)) errors.push("請選擇有效的日期範圍。");
  if (!(TIME_RANGES as readonly string[]).includes(time)) errors.push("請選擇有效的時段。");
  if (day && !/^[0-6]$/.test(day)) errors.push("請選擇有效的星期。");
  const filters: ClassDiscoveryFilters = {
    dateRange: (DATE_RANGES as readonly string[]).includes(date) ? date as ClassDiscoveryFilters["dateRange"] : "all",
    dateFrom: value(params, "dateFrom"),
    dateTo: value(params, "dateTo"),
    timeOfDay: (TIME_RANGES as readonly string[]).includes(time) ? time as ClassDiscoveryFilters["timeOfDay"] : "all",
    location: value(params, "location"),
    yogaStyle: value(params, "yogaStyle"),
    serviceType: value(params, "serviceType"),
    dayOfWeek: /^[0-6]$/.test(day) ? Number(day) : undefined,
    includeFull: value(params, "includeFull") === "1",
  };
  if (filters.location.length > 200) errors.push("地點關鍵字請控制在 200 字內。");
  if (filters.yogaStyle.length > 50 || filters.serviceType.length > 100) errors.push("課程篩選文字過長。");
  if (filters.dateRange === "custom") {
    const from = taipeiDateStart(filters.dateFrom);
    const to = taipeiDateStart(filters.dateTo);
    if (!from || !to) errors.push("請填寫有效的開始與結束日期。");
    else if (from > to) errors.push("結束日期不能早於開始日期。");
  }
  return { filters, errors };
}

export function classDiscoveryHref(filters: ClassDiscoveryFilters): string {
  const query = new URLSearchParams();
  if (filters.dateRange !== "all") query.set("dateRange", filters.dateRange);
  if (filters.dateRange === "custom") {
    query.set("dateFrom", filters.dateFrom);
    query.set("dateTo", filters.dateTo);
  }
  if (filters.timeOfDay !== "all") query.set("timeOfDay", filters.timeOfDay);
  for (const key of ["location", "yogaStyle", "serviceType"] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  if (filters.dayOfWeek !== undefined) query.set("dayOfWeek", String(filters.dayOfWeek));
  if (filters.includeFull) query.set("includeFull", "1");
  return query.size ? `/classes?${query}` : "/classes";
}

export function classDiscoveryDateBounds(filters: ClassDiscoveryFilters, now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = taipeiDateStart(today)!;
  if (filters.dateRange === "custom") {
    const from = taipeiDateStart(filters.dateFrom);
    const to = taipeiDateStart(filters.dateTo);
    return { from, to: to ? new Date(to.getTime() + dayMs) : null };
  }
  const days = { today: 1, week: 7, month: 30 }[filters.dateRange as "today" | "week" | "month"];
  return days ? { from: start, to: new Date(start.getTime() + days * dayMs) } : { from: null, to: null };
}

export function matchesClassDiscoveryTime(startAt: Date, filters: ClassDiscoveryFilters, now: Date): boolean {
  if (startAt <= now) return false;
  const { from, to } = classDiscoveryDateBounds(filters, now);
  if (filters.dateRange === "custom" && (!from || !to)) return false;
  if ((from && startAt < from) || (to && startAt >= to)) return false;
  const hour = new Date(startAt.getTime() + 8 * 60 * 60 * 1000).getUTCHours();
  if (filters.timeOfDay === "morning") return hour < 12;
  if (filters.timeOfDay === "afternoon") return hour >= 12 && hour < 18;
  if (filters.timeOfDay === "evening") return hour >= 18;
  return true;
}
