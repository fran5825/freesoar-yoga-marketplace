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
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateTime } from "./_helpers/future-dates";

// teacher-usability-redesign 票 04：我的課程分類、建立入口、詳情返回上下文（含惡意來源）。
// 票 05：系列頁逐場人數、跨老師隔離、系列 → 單堂 → 返回、整系列取消先確認。
// 票 07：暫停老師的導覽有「我的課程」，只能查看，不能建課或看需求池。

const testEmailDomain = "teacher-class-list-navigation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedTeacher(
  testRunId: string,
  label = "owner",
  status: "approved" | "suspended" | "draft" | "submitted" | "rejected" = "approved",
) {
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

test.describe("teacher series management (ticket 05)", () => {
  test("each session shows its own counts; handling an enrollment from the series returns with updated counts; cancelling the series lists the real impact and writes nothing until confirmed", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-series-mgmt-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId);
    const other = await seedTeacher(testRunId, "other");
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: `系列管理 ${testRunId}`,
        serviceType: "放鬆紓壓",
        dayOfWeek: null,
        startTime: "10:00",
        endTime: "11:00",
        location: "台北市系列教室",
        capacity: 8,
        requiresApproval: true,
      },
      select: { id: true },
    });
    const otherSeries = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: other.teacherProfileId,
        title: `別人的系列 ${testRunId}`,
        dayOfWeek: null,
        startTime: "10:00",
        endTime: "11:00",
        location: "別人的教室",
        capacity: 8,
      },
      select: { id: true },
    });
    const openId = await seedClass(teacher.teacherProfileId, `場次A ${testRunId}`, 40, series.id);
    const draftId = await seedClass(teacher.teacherProfileId, `場次B ${testRunId}`, 47, series.id);
    const doneId = await seedClass(teacher.teacherProfileId, `場次C ${testRunId}`, 54, series.id);
    await prisma.classSession.update({ where: { id: openId }, data: { status: "open_for_enrollment" } });
    await prisma.classSession.update({
      where: { id: doneId },
      data: {
        status: "completed",
        startAt: new Date(Date.now() - 26 * 3600_000),
        endAt: new Date(Date.now() - 25 * 3600_000),
      },
    });
    const enroll = async (label: string, classSessionId: string, status: "confirmed" | "pending") => {
      const email = `member-${label}-${testRunId}@${testEmailDomain}`;
      createdEmails.push(email);
      const { userId } = await createUserSession({ email });
      await prisma.enrollment.create({
        data: { userId, classSessionId, status, consentedAt: new Date(), notes: `備註${label}` },
      });
      return userId;
    };
    await enroll("a1", openId, "confirmed");
    await enroll("a2", openId, "pending");
    await enroll("a3", openId, "pending");
    await enroll("c1", doneId, "confirmed");

    await addAuthSessionCookie(context, teacher.sessionToken);

    // 別人的系列：看不到。
    const otherResponse = await page.goto(`/teacher/classes/series/${otherSeries.id}`);
    expect(otherResponse?.status()).toBe(404);

    await page.goto(`/teacher/classes/series/${series.id}`);
    await expect(page.getByText("系列場次不會列在公開課程列表")).toBeVisible();
    await expect(page.locator(`#class-${openId}`)).toContainText("已報名 1 / 8 人");
    await expect(page.locator(`#class-${openId}`)).toContainText("待確認 2 人");
    await expect(page.locator(`#class-${draftId}`)).toContainText("已報名 0 / 8 人");
    await expect(page.locator(`#class-${draftId}`)).not.toContainText("待確認");
    await expect(page.locator(`#class-${doneId}`)).toContainText("已完成");
    await expect(page.locator(`#class-${doneId}`)).toContainText("已報名 1 / 8 人");
    // 開放報名的場次可以複製報名連結；草稿、已完成的場次沒有。
    await expect(page.locator(`#class-${openId}`).getByRole("button", { name: /的報名連結$/ })).toBeVisible();
    await expect(page.locator(`#class-${draftId}`).getByRole("button")).toHaveCount(0);
    await expect(page.locator(`#class-${doneId}`).getByRole("button")).toHaveCount(0);

    // 系列 → 場次 A → 確認一筆 → 返回系列，人數已更新。
    await page.locator(`#class-${openId}`).getByRole("link").click();
    await page.locator("li").filter({ hasText: "備註a2" }).getByRole("button", { name: "確認報名" }).click();
    await expect(page.getByText("已確認這筆報名。")).toBeVisible();
    await page.getByRole("link", { name: "← 回課程系列" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}#class-${openId}$`));
    await expect(page.locator(`#class-${openId}`)).toContainText("已報名 2 / 8 人");
    await expect(page.locator(`#class-${openId}`)).toContainText("待確認 1 人");

    // 取消整個系列：視窗只列尚未開始的 A、B 與連帶報名；Escape 不寫入。
    await page.getByRole("button", { name: "取消整個系列（僅影響尚未開始的場次）" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("list", { name: "會被取消的場次" }).getByRole("listitem")).toHaveCount(2);
    await expect(dialog).toContainText("已報名 2 筆、待確認 1 筆");
    await expect(dialog).toContainText("系列本身會保留");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(
      await prisma.classSession.count({ where: { recurringClassSeriesId: series.id, status: "cancelled" } }),
    ).toBe(0);

    await page.getByRole("button", { name: "取消整個系列（僅影響尚未開始的場次）" }).click();
    await dialog.getByRole("button", { name: "確定取消 2 場" }).click();
    await expect(page.getByText("已取消 2 場尚未開始的課程。")).toBeVisible();
    const states = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
      select: { id: true, status: true },
    });
    expect(Object.fromEntries(states.map((item) => [item.id, item.status]))).toEqual({
      [doneId]: "completed",
      [openId]: "cancelled",
      [draftId]: "cancelled",
    });
    expect(
      await prisma.enrollment.count({ where: { classSessionId: openId, status: { in: ["confirmed", "pending"] } } }),
    ).toBe(0);
    // 系列本身還在。
    expect(await prisma.recurringClassSeries.count({ where: { id: series.id } })).toBe(1);
  });
});

test.describe("suspended teacher navigation (ticket 07)", () => {
  async function teacherNav(page: import("@playwright/test").Page) {
    const menuButton = page.getByRole("button", { name: "選單" });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    return page.getByRole("navigation", { name: "老師專區導覽" });
  }

  test("only approved and suspended teachers get the 我的課程 entry; a suspended teacher can read own classes but still cannot create or browse demands", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-nav-${Date.now()}`,
    );

    for (const status of ["draft", "submitted", "rejected"] as const) {
      const teacher = await seedTeacher(testRunId, status, status);
      await context.clearCookies();
      await addAuthSessionCookie(context, teacher.sessionToken);
      await page.goto("/teacher/dashboard");
      const nav = await teacherNav(page);
      await expect(nav.getByRole("link", { name: "總覽" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "我的課程" })).toHaveCount(0);
    }

    const approved = await seedTeacher(testRunId, "approved-nav");
    await context.clearCookies();
    await addAuthSessionCookie(context, approved.sessionToken);
    await page.goto("/teacher/dashboard");
    let nav = await teacherNav(page);
    await expect(nav.getByRole("link", { name: "我的課程" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "需求池" })).toBeVisible();

    // 先以審核通過的身分開課，再暫停（暫停後不能開新課）。
    const suspended = await seedTeacher(testRunId, "suspended-nav");
    const ownClassId = await seedClass(suspended.teacherProfileId, `暫停前的課 ${testRunId}`, 60);
    await prisma.teacherProfile.update({
      where: { id: suspended.teacherProfileId },
      data: { status: "suspended" },
    });
    const otherClassId = await seedClass(approved.teacherProfileId, `別人的課 ${testRunId}`, 61);
    await context.clearCookies();
    await addAuthSessionCookie(context, suspended.sessionToken);
    await page.goto("/teacher/dashboard");
    nav = await teacherNav(page);
    await expect(nav.getByRole("link", { name: "需求池" })).toHaveCount(0);
    await nav.getByRole("link", { name: "我的課程" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes$/);
    await expect(page.getByText("老師資格目前暫停中")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /建立課程/ })).toHaveCount(0);

    // 本人既有課程可讀；別人的課仍 404；直接進建課頁仍被原守門擋下。
    const own = await page.goto(`/teacher/classes/${ownClassId}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: `暫停前的課 ${testRunId}` })).toBeVisible();
    const other = await page.goto(`/teacher/classes/${otherClassId}`);
    expect(other?.status()).toBe(404);
    await page.goto("/teacher/classes/new");
    await expect(page.getByRole("heading", { name: "老師資格已暫停" })).toBeVisible();
    await expect(page.getByRole("button", { name: "建立課程" })).toHaveCount(0);
  });
});
