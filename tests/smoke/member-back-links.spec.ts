import { expect, test } from "@playwright/test";

import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// 學員端返回連結：返回 = 上一層來源，文字跟目的地一致（plan 2026-10-10-member-back-links）。
const fixtures = createTermFixtures("member-back-links-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

test("我的報名 → 期班頁 → 返回我的報名；期班頁 → 某一堂 → 返回期班 → 返回我的報名", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "from-enrollments");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, title: `返回測試 ${id}` });
  expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);

  await addAuthSessionCookie(context, member.sessionToken);
  await page.goto("/member/enrollments");
  await page.getByRole("link", { name: `返回測試 ${id}` }).click();
  await expect(page).toHaveURL((url) => url.pathname === `/classes/terms/${series.id}` && url.searchParams.get("returnTo") === "/member/enrollments");

  // 展開「查看每一堂」點進其中一堂，返回要回期班頁（不是找課程）。
  await page.getByText(/查看每一堂（共/).click();
  await page.getByRole("list", { name: "這一期的上課日期" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/classes\/[^/]+\?returnTo=/);
  await expect(page.getByRole("link", { name: "返回期班" })).toBeVisible();
  await page.getByRole("link", { name: "返回期班" }).click();
  await expect(page).toHaveURL(new RegExp(`/classes/terms/${series.id}`));

  await page.getByRole("link", { name: "返回我的報名" }).click();
  await expect(page).toHaveURL(/\/member\/enrollments$/);
});

test("我的報名的單堂連結返回我的報名；首頁的下一堂課返回首頁；直接貼網址返回課程列表", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "single");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 2, title: `單堂返回 ${id}` });
  expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto("/member/dashboard");
  await page.locator(`a[href*="/classes/${sessions[0].id}"]`).first().click();
  await expect(page.getByRole("link", { name: "返回首頁" })).toBeVisible();
  await page.getByRole("link", { name: "返回首頁" }).click();
  await expect(page).toHaveURL(/\/member\/dashboard$/);

  await page.goto(`/classes/${sessions[0].id}`);
  await expect(page.getByRole("link", { name: "返回課程列表" })).toHaveAttribute("href", "/classes");

  // 來源不合法（外部網址、不在白名單）一律退回課程列表。
  await page.goto(`/classes/${sessions[0].id}?returnTo=${encodeURIComponent("https://evil.example")}`);
  await expect(page.getByRole("link", { name: "返回課程列表" })).toHaveAttribute("href", "/classes");
});

test("找課程（有篩選）→ 期班頁 → 返回回到同一組篩選；整期報名後返回連結不變", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "list-filter");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 2, title: `篩選返回 ${id}` });
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto("/classes?includeFull=1");
  await page.getByRole("link", { name: new RegExp(`篩選返回 ${id}`) }).click();
  const back = page.getByRole("link", { name: "返回課程列表" });
  await expect(back).toHaveAttribute("href", /includeFull=1/);

  await page.getByRole("button", { name: "我要報名" }).first().click();
  await page.getByLabel(/我了解此課程非醫療行為/).check();
  await page.getByRole("button", { name: /確認報名整期|送出整期報名申請/ }).click();
  await expect(page.getByText(/整期報名(成功|已送出)/)).toBeVisible();
  await expect(page.getByRole("link", { name: "返回課程列表" })).toHaveAttribute("href", /includeFull=1/);
});
