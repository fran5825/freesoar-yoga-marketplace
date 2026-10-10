import { expect, test, type Page } from "@playwright/test";

import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// inline-member-actions 票 05：整期學員的完整旅程驗收（桌面與手機都跑）——
// 三處就地請假與取消請假（我的報名、期班頁、單堂頁）、兩處就地退出整期（我的報名、期班頁），
// 每個展開畫面都不橫向溢出；請假與取消請假成功後保持展開並捲到該列，失敗時捲到可見的失敗原因。
const fixtures = createTermFixtures("inline-actions-acceptance-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function seedJoined(label: string, testInfo: Parameters<typeof runId>[0]) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 4, mode: "term_and_single", title: `驗收整期 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });

  return { member, term, joined, rows };
}

test("leave and cancel-leave work in place on all three pages, and every expanded form fits the screen", async ({ context, page }, testInfo) => {
  const { member, term, rows } = await seedJoined("three", testInfo);
  await addAuthSessionCookie(context, member.sessionToken);
  const statusOf = async (id: string) => (await prisma.enrollment.findUniqueOrThrow({ where: { id } })).status;

  // 1. 我的報名
  await page.goto("/member/enrollments");
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  let row = page.locator(`#session-row-${rows[0].id}`);
  await row.getByText("請假", { exact: true }).click();
  expect(await fits(page)).toBe(true);
  await row.getByLabel("我確認這一堂要請假。").check();
  await row.getByRole("button", { name: "確認請假" }).click();
  await expect(page.locator(`#session-row-${rows[0].id}`)).toContainText("請假中");
  await page.locator(`#session-row-${rows[0].id}`).getByRole("button", { name: "取消請假" }).click();
  await expect(page.locator(`#session-row-${rows[0].id}`)).toContainText("已報名");
  expect(await statusOf(rows[0].id)).toBe("confirmed");

  // 2. 期班頁
  await page.goto(`/classes/terms/${term.series.id}`);
  await page.locator("summary", { hasText: "查看每一堂" }).click();
  row = page.locator(`#session-row-${rows[1].id}`);
  await row.getByText("請假", { exact: true }).click();
  expect(await fits(page)).toBe(true);
  await row.getByLabel("我確認這一堂要請假。").check();
  await row.getByRole("button", { name: "確認請假" }).click();
  await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("請假中");
  await page.locator(`#session-row-${rows[1].id}`).getByRole("button", { name: "取消請假" }).click();
  await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("已報名");
  expect(await statusOf(rows[1].id)).toBe("confirmed");

  // 3. 單堂頁（同系列列表）
  await page.goto(`/classes/${term.sessions[0].id}`);
  row = page.getByRole("list", { name: "同系列的其他場次" }).locator(`#session-row-${rows[2].id}`);
  await row.getByText("請假", { exact: true }).click();
  expect(await fits(page)).toBe(true);
  await row.getByLabel("我確認這一堂要請假。").check();
  await row.getByRole("button", { name: "確認請假" }).click();
  await expect(page.locator(`#session-row-${rows[2].id}`)).toContainText("請假中");
  await page.locator(`#session-row-${rows[2].id}`).getByRole("button", { name: "取消請假" }).click();
  await expect(page.locator(`#session-row-${rows[2].id}`)).toContainText("已報名");
  expect(await statusOf(rows[2].id)).toBe("confirmed");
  expect(await fits(page)).toBe(true);
});

test("withdraw in place from the my-enrollments card and from the term page", async ({ context, page }, testInfo) => {
  const first = await seedJoined("withdraw-a", testInfo);
  await addAuthSessionCookie(context, first.member.sessionToken);

  await page.goto("/member/enrollments");
  await page.getByText("退出整期…").click();
  expect(await fits(page)).toBe(true);
  await page.getByLabel("我確認要退出這一期。").check();
  await page.getByRole("button", { name: "確認退出整期" }).click();
  await expect(page.locator("#action-feedback")).toContainText("已退出整期");
  expect((await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: first.joined.seriesEnrollmentId } })).status).toBe("withdrawn");

  const second = await seedJoined("withdraw-b", testInfo);
  await context.clearCookies();
  await addAuthSessionCookie(context, second.member.sessionToken);
  await page.goto(`/classes/terms/${second.term.series.id}`);
  await page.getByText("退出整期…").click();
  expect(await fits(page)).toBe(true);
  await page.getByLabel("我確認要退出這一期。").check();
  await page.getByRole("button", { name: "確認退出整期" }).click();
  await expect(page.locator("#action-feedback")).toContainText("已退出整期");
  expect((await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: second.joined.seriesEnrollmentId } })).status).toBe("withdrawn");
});
