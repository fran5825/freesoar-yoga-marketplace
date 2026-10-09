import { expect, test } from "@playwright/test";

import { futureWeekdayDateString } from "./_helpers/future-dates";
import { addMakeupSessionForTeacher } from "../../src/domain/class-session/__internal__/add-makeup-session-core";
import { getPublicClassListEntries } from "../../src/domain/class-session/public-read-service";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-class-scheduling 票 12：學員端期班與同系列場次呈現。
const fixtures = createTermFixtures("term-member-display-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

function termEntry(entries: Awaited<ReturnType<typeof getPublicClassListEntries>>, seriesId: string) {
  return entries.find((entry) => entry.kind === "term" && entry.item.id === seriesId);
}

test.describe("public term card (domain)", () => {
  test("a public term shows as one card; a weekday filter matching only the makeup still shows the full counts", async ({}, testInfo) => {
    const id = runId(testInfo, "card");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, title: `公開期班 ${id}` });
    expect((await addMakeupSessionForTeacher(teacher.teacherProfileId, series.id, futureWeekdayDateString(200, 4))).ok).toBe(true);

    const all = await getPublicClassListEntries();
    expect(termEntry(all, series.id)).toMatchObject({ kind: "term", item: { totalCount: 4, remainingCount: 4, canEnroll: true } });
    const sessionIds = all.flatMap((entry) => (entry.kind === "session" ? [entry.item.id] : []));
    for (const session of sessions) {
      expect(sessionIds).not.toContain(session.id);
    }

    const thursdayOnly = await getPublicClassListEntries({ dayOfWeek: 4 });
    expect(termEntry(thursdayOnly, series.id)).toMatchObject({ item: { totalCount: 4 } });
  });

  test("availability follows the enrollment mode: term_only with one full class is not enrollable, term_and_single still is", async ({}, testInfo) => {
    const id = runId(testInfo, "availability");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const termOnly = await seedTerm(teacher.teacherProfileId, { isPublic: true, capacity: 1, mode: "term_only", title: `只收整期 ${id}` });
    const mixed = await seedTerm(teacher.teacherProfileId, { isPublic: true, capacity: 1, mode: "term_and_single", title: `都收 ${id}` });
    // 只收整期：用整期報名把每一堂坐滿；都收：單堂坐滿第一堂。
    expect((await createSeriesEnrollmentForUser(member.id, termOnly.series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);
    expect((await createEnrollmentForUser(member.id, mixed.sessions[0].id, { notes: null })).ok).toBe(true);

    const available = await getPublicClassListEntries({ availableOnly: true });
    expect(termEntry(available, termOnly.series.id)).toBeUndefined();
    expect(termEntry(available, mixed.series.id)).toMatchObject({ item: { canEnroll: true } });

    const everything = await getPublicClassListEntries();
    expect(termEntry(everything, termOnly.series.id)).toMatchObject({ item: { canEnroll: false } });
  });
});

test.describe("member term display (UI)", () => {
  test("找課程 shows one term card linking to the term page", async ({ page }, testInfo) => {
    const id = runId(testInfo, "ui-card");
    const teacher = await seedTeacher(id);
    const { series } = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, title: `卡片期班 ${id}` });

    await page.goto("/classes?includeFull=1");
    const card = page.getByRole("link", { name: new RegExp(`卡片期班 ${id}`) });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("期班・共 3 堂・剩 3 堂");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/classes/terms/${series.id}`));
  });

  test("我的報名 merges a term into one card", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-mine");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui-mine");
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, title: `我的期班 ${id}` });
    expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto("/member/enrollments");
    const section = page.getByRole("region", { name: "整期報名" });
    await expect(section.getByRole("article")).toHaveCount(1);
    await expect(section).toContainText("整期・接下來 3 堂");
    await section.getByText("查看每一堂").click();
    await expect(section.getByRole("list", { name: `我的期班 ${id} 的每一堂` }).getByRole("listitem")).toHaveCount(3);
    await expect(page.locator('article[id^="enrollment-"]')).toHaveCount(0);
  });

  test("a class page lists the series' other visible classes without drafts or private ones for visitors", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-siblings");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui-siblings");
    const { sessions } = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 4, title: `同系列 ${id}` });
    await prisma.classSession.update({ where: { id: sessions[2].id }, data: { status: "draft" } });
    await prisma.classSession.update({ where: { id: sessions[3].id }, data: { isPublic: false } });

    await page.goto(`/classes/${sessions[0].id}`);
    const visitorList = page.getByRole("list", { name: "同系列的其他場次" }).getByRole("link");
    await expect(visitorList).toHaveCount(1);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.reload();
    await expect(page.getByRole("list", { name: "同系列的其他場次" }).getByRole("link")).toHaveCount(2);
  });
});
