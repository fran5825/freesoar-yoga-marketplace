import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// inline-member-actions 票 03：單堂頁第一張卡放狀態與動作、同系列列表整期學員自己的列有請假按鈕、持續開課改成系列頁連結（spec I4、I6、I8）。
const fixtures = createTermFixtures("inline-class-page-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const noOverflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("an enrolled member has no separate status card: status and actions live in the first card", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "first-card");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `首卡單堂 ${id}` });
  const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
  if (!created.ok) throw new Error("fixture");
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/${sessions[0].id}`);
  await expect(page.getByRole("region", { name: "你的報名狀態" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "報名這堂課程" })).toHaveCount(0);
  const card = page.getByRole("region", { name: "課程重點" });
  await expect(card).toContainText("已報名");
  await expect(card).toContainText("報名已成立，請依課程時間與地點準時參加。");
  await card.getByText("取消報名…").click();
  await card.getByLabel("我確認要取消這則報名。").check();
  await card.getByRole("button", { name: "確認取消" }).click();
  await expect(page.getByText("報名已取消。")).toBeVisible();
  await expect(card).toContainText("已取消");
  await expect(card).toContainText("可以重新報名");
  expect(await noOverflow(page)).toBe(true);
});

test("term sibling list: the member's own rows show a status and leave / cancel-leave, in place", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "siblings");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, mode: "term_and_single", title: `同系列期班 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/${term.sessions[0].id}`);
  const list = page.getByRole("list", { name: "同系列的其他場次" });
  const row = list.locator(`#session-row-${rows[1].id}`);
  await expect(row).toContainText("已報名");
  await row.getByText("請假", { exact: true }).click();
  await row.getByLabel("我確認這一堂要請假。").check();
  await row.getByRole("button", { name: "確認請假" }).click();

  await expect(page).toHaveURL(new RegExp(`focus=session-row-${rows[1].id}`));
  await expect(page.locator("#action-feedback")).toContainText("已請假這一堂，整期的其他堂照常。");
  await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("請假中");
  await page.locator(`#session-row-${rows[1].id}`).getByRole("button", { name: "取消請假" }).click();
  await expect(page.locator("#action-feedback")).toContainText("已取消請假，這一堂照常上課。");
  await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("已報名");
  expect(await noOverflow(page)).toBe(true);

  // 這一堂自己的請假在第一張卡。
  const card = page.getByRole("region", { name: "課程重點" });
  await card.getByText("請假", { exact: true }).click();
  await card.getByLabel("我確認這一堂要請假。").check();
  await card.getByRole("button", { name: "確認請假" }).click();
  await expect(card).toContainText("請假中");
  await expect(card.getByRole("button", { name: "取消請假" })).toBeVisible();
});

test("a visitor and a non-member see the term siblings as plain dates", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "plain");
  const teacher = await seedTeacher(id);
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, mode: "term_and_single", title: `素日期期班 ${id}` });

  await page.goto(`/classes/${term.sessions[0].id}`);
  const list = page.getByRole("list", { name: "同系列的其他場次" });
  await expect(list.getByRole("link")).toHaveCount(2);
  await expect(list.getByRole("button")).toHaveCount(0);

  const stranger = await seedMember(runId(testInfo, "plain-x"), "x");
  await addAuthSessionCookie(context, stranger.sessionToken);
  await page.goto(`/classes/${term.sessions[0].id}`);
  await expect(page.getByRole("list", { name: "同系列的其他場次" }).getByRole("button")).toHaveCount(0);
});

test.describe("continuous series: the sibling card becomes a link to the series page only when every date is reachable there", () => {
  test("a public series shows the link instead of the list", async ({ page }, testInfo) => {
    const id = runId(testInfo, "link");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `連結系列 ${id}` });

    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("list", { name: "同系列的其他場次" })).toHaveCount(0);
    const link = page.getByRole("region", { name: "課程重點" }).getByRole("link", { name: "查看這個課程的所有日期" });
    await expect(link).toHaveAttribute("href", `/classes/series/${series.id}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/classes/series/${series.id}`));
    await expect(page.getByRole("heading", { level: 1, name: `連結系列 ${id}` })).toBeVisible();
  });

  test("a private series keeps the date list for a signed-in member", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "private");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, isPublic: false, title: `私人系列 ${id}` });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("list", { name: "同系列的其他場次" }).getByRole("link")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "查看這個課程的所有日期" })).toHaveCount(0);
  });

  test("a mixed series keeps the list for a signed-in member (a private date would lose its entry) but gives a visitor the link", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "mixed");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `混合系列 ${id}` });
    await prisma.classSession.update({ where: { id: sessions[2].id }, data: { isPublic: false } });

    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("link", { name: "查看這個課程的所有日期" })).toBeVisible();

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("list", { name: "同系列的其他場次" }).getByRole("link")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "查看這個課程的所有日期" })).toHaveCount(0);
  });

  test("when the series page is not available (teacher not approved) the list stays", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "gone");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `暫停系列 ${id}` });
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("link", { name: "查看這個課程的所有日期" })).toHaveCount(0);
  });
});
