import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// enrollment-re-enrollment 票 05：學員旅程驗收（桌面與手機兩個 project 都會跑）——
// 單堂：取消 → 重新報名 → 再取消；整期：請假 → 取消請假；每個畫面都不能橫向溢出，也不能出現舊的「無法再次報名」說法。
const fixtures = createTermFixtures("re-enrollment-acceptance-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

test("single class: cancel, re-enroll, cancel again — every state fits the screen", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "single");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 1, title: `驗收單堂 ${id}` });
  const created = await createEnrollmentForUser(member.id, sessions[0].id, { notes: null });
  if (!created.ok) throw new Error("fixture");
  await addAuthSessionCookie(context, member.sessionToken);
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const region = page.getByRole("region", { name: "課程重點" });

  for (const round of [1, 2]) {
    await page.goto(`/classes/${sessions[0].id}`);
    await noOverflow();
    await page.getByText("取消報名…").click();
    await page.getByLabel("我確認要取消這則報名。").check();
    await page.getByRole("button", { name: "確認取消" }).click();
    await expect(page.getByText("報名已取消。")).toBeVisible();
    await expect(region).toContainText("可以重新報名");
    await expect(page.getByText("無法再次報名")).toHaveCount(0);
    await noOverflow();
    await region.getByText("重新報名…").click();
    await region.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
    await region.getByRole("button", { name: "重新報名" }).click();
    await expect(page.getByText("已重新報名。")).toBeVisible();
    await expect(region).toContainText("已報名");
    await noOverflow();
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: created.enrollmentId } })).status, `round ${round}`).toBe("confirmed");
  }

  // 我的報名：已報名的卡片仍在，狀態一致。
  await page.goto("/member/enrollments");
  await expect(page.locator(`#enrollment-${created.enrollmentId}`)).toContainText("已報名");
  await noOverflow();
});

test("term: take leave, cancel the leave, and the reasons read well when it cannot be undone", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "term");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, mode: "term_and_single", title: `驗收期班 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  await addAuthSessionCookie(context, member.sessionToken);
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const region = page.getByRole("region", { name: "課程重點" });

  await page.goto(`/classes/${term.sessions[0].id}`);
  await page.getByRole("region", { name: "課程重點" }).getByText("請假", { exact: true }).click();
  await page.getByRole("region", { name: "課程重點" }).getByLabel("我確認這一堂要請假。").check();
  await page.getByRole("region", { name: "課程重點" }).getByRole("button", { name: "確認請假" }).click();
  await expect(region).toContainText("可以取消請假");
  await noOverflow();
  await region.getByRole("button", { name: "取消請假" }).click();
  await expect(page.getByText("已取消請假，這一堂照常上課。")).toBeVisible();
  await expect(region).toContainText("已報名");
  await noOverflow();

  // 退出整期之後，那一堂不能再報名，也不會看到「取消請假」。
  await page.goto(`/classes/${term.sessions[1].id}`);
  await page.getByRole("region", { name: "課程重點" }).getByText("請假", { exact: true }).click();
  await page.getByRole("region", { name: "課程重點" }).getByLabel("我確認這一堂要請假。").check();
  await page.getByRole("region", { name: "課程重點" }).getByRole("button", { name: "確認請假" }).click();
  await expect(region).toContainText("可以取消請假");
  await page.goto(`/classes/terms/${term.series.id}`);
  await page.getByText("退出整期…").click();
  await page.getByLabel("我確認要退出這一期。").check();
  await page.getByRole("button", { name: "確認退出整期" }).click();
  await expect.poll(async () => (await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: joined.seriesEnrollmentId } })).status).toBe("withdrawn");
  await page.goto(`/classes/${term.sessions[1].id}`);
  await expect(region).toContainText("你已退出這一期，這一堂無法再報名。");
  await expect(region.getByRole("button", { name: "取消請假" })).toHaveCount(0);
  await noOverflow();
});
