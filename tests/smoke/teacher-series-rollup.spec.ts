import { expect, test, type Page } from "@playwright/test";

import { getClassActionSlots } from "../../src/domain/class-session/class-action-slots";
import { seriesBadgeLabel } from "../../src/domain/class-session/series-badge";
import { rollupClassList, type RollupSession } from "../../src/domain/class-session/teacher-class-list";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { formatDateRange } from "../../src/domain/notification/date-range";
import { groupNotifications } from "../../src/domain/notification/grouping";
import type { OwnNotification } from "../../src/domain/notification/read-service";
import { addAuthSessionCookie, createUserSession, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-series-rollup 票 01–08：系列卡、單堂頁操作列與期班標籤、名單一排、系列頁快速按鈕、管理員系列頁、通知合併。
const fixtures = createTermFixtures("teacher-series-rollup-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;
const adminEmails: string[] = [];

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: adminEmails } } });
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("rules", () => {
  test("action slots: at most two per state, the rest go to 更多; a role never gets an action it does not have", () => {
    expect(getClassActionSlots({ phase: "draft", available: ["open", "edit", "cancel", "cancelFromHere"] })).toEqual({
      primary: "open",
      secondary: "edit",
      rest: ["cancel", "cancelFromHere"],
    });
    expect(getClassActionSlots({ phase: "open_before_start", available: ["copyLink", "cancel", "edit"] })).toEqual({
      primary: "copyLink",
      secondary: "cancel",
      rest: ["edit"],
    });
    expect(getClassActionSlots({ phase: "ended_awaiting_completion", available: ["complete", "copyLink"] })).toEqual({
      primary: "complete",
      secondary: null,
      rest: ["copyLink"],
    });
    // 團主媒合的課老師只能複製連結；管理員只有取消。
    expect(getClassActionSlots({ phase: "open_before_start", available: ["copyLink"] })).toEqual({ primary: "copyLink", secondary: null, rest: [] });
    expect(getClassActionSlots({ phase: "open_before_start", available: ["cancel"], singleSlot: true })).toEqual({ primary: "cancel", secondary: null, rest: [] });
  });

  test("series badge and date range wording", () => {
    expect(seriesBadgeLabel({ seriesId: "s", kind: "term", position: 3, total: 8, dayOfWeek: 2 })).toBe("期班・第 3 堂／共 8 堂");
    expect(seriesBadgeLabel({ seriesId: "s", kind: "continuous", position: 1, total: 4, dayOfWeek: 4 })).toBe("持續開課・每週四");
    expect(seriesBadgeLabel({ seriesId: "s", kind: "continuous", position: 1, total: 4, dayOfWeek: null })).toBe("持續開課");
    expect(formatDateRange(new Date("2026-10-15T11:00:00Z"), new Date("2026-12-03T11:00:00Z"))).toBe("10/15–12/03");
  });

  test("rollup: one card per series in place of its first session, distinct students, most urgent first", () => {
    const now = new Date("2026-10-11T00:00:00Z");
    const series = { title: "週四", kind: "term" as const, dayOfWeek: 4, startTime: "19:00", endTime: "20:00" };
    const session = (id: string, day: number, enrollments: RollupSession["enrollments"], status: RollupSession["status"] = "open_for_enrollment", seriesId: string | null = "s1"): RollupSession => ({
      id,
      status,
      origin: "teacher_initiated",
      startAt: new Date(Date.UTC(2026, 9, day, 11)),
      endAt: new Date(Date.UTC(2026, 9, day, 12)),
      location: "教室",
      recurringClassSeriesId: seriesId,
      recurringClassSeries: seriesId ? series : null,
      enrollments,
    });
    const entries = rollupClassList(
      [
        session("a", 12, [{ status: "confirmed", userId: "u1" }]),
        session("single", 13, [], "open_for_enrollment", null),
        session("b", 19, [{ status: "confirmed", userId: "u1" }, { status: "pending", userId: "u2" }]),
        session("c", 26, [], "draft"),
      ],
      now,
    );
    expect(entries.map((entry) => entry.kind)).toEqual(["series", "single"]);
    const card = entries[0];
    if (card.kind !== "series") throw new Error("expected a series card");
    expect(card.sessions.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(card.confirmedStudents).toBe(1);
    expect(card.pendingStudents).toBe(1);
    expect(card.urgent).toEqual({ kind: "pending", count: 1 });
  });

  test("notification grouping: same type, series and Taipei day only", () => {
    const base = { title: "t", body: "b", targetType: null, targetId: null } as const;
    const raw: OwnNotification[] = [
      { ...base, id: "1", type: "class_session_cancelled", recurringClassSeriesId: "s1", createdAt: new Date("2026-10-10T15:30:00Z") },
      { ...base, id: "2", type: "class_session_cancelled", recurringClassSeriesId: "s1", createdAt: new Date("2026-10-10T16:30:00Z") },
      { ...base, id: "3", type: "class_session_cancelled", recurringClassSeriesId: "s1", createdAt: new Date("2026-10-10T15:00:00Z") },
      { ...base, id: "4", type: "class_session_changed", recurringClassSeriesId: "s1", createdAt: new Date("2026-10-10T15:20:00Z") },
      { ...base, id: "5", type: "class_session_cancelled", recurringClassSeriesId: null, createdAt: new Date("2026-10-10T15:10:00Z") },
    ];
    const list = [...raw].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    // 台北時間 10/10 23:00 與 10/11 00:30 是不同天；10/10 23:00 與 23:30 同一天。
    const grouped = groupNotifications(list);
    expect(grouped.map((item) => [item.id, item.count])).toEqual([
      ["2", 1],
      ["1", 2],
      ["4", 1],
      ["5", 1],
    ]);
  });
});

test("teacher list: a series shows as one card that opens the series page; back returns to the same tab", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "list");
  const teacher = await seedTeacher(id);
  const { series } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `系列卡 ${id}` });
  await addAuthSessionCookie(context, teacher.sessionToken);

  await page.goto("/teacher/classes");
  const cards = page.locator(`#series-${series.id}`);
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("持續開課・3 堂即將上課");
  await expect(page.getByRole("heading", { name: `系列卡 ${id}` })).toHaveCount(1);
  await cards.click();
  await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}`));
  await page.getByRole("link", { name: "← 回我的課程" }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/classes(\\?.*)?#series-${series.id}`));
  expect(await noOverflow(page)).toBe(true);
});

test("teacher class page: buttons sit in one bar, explanations move into dialogs; the term label and one-row roster", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "class");
  const teacher = await seedTeacher(id);
  const termMember = await seedMember(id, "term");
  const singleMember = await seedMember(id, "single");
  const term = await seedTerm(teacher.teacherProfileId, { count: 3, mode: "term_and_single", title: `操作列期班 ${id}` });
  const joined = await createSeriesEnrollmentForUser(termMember.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const single = await createEnrollmentForUser(singleMember.id, term.sessions[1].id, { notes: null });
  if (!single.ok) throw new Error("fixture");
  await prisma.enrollment.updateMany({ where: { id: single.enrollmentId }, data: { transferNote: "12345" } });
  await addAuthSessionCookie(context, teacher.sessionToken);

  await page.goto(`/teacher/classes/${term.sessions[1].id}`);
  await expect(page.getByRole("link", { name: "期班・第 2 堂／共 3 堂" })).toBeVisible();
  const bar = page.getByRole("group", { name: "課程操作" });
  await expect(bar.getByRole("button", { name: "複製報名連結" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "取消課程" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "分享給學員" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "取消這堂課" })).toHaveCount(0);

  // 名單：整期學員不加標籤，單堂學員加「單堂」；付款標籤、轉帳備註與按鈕同一排。
  const singleRow = page.getByRole("listitem").filter({ hasText: "12345" });
  await expect(singleRow).toContainText("單堂");
  await expect(singleRow).toContainText("付款：待付款");
  await expect(singleRow).toContainText("轉帳備註：12345");
  await expect(singleRow.getByRole("button", { name: /標記 .* 為已收款/ })).toBeVisible();
  const termRow = page.getByRole("listitem").filter({ hasText: /member-term/ });
  await expect(termRow).not.toContainText("整期");
  await expect(termRow).not.toContainText("單堂");
  expect(await noOverflow(page)).toBe(true);
});

test("teacher series page: one quick button per row (開放報名 on a draft) and it returns to that row", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "series-page");
  const teacher = await seedTeacher(id);
  const term = await seedTerm(teacher.teacherProfileId, { count: 2, open: false, title: `快速按鈕 ${id}` });
  await addAuthSessionCookie(context, teacher.sessionToken);

  await page.goto(`/teacher/classes/series/${term.series.id}`);
  const row = page.locator(`#class-${term.sessions[1].id}`);
  await row.getByRole("button", { name: /開放 .* 這一場的報名/ }).click();
  await expect(page).toHaveURL(new RegExp(`focus=class-${term.sessions[1].id}`));
  await expect(page.getByText("已開放報名。")).toBeVisible();
  await expect(page.locator(`#class-${term.sessions[1].id}`).getByRole("button", { name: /取消 .* 這一場/ })).toBeVisible();
  const opened = await prisma.classSession.findUnique({ where: { id: term.sessions[1].id }, select: { status: true } });
  expect(opened?.status).toBe("open_for_enrollment");
});

test("admin: the class list rolls a series into one card that opens a read-only series page; non-admins get 404", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "admin");
  const teacher = await seedTeacher(id);
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `管理員系列 ${id}` });
  const adminEmail = `admin-${id}@teacher-series-rollup-smoke.local`;
  adminEmails.push(adminEmail);
  const admin = await createUserSession({ email: adminEmail, isAdmin: true });
  await addAuthSessionCookie(context, admin.sessionToken);

  await page.goto(`/admin/classes?q=${encodeURIComponent(`管理員系列 ${id}`)}`);
  await expect(page.getByRole("link", { name: new RegExp(`管理員系列 ${id}`) })).toHaveCount(1);
  await page.getByRole("link", { name: new RegExp(`管理員系列 ${id}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/classes/series/${series.id}`));
  await expect(page.getByRole("heading", { name: "每一場（3）" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp("已報名 0") }).first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/classes/${sessions[0].id}`));

  await context.clearCookies();
  await addAuthSessionCookie(context, teacher.sessionToken);
  const response = await page.goto(`/admin/classes/series/${series.id}`);
  expect(response?.status()).toBe(404);
});

test("notifications: creating a series sends one 共 N 堂 notification linking to the series page; cancelling from a row folds member notices", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "notify");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `通知系列 ${id}` });

  const created = await prisma.notification.findMany({ where: { userId: teacher.userId, type: "class_session_created", channel: "in_app" } });
  expect(created).toHaveLength(1);
  expect(created[0].body).toContain("共 3 堂");
  expect(created[0].recurringClassSeriesId).toBe(series.id);

  for (const session of sessions) {
    const enrolled = await createEnrollmentForUser(member.id, session.id, { notes: null });
    if (!enrolled.ok) throw new Error("fixture");
  }

  await addAuthSessionCookie(context, teacher.sessionToken);
  await page.goto("/teacher/notifications");
  const card = page.getByRole("article").filter({ hasText: `通知系列 ${id}` }).filter({ hasText: "課程已建立" });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("link", { name: /前往系列頁/ })).toHaveAttribute("href", `/teacher/classes/series/${series.id}`);

  // 學員：同一系列同一天三則「報名成功」合成一則。
  await context.clearCookies();
  await addAuthSessionCookie(context, member.sessionToken);
  await page.goto("/notifications");
  const memberCard = page.getByRole("article").filter({ hasText: `通知系列 ${id}` });
  await expect(memberCard).toHaveCount(1);
  await expect(memberCard).toContainText("同一系列共 3 則");
  expect(await noOverflow(page)).toBe(true);
});
