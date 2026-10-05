import { expect, test } from "@playwright/test";
import { adminDetailHref, adminFeedbackHref, matchesAdminSearch, normalizeAdminListQuery, safeAdminReturnTo, sortAdminClasses } from "../../src/app/admin/_lib/list-context";

test("return context rejects external, cross-role and malformed paths, and removes unrelated parameters", () => {
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/member/enrollments", "/admin/classes", "/admin/teachers/abc", "/admin/teachers%2f..%2fclasses", null]) {
    expect(safeAdminReturnTo("teachers", value)).toBe("/admin/teachers");
  }
  expect(safeAdminReturnTo("teachers", "/admin/teachers?status=approved&q=Alice%26Bob&redirect=https://evil.example#hash")).toBe("/admin/teachers?status=approved&q=Alice%26Bob");
  expect(normalizeAdminListQuery("demands", { status: "draft", q: "  春日  " })).toEqual({ status: "pending", q: "春日" });
  expect(normalizeAdminListQuery("teachers", { q: "a".repeat(300) }).q).toHaveLength(200);
});

test("feedback and detail preserve a safe search context without treating keyword content as URL syntax", () => {
  const context = "/admin/classes?status=open&q=A%26B";
  const detail = new URL(adminDetailHref("classes", "id", context), "https://admin.invalid");
  expect(detail.searchParams.get("returnTo")).toBe(context);
  const feedback = new URL(adminFeedbackHref("classes", context, "success", "完成", "id"), "https://admin.invalid");
  expect(feedback.pathname).toBe("/admin/classes");
  expect(feedback.searchParams.get("q")).toBe("A&B");
  expect(feedback.searchParams.get("status")).toBe("open");
  expect(feedback.searchParams.get("item")).toBe("id");
});

test("relation filters are only accepted where supported, must look like ids, and survive return/detail/feedback", () => {
  expect(normalizeAdminListQuery("demands", { organizationId: "org_123", teacherProfileId: "t1" })).toEqual({ status: "pending", q: "", organizationId: "org_123" });
  expect(normalizeAdminListQuery("classes", { organizationId: "o1", teacherProfileId: "t1" })).toEqual({ status: "all", q: "", organizationId: "o1", teacherProfileId: "t1" });
  for (const kind of ["teachers", "organizations"] as const) {
    expect(normalizeAdminListQuery(kind, { organizationId: "o1", teacherProfileId: "t1" })).toEqual({ status: kind === "teachers" ? "pending" : "all", q: "" });
  }
  for (const bad of ["", "a b", "../x", "x".repeat(65), "https://evil.example", "1;drop"]) {
    expect(normalizeAdminListQuery("classes", { organizationId: bad }).organizationId).toBeUndefined();
  }

  const context = "/admin/demands?organizationId=org_1&status=all&q=A%26B&teacherProfileId=t1&redirect=https://evil.example";
  expect(safeAdminReturnTo("demands", context)).toBe("/admin/demands?organizationId=org_1&status=all&q=A%26B");
  expect(safeAdminReturnTo("demands", "/admin/demands?organizationId=bad%20id")).toBe("/admin/demands");

  const classContext = "/admin/classes?teacherProfileId=t1&status=open";
  const detail = new URL(adminDetailHref("classes", "id", classContext), "https://admin.invalid");
  expect(detail.searchParams.get("returnTo")).toBe(classContext);
  const feedback = new URL(adminFeedbackHref("classes", classContext, "success", "完成", "id"), "https://admin.invalid");
  expect(feedback.searchParams.get("teacherProfileId")).toBe("t1");
  expect(feedback.searchParams.get("status")).toBe("open");
});

test("search handles missing fields, fullwidth text, case and Chinese partial terms", () => {
  expect(matchesAdminSearch("alice", [null, undefined, "ＡＬＩＣＥ"])).toBe(true);
  expect(matchesAdminSearch("春日", ["春日身心練習"])).toBe(true);
  expect(matchesAdminSearch("missing", [null, "春日"])).toBe(false);
});

test("class order puts upcoming earliest first, then history newest first, without changing the source", () => {
  const items = [
    { id: "past-old", startAt: new Date("2026-01-01") },
    { id: "future-late", startAt: new Date("2026-04-01") },
    { id: "future-first", startAt: new Date("2026-03-01") },
    { id: "past-new", startAt: new Date("2026-02-01") },
  ];
  expect(sortAdminClasses(items, new Date("2026-02-15")).map((item) => item.id)).toEqual(["future-first", "future-late", "past-new", "past-old"]);
  expect(items[0].id).toBe("past-old");
});
