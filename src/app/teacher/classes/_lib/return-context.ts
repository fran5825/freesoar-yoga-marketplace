import { parseCalendarDay, parseCalendarMonth } from "@/domain/teacher-calendar/month";

import { teacherCalendarHref } from "./calendar-params";
import {
  TEACHER_CLASS_LIST_TABS,
  type TeacherClassListStatusFilter,
  type TeacherClassListTab,
} from "./class-list-tabs";

// 老師單堂詳情的「返回」上下文（teacher-usability-redesign 票 04，規格 Q17）。
// 不收任意 return URL：只收固定的幾個參數，各自用白名單檢查，再由這裡組出站內路徑。
// - from=list：回我的課程，帶 tab（白名單分頁）與 status（只接受 cancelled）。
// - from=series：回系列頁，帶 series（id 格式），而且必須等於這堂課自己所屬的系列（呼叫端傳入），
//   所以不會被導到別人的系列。
// - from=calendar：回我的行事曆，帶 month（YYYY-MM）與 day（YYYY-MM-DD，必須在該月內，否則忽略）。
// 回去時加上 #class-<id>，瀏覽器會捲回剛才那張卡片的位置（月曆則停在同月同日）。
// 頁面網址與操作表單（server action）共用這裡的解析，不各自維護白名單（teacher-my-calendar spec 2.4）。

export type TeacherClassReturnContext =
  | { kind: "list"; tab: TeacherClassListTab; status: TeacherClassListStatusFilter | null }
  | { kind: "series"; seriesId: string }
  | { kind: "calendar"; month: string; day: string | null };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type RawReturnParams = {
  from?: unknown;
  tab?: unknown;
  status?: unknown;
  series?: unknown;
  month?: unknown;
  day?: unknown;
};

export function parseListTab(value: unknown): TeacherClassListTab {
  return typeof value === "string" && (TEACHER_CLASS_LIST_TABS as readonly string[]).includes(value)
    ? (value as TeacherClassListTab)
    : "upcoming";
}

export function parseListStatusFilter(
  tab: TeacherClassListTab,
  value: unknown,
): TeacherClassListStatusFilter | null {
  return tab === "all" && value === "cancelled" ? "cancelled" : null;
}

// ownSeriesId：這堂課自己的 recurringClassSeriesId（沒有就是 null）。
// 傳 undefined 時只檢查系列 id 格式、不比對所屬系列——給操作表單用，系列是否屬於這堂課由詳情頁再檢查。
export function parseReturnContext(
  params: RawReturnParams,
  ownSeriesId?: string | null,
): TeacherClassReturnContext | null {
  if (params.from === "series") {
    return typeof params.series === "string" &&
      ID_PATTERN.test(params.series) &&
      (ownSeriesId === undefined || params.series === ownSeriesId)
      ? { kind: "series", seriesId: params.series }
      : null;
  }

  if (params.from === "calendar") {
    const month = parseCalendarMonth(params.month);

    return month ? { kind: "calendar", month, day: parseCalendarDay(params.day, month) } : null;
  }

  if (params.from === "list") {
    const tab = parseListTab(params.tab);

    return { kind: "list", tab, status: parseListStatusFilter(tab, params.status) };
  }

  return null;
}

// 操作表單送來的返回上下文（隱藏欄位），解析規則與頁面網址相同。
export function readReturnContextFromForm(formData: FormData): TeacherClassReturnContext | null {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };

  return parseReturnContext({
    from: read("from"),
    tab: read("tab"),
    status: read("status"),
    series: read("series"),
    month: read("month"),
    day: read("day"),
  });
}

export function teacherClassListHref(
  tab: TeacherClassListTab,
  status: TeacherClassListStatusFilter | null = null,
  anchorClassId?: string,
): string {
  const query = new URLSearchParams();

  if (tab !== "upcoming") {
    query.set("tab", tab);
  }

  if (status) {
    query.set("status", status);
  }

  const search = query.toString();
  const hash = anchorClassId && ID_PATTERN.test(anchorClassId) ? `#class-${anchorClassId}` : "";

  return `/teacher/classes${search ? `?${search}` : ""}${hash}`;
}

// 詳情頁網址要帶的返回參數（給列表卡片、系列場次連結、詳情頁上的操作表單用）。
export function returnContextParams(context: TeacherClassReturnContext | null): [string, string][] {
  if (!context) {
    return [];
  }

  if (context.kind === "series") {
    return [
      ["from", "series"],
      ["series", context.seriesId],
    ];
  }

  if (context.kind === "calendar") {
    return [
      ["from", "calendar"],
      ["month", context.month],
      ...(context.day ? ([["day", context.day]] as [string, string][]) : []),
    ];
  }

  return [
    ["from", "list"],
    ...(context.tab !== "upcoming" ? ([["tab", context.tab]] as [string, string][]) : []),
    ...(context.status ? ([["status", context.status]] as [string, string][]) : []),
  ];
}

export function teacherClassDetailHref(
  classSessionId: string,
  context: TeacherClassReturnContext | null,
): string {
  const query = new URLSearchParams(returnContextParams(context)).toString();

  return `/teacher/classes/${encodeURIComponent(classSessionId)}${query ? `?${query}` : ""}`;
}

export function teacherClassBackLink(
  context: TeacherClassReturnContext | null,
  classSessionId: string,
): { href: string; label: string } {
  if (context?.kind === "series") {
    return {
      href: `/teacher/classes/series/${encodeURIComponent(context.seriesId)}#class-${classSessionId}`,
      label: "← 回課程系列",
    };
  }

  if (context?.kind === "calendar") {
    return { href: teacherCalendarHref(context.month, context.day), label: "← 回我的課程" };
  }

  return {
    href: teacherClassListHref(context?.tab ?? "upcoming", context?.status ?? null, classSessionId),
    label: "← 回我的課程",
  };
}
