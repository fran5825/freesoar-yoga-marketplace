import { expect, test } from "@playwright/test";

import { parseClassDiscoveryFilters } from "../../src/domain/class-session/class-discovery-filters";
import { getPublicClassListEntries, type PublicClassListEntry } from "../../src/domain/class-session/public-read-service";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";

// class-discovery-series-cards 票 02：找課程把持續開課合併成一張系列卡。
const fixtures = createTermFixtures("series-cards-list-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const discovery = (params: Record<string, string> = {}) => ({ discovery: parseClassDiscoveryFilters(params).filters });
const includeFull = discovery({ includeFull: "1" });

function seriesEntry(entries: PublicClassListEntry[], seriesId: string) {
  return entries.find((entry) => entry.kind === "series" && entry.item.id === seriesId);
}

function sessionIds(entries: PublicClassListEntry[]) {
  return entries.flatMap((entry) => (entry.kind === "session" ? [entry.item.id] : []));
}

test.describe("continuous series cards (domain)", () => {
  test("N sessions of one continuous series become one series card, with none of its sessions listed alone", async ({}, testInfo) => {
    const id = runId(testInfo, "merge");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 6, title: `合併系列 ${id}` });

    const entries = await getPublicClassListEntries(discovery());
    expect(entries.filter((entry) => entry.kind === "series" && entry.item.id === series.id)).toHaveLength(1);
    expect(seriesEntry(entries, series.id)).toMatchObject({
      item: { title: `合併系列 ${id}`, nextSessionId: sessions[0].id, nextRemainingSeats: 5, nextIsFull: false, scheduleLabel: "每週三 19:00–20:00" },
    });
    for (const session of sessions) {
      expect(sessionIds(entries)).not.toContain(session.id);
    }
  });

  test("next session is the first one with space; when all are full the card is hidden unless includeFull", async ({}, testInfo) => {
    const id = runId(testInfo, "next");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, capacity: 1, title: `下一堂 ${id}` });
    expect((await createEnrollmentForUser(member.id, sessions[0].id, { notes: null })).ok).toBe(true);

    expect(seriesEntry(await getPublicClassListEntries(discovery()), series.id)).toMatchObject({ item: { nextSessionId: sessions[1].id, nextIsFull: false } });
    // 勾「包含已額滿」：最近一場，並標額滿。
    expect(seriesEntry(await getPublicClassListEntries(includeFull), series.id)).toMatchObject({ item: { nextSessionId: sessions[0].id, nextIsFull: true, nextRemainingSeats: 0 } });

    for (const session of sessions.slice(1)) {
      expect((await createEnrollmentForUser(member.id, session.id, { notes: null })).ok).toBe(true);
    }
    expect(seriesEntry(await getPublicClassListEntries(discovery()), series.id)).toBeUndefined();
    expect(seriesEntry(await getPublicClassListEntries(includeFull), series.id)).toMatchObject({ item: { nextIsFull: true } });
  });

  test("filters work per series: any matching session shows one card whose next session is the matching one", async ({}, testInfo) => {
    const id = runId(testInfo, "filter");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 4, title: `篩選系列 ${id}` });
    await prisma.classSession.update({ where: { id: sessions[2].id }, data: { location: `高雄專屬地點${id}` } });

    const matched = await getPublicClassListEntries(discovery({ location: `高雄專屬地點${id}` }));
    expect(matched.filter((entry) => entry.kind === "series" && entry.item.id === series.id)).toHaveLength(1);
    expect(seriesEntry(matched, series.id)).toMatchObject({ item: { nextSessionId: sessions[2].id, location: `高雄專屬地點${id}` } });
    expect(seriesEntry(await getPublicClassListEntries(discovery({ location: `沒有這個地點${id}` })), series.id)).toBeUndefined();
  });

  test("a series with one session left stays a series card; a session without a series stays a single card", async ({}, testInfo) => {
    const id = runId(testInfo, "one");
    const teacher = await seedTeacher(id);
    const lone = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `只剩一堂 ${id}` });
    const single = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `單堂 ${id}`, dayOfWeek: 5 });
    await prisma.classSession.update({ where: { id: single.sessions[0].id }, data: { recurringClassSeriesId: null } });

    const entries = await getPublicClassListEntries(discovery());
    expect(seriesEntry(entries, lone.series.id)).toMatchObject({ item: { nextSessionId: lone.sessions[0].id } });
    expect(sessionIds(entries)).toContain(single.sessions[0].id);
    expect(sessionIds(entries)).not.toContain(lone.sessions[0].id);
  });

  test("a term stays one term card, and cards are ordered by next date", async ({}, testInfo) => {
    const id = runId(testInfo, "order");
    const teacher = await seedTeacher(id);
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, title: `期班 ${id}` });
    const a = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `系列A ${id}`, dayOfWeek: 1 });
    const b = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `系列B ${id}`, dayOfWeek: 6 });

    const entries = await getPublicClassListEntries(discovery());
    expect(entries.filter((entry) => entry.kind === "term" && entry.item.id === term.series.id)).toHaveLength(1);
    const starts = entries.map((entry) => (entry.kind === "session" ? entry.item.startAt : entry.item.nextStartAt).getTime());
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
    expect(seriesEntry(entries, a.series.id)).toBeDefined();
    expect(seriesEntry(entries, b.series.id)).toBeDefined();
  });
});

test.describe("continuous series cards (UI)", () => {
  test("找課程 shows one card per series, links to the series page, and counts cards in the heading", async ({ page }, testInfo) => {
    const id = runId(testInfo, "ui");
    const teacher = await seedTeacher(id);
    const { series } = await seedContinuous(teacher.teacherProfileId, { count: 5, title: `卡片系列 ${id}` });

    await page.goto(`/classes?location=${encodeURIComponent("台北市持續教室")}`);
    const cards = page.getByRole("link", { name: new RegExp(`卡片系列 ${id}`) });
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText("每週三 19:00–20:00");
    await expect(cards).toContainText("下一個有名額");
    await expect(cards).not.toContainText("查看課程");
    const total = await page.getByRole("link").filter({ has: page.locator("h2") }).count();
    await expect(page.getByRole("status")).toContainText(`找到 ${total} 個還有名額的課程`);

    await cards.click();
    await expect(page).toHaveURL(new RegExp(`/classes/series/${series.id}`));
    await expect(page.getByRole("heading", { level: 1, name: `卡片系列 ${id}` })).toBeVisible();
  });

  // 票 03：單堂卡與期班卡精簡，三種卡長得一致。
  test("single and term cards drop the repeated lines and show availability as one line", async ({ page }, testInfo) => {
    const id = runId(testInfo, "simple");
    const teacher = await seedTeacher(id);
    const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, title: `精簡期班 ${id}` });
    const single = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `精簡單堂 ${id}`, dayOfWeek: 5 });
    await prisma.classSession.update({ where: { id: single.sessions[0].id }, data: { recurringClassSeriesId: null } });

    await page.goto("/classes?includeFull=1");
    const termCard = page.getByRole("link", { name: new RegExp(`精簡期班 ${id}`) });
    const singleCard = page.getByRole("link", { name: new RegExp(`精簡單堂 ${id}`) });
    await expect(termCard).toHaveCount(1);
    await expect(singleCard).toHaveCount(1);
    for (const card of [termCard, singleCard]) {
      await expect(card).not.toContainText("查看課程");
      await expect(card).not.toContainText("查看期班");
      await expect(card).not.toContainText("確認送出後成立報名");
      await expect(card).not.toContainText("開放報名");
    }
    await expect(termCard).toContainText("期班・共 3 堂・剩 3 堂");
    await expect(termCard).toContainText("下一堂");
    await expect(singleCard).toContainText("剩 5 個名額");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await termCard.click();
    await expect(page).toHaveURL(new RegExp(`/classes/terms/${term.series.id}`));
    await page.goBack();
    await singleCard.click();
    await expect(page).toHaveURL(new RegExp(`/classes/${single.sessions[0].id}`));
  });
});
