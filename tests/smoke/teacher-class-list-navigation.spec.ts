import { expect, test } from "@playwright/test";

import {
  filterAndSortClassesForTab,
  isPastClass,
  isUpcomingClass,
} from "../../src/app/teacher/classes/_lib/class-list-tabs";
import {
  parseReturnContext,
  teacherClassBackLink,
} from "../../src/app/teacher/classes/_lib/return-context";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  addAuthSessionCookie,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateTime } from "./_helpers/future-dates";

// teacher-usability-redesign 票 04：我的課程分類、建立入口、詳情返回上下文（含惡意來源）。

const testEmailDomain = "teacher-class-list-navigation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedTeacher(testRunId: string, label = "owner", status: "approved" | "suspended" = "approved") {
  const email = `${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label} ${testRunId}`, status });
}

async function seedClass(teacherProfileId: string, title: string, daysFromToday: number, recurringClassSeriesId?: string) {
  const validation = validateClassSessionCreate({
    title,
    serviceType: "放鬆紓壓",
    startAt: futureDateTime(daysFromToday, "10:00"),
    endAt: futureDateTime(daysFromToday, "11:00"),
    location: "台北市列表教室",
    capacity: 8,
  });
  if (!validation.valid) throw new Error("unexpected invalid fixture");
  const created = await createClassSessionForTeacher(teacherProfileId, {
    ...validation.normalized,
    recurringClassSeriesId,
  });
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);
  return created.classSessionId;
}

test.describe("teacher class list tabs and return context (pure helpers)", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const at = (offsetMinutes: number) => new Date(now.getTime() + offsetMinutes * 60_000);

  test("time boundaries: in-progress is upcoming, endAt == now is past, drafts and cancelled stay out of both", () => {
    const inProgress = { status: "open_for_enrollment" as const, startAt: at(-30), endAt: at(30) };
    const endsNow = { status: "open_for_enrollment" as const, startAt: at(-60), endAt: at(0) };
    const oldDraft = { status: "draft" as const, startAt: at(-600), endAt: at(-540) };
    const cancelled = { status: "cancelled" as const, startAt: at(600), endAt: at(660) };
    const completedEarly = { status: "completed" as const, startAt: at(-10), endAt: at(50) };

    expect(isUpcomingClass(inProgress, now)).toBe(true);
    expect(isPastClass(inProgress, now)).toBe(false);
    expect(isUpcomingClass(endsNow, now)).toBe(false);
    expect(isPastClass(endsNow, now)).toBe(true);
    expect(isUpcomingClass(oldDraft, now) || isPastClass(oldDraft, now)).toBe(false);
    expect(isUpcomingClass(cancelled, now) || isPastClass(cancelled, now)).toBe(false);
    expect(isPastClass(completedEarly, now)).toBe(true);

    const all = [cancelled, oldDraft, endsNow, inProgress, completedEarly];
    expect(filterAndSortClassesForTab(all, "drafts", now)).toEqual([oldDraft]);
    expect(filterAndSortClassesForTab(all, "past", now)).toEqual([completedEarly, endsNow]);
    expect(filterAndSortClassesForTab(all, "all", now)).toHaveLength(5);
    expect(filterAndSortClassesForTab(all, "all", now, "cancelled")).toEqual([cancelled]);
  });

  test("return context only accepts whitelisted values and the class's own series", () => {
    expect(parseReturnContext({ from: "list", tab: "past" }, null)).toEqual({ kind: "list", tab: "past", status: null });
    expect(parseReturnContext({ from: "list", tab: "all", status: "cancelled" }, null)).toEqual({
      kind: "list",
      tab: "all",
      status: "cancelled",
    });
    // 未知分頁 → 預設；status 只在「全部」接受 cancelled。
    expect(parseReturnContext({ from: "list", tab: "javascript:alert(1)", status: "draft" }, null)).toEqual({
      kind: "list",
      tab: "upcoming",
      status: null,
    });
    // 系列只接受這堂課自己的系列。
    expect(parseReturnContext({ from: "series", series: "series-a" }, "series-a")).toEqual({
      kind: "series",
      seriesId: "series-a",
    });
    expect(parseReturnContext({ from: "series", series: "someone-else" }, "series-a")).toBeNull();
    expect(parseReturnContext({ from: "series", series: "//evil.example" }, "//evil.example")).toBeNull();
    expect(parseReturnContext({ from: "https://evil.example" }, null)).toBeNull();
    expect(parseReturnContext({ from: "/admin" }, null)).toBeNull();

    for (const context of [null, parseReturnContext({ from: "list", tab: "drafts" }, null)]) {
      expect(teacherClassBackLink(context, "abc").href).toMatch(/^\/teacher\/classes(\?|#)/);
    }
    expect(teacherClassBackLink(null, "abc").href).toBe("/teacher/classes#class-abc");
  });
});

test.describe("teacher class list navigation", () => {
  test("tabs split upcoming / drafts / past / all; a card opened from a tab returns to that tab and card, also after an action on the detail page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-tabs-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const upcomingId = await seedClass(teacher.teacherProfileId, `即將 ${testRunId}`, 20);
    const draftId = await seedClass(teacher.teacherProfileId, `草稿 ${testRunId}`, 21);
    const pastId = await seedClass(teacher.teacherProfileId, `過往 ${testRunId}`, 22);
    const cancelledId = await seedClass(teacher.teacherProfileId, `取消 ${testRunId}`, 23);
    await prisma.classSession.update({ where: { id: upcomingId }, data: { status: "open_for_enrollment" } });
    await prisma.classSession.update({
      where: { id: pastId },
      data: {
        status: "open_for_enrollment",
        startAt: new Date(Date.now() - 3 * 3600_000),
        endAt: new Date(Date.now() - 2 * 3600_000),
      },
    });
    await prisma.classSession.update({ where: { id: cancelledId }, data: { status: "cancelled" } });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes");

    const tabs = page.getByRole("navigation", { name: "課程分類" });
    await expect(tabs.getByRole("link", { name: "即將上課" })).toHaveAttribute("aria-current", "page");
    const main = page.getByRole("main");
    await expect(main.locator(`#class-${upcomingId}`)).toBeVisible();
    await expect(main.locator(`#class-${draftId}`)).toHaveCount(0);
    await expect(main.locator(`#class-${pastId}`)).toHaveCount(0);
    await expect(main.locator(`#class-${cancelledId}`)).toHaveCount(0);
    // 建立課程在頂端。
    await expect(page.getByRole("banner").getByRole("link", { name: /建立課程/ })).toHaveCount(0);
    await expect(main.locator("header").getByRole("link", { name: "＋ 建立課程" })).toBeVisible();

    await tabs.getByRole("link", { name: "過往" }).click();
    await expect(page).toHaveURL(/tab=past/);
    await expect(main.locator(`#class-${pastId}`)).toBeVisible();
    await expect(main.locator(`#class-${upcomingId}`)).toHaveCount(0);

    await tabs.getByRole("link", { name: "全部" }).click();
    for (const id of [upcomingId, draftId, pastId, cancelledId]) {
      await expect(main.locator(`#class-${id}`)).toBeVisible();
    }
    await main.getByRole("link", { name: "只看已取消" }).click();
    await expect(main.locator(`#class-${cancelledId}`)).toBeVisible();
    await expect(main.locator(`#class-${upcomingId}`)).toHaveCount(0);

    // 草稿分頁 → 詳情 → 開放報名（操作後仍在同一堂、仍記得來自草稿分頁）→ 返回。
    await tabs.getByRole("link", { name: "草稿" }).click();
    await main.locator(`#class-${draftId}`).getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${draftId}\\?from=list&tab=drafts`));
    await page.getByRole("button", { name: "開放報名" }).click();
    await expect(page.getByText("已開放報名。")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${draftId}\\?.*from=list&tab=drafts`));
    const back = page.getByRole("link", { name: "← 回我的課程" });
    await expect(back).toHaveAttribute("href", `/teacher/classes?tab=drafts#class-${draftId}`);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes\\?tab=drafts#class-${draftId}$`));
    await expect(tabs.getByRole("link", { name: "草稿" })).toHaveAttribute("aria-current", "page");

    // 直接進詳情：退路是我的課程（預設分頁），並定位到這堂課。
    await page.goto(`/teacher/classes/${upcomingId}`);
    await expect(page.getByRole("link", { name: "← 回我的課程" })).toHaveAttribute(
      "href",
      `/teacher/classes#class-${upcomingId}`,
    );

    // 惡意或不認得的來源：一律退回我的課程，不會出現外部網址。
    await page.goto(`/teacher/classes/${upcomingId}?from=series&series=${encodeURIComponent("//evil.example")}&tab=x`);
    await expect(page.getByRole("link", { name: "← 回我的課程" })).toHaveAttribute(
      "href",
      `/teacher/classes#class-${upcomingId}`,
    );
  });

  test("a session opened from its series page returns to the series; another teacher's series id in the URL is ignored", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-series-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const other = await seedTeacher(testRunId, "other");
    const makeSeries = (teacherProfileId: string, title: string) =>
      prisma.recurringClassSeries.create({
        data: {
          teacherProfileId,
          title,
          serviceType: "放鬆紓壓",
          dayOfWeek: null,
          startTime: "10:00",
          endTime: "11:00",
          location: "台北市列表教室",
          capacity: 8,
        },
        select: { id: true },
      });
    const series = await makeSeries(teacher.teacherProfileId, `我的系列 ${testRunId}`);
    const otherSeries = await makeSeries(other.teacherProfileId, `別人的系列 ${testRunId}`);
    const occurrenceId = await seedClass(teacher.teacherProfileId, `系列場次 ${testRunId}`, 30, series.id);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/series/${series.id}`);
    await page.locator(`#class-${occurrenceId}`).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${occurrenceId}\\?from=series&series=${series.id}`));
    const back = page.getByRole("link", { name: "← 回課程系列" });
    await expect(back).toHaveAttribute("href", `/teacher/classes/series/${series.id}#class-${occurrenceId}`);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}#class-${occurrenceId}$`));

    await page.goto(`/teacher/classes/${occurrenceId}?from=series&series=${otherSeries.id}`);
    await expect(page.getByRole("link", { name: "← 回課程系列" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "← 回我的課程" })).toBeVisible();
    await expect(page.getByText(`別人的系列 ${testRunId}`)).toHaveCount(0);
  });

  test("a suspended teacher sees the tabs but no create button", async ({ context, page }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspended-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId, "suspended", "suspended");

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByRole("navigation", { name: "課程分類" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /建立課程/ })).toHaveCount(0);
  });
});
