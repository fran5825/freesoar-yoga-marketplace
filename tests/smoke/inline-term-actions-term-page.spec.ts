import { expect, test } from "@playwright/test";

import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// inline-member-actions 票 02：期班頁「查看每一堂」每一列就地請假、取消請假；退出整期用同一個就地元件（spec I3）。
const fixtures = createTermFixtures("inline-term-page-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

type Mode = "term_only" | "term_and_single";

async function seedJoined(label: string, testInfo: Parameters<typeof runId>[0], mode: Mode = "term_and_single") {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, mode, title: `期班就地 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });

  return { teacher, member, term, joined, rows };
}

test("a term member takes leave and cancels it from the row; the list stays open on that row", async ({ context, page }, testInfo) => {
  const { member, term, rows } = await seedJoined("flow", testInfo);
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/terms/${term.series.id}`);
  await expect(page.getByText("某一堂不能來，到「查看每一堂」按那一堂的「請假」，其他堂照常。")).toBeVisible();
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  const row = page.locator(`#session-row-${rows[1].id}`);
  await row.getByText("請假", { exact: true }).click();
  await expect(row.getByText("請假後，這一堂的名額會開放給單堂報名；整期的其他堂照常。開課前、名額還在時可以取消請假。")).toBeVisible();
  await row.getByLabel("我確認這一堂要請假。").check();
  await row.getByRole("button", { name: "確認請假" }).click();

  await expect(page).toHaveURL(new RegExp(`focus=session-row-${rows[1].id}`));
  await expect(page.locator("#action-feedback")).toContainText("已請假這一堂，整期的其他堂照常。");
  await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("請假中");
  await expect(page.locator(`#session-row-${rows[1].id}`)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator(`#session-row-${rows[1].id}`).getByRole("button", { name: "取消請假" }).click();
  await expect(page.locator("#action-feedback")).toContainText("已取消請假，這一堂照常上課。");
  await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("已報名");
  expect(await prisma.enrollment.findUniqueOrThrow({ where: { id: rows[1].id }, select: { status: true, cancelledBy: true } })).toEqual({ status: "confirmed", cancelledBy: null });
});

test("term_only shows the keep-the-seat wording on the row", async ({ context, page }, testInfo) => {
  const { member, term, rows } = await seedJoined("only", testInfo, "term_only");
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/terms/${term.series.id}`);
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  const row = page.locator(`#session-row-${rows[0].id}`);
  await row.getByText("請假", { exact: true }).click();
  await expect(row.getByText("請假後，這一堂會標示為請假；整期的其他堂照常。開課前可以取消請假。")).toBeVisible();
});

test("withdrawing from the term page uses the inline control and leaves no row buttons", async ({ context, page }, testInfo) => {
  const { member, term, joined, rows } = await seedJoined("withdraw", testInfo);
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/terms/${term.series.id}`);
  await page.getByText("退出整期…").click();
  await expect(page.getByText("會取消之後的 3 堂：")).toBeVisible();
  await page.getByLabel("我確認要退出這一期。").check();
  await page.getByRole("button", { name: "確認退出整期" }).click();

  await expect(page.locator("#action-feedback")).toContainText("已退出整期，取消了之後的 3 堂。");
  expect((await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: joined.seriesEnrollmentId } })).status).toBe("withdrawn");
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  await expect(page.locator(`#session-row-${rows[0].id}`).getByRole("button")).toHaveCount(0);
});

test("a visitor and a non-member see no row buttons", async ({ context, page }, testInfo) => {
  const { term } = await seedJoined("visitor", testInfo);

  await page.goto(`/classes/terms/${term.series.id}`);
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  await expect(page.getByRole("list", { name: "這一期的上課日期" }).getByRole("button")).toHaveCount(0);

  const stranger = await seedMember(runId(testInfo, "visitor-x"), "x");
  await addAuthSessionCookie(context, stranger.sessionToken);
  await page.goto(`/classes/terms/${term.series.id}`);
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  await expect(page.getByRole("list", { name: "這一期的上課日期" }).getByRole("button")).toHaveCount(0);
});
