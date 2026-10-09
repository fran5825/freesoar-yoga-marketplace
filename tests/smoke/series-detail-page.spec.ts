import { expect, test } from "@playwright/test";

import { getPublicSeriesDetail, parseSeriesShow } from "../../src/domain/class-session/public-read-service";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";

// class-discovery-series-cards 票 01：持續開課的系列詳細頁。
const fixtures = createTermFixtures("series-detail-page-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

test.describe("getPublicSeriesDetail (domain)", () => {
  test("show parameter: invalid values fall back to 8, large values are capped at 200", () => {
    for (const value of [undefined, "", "0", "-3", "abc", "1.5", "8e2", ["x"]]) {
      expect(parseSeriesShow(value)).toBe(8);
    }
    expect(parseSeriesShow("16")).toBe(16);
    expect(parseSeriesShow(["24", "8"])).toBe(24);
    expect(parseSeriesShow("999")).toBe(200);
  });

  test("paginates by taking the first N sessions without repeats or gaps, and reports hasMore", async ({}, testInfo) => {
    const id = runId(testInfo, "page");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 10, title: `分頁系列 ${id}` });

    const first = await getPublicSeriesDetail(series.id);
    expect(first?.sessions.map((row) => row.id)).toEqual(sessions.slice(0, 8).map((row) => row.id));
    expect(first).toMatchObject({ show: 8, hasMore: true, capped: false, title: `分頁系列 ${id}` });

    const second = await getPublicSeriesDetail(series.id, { show: 16 });
    expect(second?.sessions.map((row) => row.id)).toEqual(sessions.map((row) => row.id));
    expect(second).toMatchObject({ hasMore: false, capped: false });
  });

  test("not-found semantics: unknown id, term series, private series and suspended teacher all return null", async ({}, testInfo) => {
    const id = runId(testInfo, "hidden");
    const teacher = await seedTeacher(id);
    const suspended = await seedTeacher(`${id}s`);
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, title: `期班 ${id}` });
    const hidden = await seedContinuous(teacher.teacherProfileId, { isPublic: false, title: `未公開 ${id}` });
    const gone = await seedContinuous(suspended.teacherProfileId, { title: `暫停老師 ${id}` });
    expect(await getPublicSeriesDetail(gone.series.id)).not.toBeNull();
    await prisma.teacherProfile.update({ where: { id: suspended.teacherProfileId }, data: { status: "suspended" } });

    expect(await getPublicSeriesDetail("does-not-exist")).toBeNull();
    expect(await getPublicSeriesDetail(term.series.id)).toBeNull();
    expect(await getPublicSeriesDetail(hidden.series.id)).toBeNull();
    expect(await getPublicSeriesDetail(gone.series.id)).toBeNull();
  });

  test("header comes from the first session with space; rows keep their own seats, time and location", async ({}, testInfo) => {
    const id = runId(testInfo, "mixed");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 4, capacity: 1, title: `混合設定 ${id}` });
    // 第一場坐滿；第二場（標頭）改成新標題與地點；第四場改時間。
    expect((await createEnrollmentForUser(member.id, sessions[0].id, { notes: null })).ok).toBe(true);
    await prisma.classSession.update({ where: { id: sessions[1].id }, data: { title: `新標題 ${id}`, location: "高雄新教室" } });
    await prisma.classSession.update({
      where: { id: sessions[3].id },
      data: { startAt: new Date(sessions[3].startAt.getTime() + 3_600_000), endAt: new Date(sessions[3].endAt.getTime() + 3_600_000), location: "高雄新教室" },
    });

    const detail = await getPublicSeriesDetail(series.id);
    expect(detail).toMatchObject({ title: `新標題 ${id}`, location: "高雄新教室", headerSessionId: sessions[1].id, headerIsFull: false });
    const [first, second, third, fourth] = detail?.sessions ?? [];
    expect(first).toMatchObject({ id: sessions[0].id, state: "full", remainingSeats: 0, locationNote: "台北市持續教室" });
    expect(second).toMatchObject({ state: "open", remainingSeats: 1, locationNote: null, timeNote: null });
    expect(third).toMatchObject({ locationNote: "台北市持續教室" });
    expect(fourth).toMatchObject({ locationNote: null, timeNote: "20:00–21:00" });
  });

  test("when every session is full the header uses the nearest session and is marked full", async ({}, testInfo) => {
    const id = runId(testInfo, "allfull");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, capacity: 1, title: `全額滿 ${id}` });
    for (const session of sessions) {
      expect((await createEnrollmentForUser(member.id, session.id, { notes: null })).ok).toBe(true);
    }

    expect(await getPublicSeriesDetail(series.id)).toMatchObject({ headerSessionId: sessions[0].id, headerIsFull: true });
  });
});

test.describe("series page (UI)", () => {
  test("a visitor sees info and 8 dates, loads more, and opens a single session", async ({ page }, testInfo) => {
    const id = runId(testInfo, "ui");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 10, title: `系列頁 ${id}` });

    await page.goto(`/classes/series/${series.id}`);
    await expect(page.getByRole("heading", { level: 1, name: `系列頁 ${id}` })).toBeVisible();
    await expect(page.getByText("每週三 19:00–20:00")).toBeVisible();
    await expect(page.getByText("台北市持續教室").first()).toBeVisible();
    await expect(page.getByText("系列說明文字")).toBeVisible();
    await expect(page.getByText("帶毛巾")).toBeVisible();
    await expect(page.getByRole("button", { name: /整期/ })).toHaveCount(0);
    const list = page.getByRole("list", { name: "可報名的上課日期" });
    await expect(list.getByRole("listitem")).toHaveCount(8);

    await page.getByRole("link", { name: "看更多日期" }).click();
    await expect(page).toHaveURL(/show=16/);
    await expect(list.getByRole("listitem")).toHaveCount(10);
    await expect(page.getByRole("link", { name: "看更多日期" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await list.getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/classes/${sessions[0].id}`));
  });

  test("a term id and an unknown id show the not-found page", async ({ page }, testInfo) => {
    const id = runId(testInfo, "ui404");
    const teacher = await seedTeacher(id);
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, title: `期班 ${id}` });

    expect((await page.goto(`/classes/series/${term.series.id}`))?.status()).toBe(404);
    expect((await page.goto("/classes/series/does-not-exist"))?.status()).toBe(404);
  });
});
