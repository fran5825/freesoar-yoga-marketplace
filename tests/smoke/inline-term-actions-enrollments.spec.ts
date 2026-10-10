import { expect, test } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { safeTermRowReturnPath } from "../../src/lib/navigation/term-row-return-path";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// inline-member-actions 票 01：「我的報名」頁整期卡就地請假、取消請假、退出整期（spec I1、I2、3.2、3.3）。
const fixtures = createTermFixtures("inline-term-actions-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

type Mode = "term_only" | "term_and_single";

async function seedJoined(label: string, testInfo: Parameters<typeof runId>[0], options: { mode?: Mode; capacity?: number; count?: number } = {}) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: options.count ?? 3, capacity: options.capacity ?? 5, mode: options.mode ?? "term_and_single", title: `就地期班 ${id}` });
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  const rows = await prisma.enrollment.findMany({ where: { seriesEnrollmentId: joined.seriesEnrollmentId }, orderBy: { classSession: { startAt: "asc" } } });

  return { id, teacher, member, term, joined, rows };
}

const noOverflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("return paths are limited to the member's own pages and never redirect off-site", () => {
  expect(safeTermRowReturnPath("/member/enrollments").path).toBe("/member/enrollments");
  expect(safeTermRowReturnPath("/classes/terms/abc_123?x=1&result=success&open=sessions")).toMatchObject({ path: "/classes/terms/abc_123" });
  expect(safeTermRowReturnPath("/classes/terms/abc_123?x=1&result=success&open=sessions").query.toString()).toBe("x=1");
  expect(safeTermRowReturnPath("/classes/cmv1").path).toBe("/classes/cmv1");
  for (const bad of [undefined, "", "//evil.example", "https://evil.example/x", "/admin/dashboard", "/classes/a/b", "/member/enrollments/../admin", "/\\evil.example", "javascript:alert(1)"]) {
    expect(safeTermRowReturnPath(bad).path).toBe("/member/enrollments");
  }
});

test.describe("my enrollments: term card inline actions", () => {
  test("take leave on a row, the list stays open on that row, cancel the leave from the same row", async ({ context, page }, testInfo) => {
    const { member, rows } = await seedJoined("flow", testInfo);
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/member/enrollments");
    await expect(page.getByText("某一堂不能來，點進那一堂請假")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "整期報名", exact: true })).toHaveCount(0);
    await page.getByText("查看每一堂").click();
    const row = page.locator(`#session-row-${rows[0].id}`);
    await row.getByText("請假", { exact: true }).click();
    await expect(row.getByText("請假後，這一堂的名額會開放給單堂報名；整期的其他堂照常。開課前、名額還在時可以取消請假。")).toBeVisible();
    await row.getByLabel("我確認這一堂要請假。").check();
    await row.getByRole("button", { name: "確認請假" }).click();

    await expect(page.getByText("已請假這一堂，整期的其他堂照常。")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("open")).toBe("sessions");
    expect(new URL(page.url()).searchParams.get("focus")).toBe(`session-row-${rows[0].id}`);
    await expect(page.locator(`#session-row-${rows[0].id}`)).toBeInViewport();
    await expect(page.locator(`#session-row-${rows[0].id}`)).toContainText("請假中");
    await expect(page.getByText("請假中", { exact: true })).toHaveCount(1);
    expect(await noOverflow(page)).toBe(true);

    await page.locator(`#session-row-${rows[0].id}`).getByRole("button", { name: "取消請假" }).click();
    await expect(page.getByText("已取消請假，這一堂照常上課。")).toBeVisible();
    await expect(page.locator(`#session-row-${rows[0].id}`)).toContainText("已報名");
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { id: rows[0].id }, select: { status: true, cancelledBy: true } })).toEqual({ status: "confirmed", cancelledBy: null });
  });

  test("term_only uses the keep-the-seat wording", async ({ context, page }, testInfo) => {
    const { member, rows } = await seedJoined("only", testInfo, { mode: "term_only" });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/member/enrollments");
    await page.getByText("查看每一堂").click();
    const row = page.locator(`#session-row-${rows[0].id}`);
    await row.getByText("請假", { exact: true }).click();
    await expect(row.getByText("請假後，這一堂會標示為請假；整期的其他堂照常。開課前可以取消請假。")).toBeVisible();
  });

  test("a leave whose seat was taken has no button; a click that races a taken seat shows the reason at the feedback message", async ({ context, page }, testInfo) => {
    const { id, member, term, rows } = await seedJoined("full", testInfo, { capacity: 1, count: 2 });
    const other = await seedMember(id, "b");
    await prisma.enrollment.updateMany({ where: { id: { in: [rows[0].id, rows[1].id] } }, data: { status: "cancelled", cancelledBy: "member" } });
    await addAuthSessionCookie(context, member.sessionToken);

    // 第二堂的名額先被別人買走：頁面直接顯示說明，沒有按鈕。
    expect((await createEnrollmentForUser(other.id, term.sessions[1].id, { notes: null })).ok).toBe(true);
    await page.goto("/member/enrollments?open=sessions");
    await expect(page.locator(`#session-row-${rows[1].id}`)).toContainText("這一堂名額已被報滿，請聯絡老師。");
    await expect(page.locator(`#session-row-${rows[1].id}`).getByRole("button", { name: "取消請假" })).toHaveCount(0);

    // 第一堂有按鈕；按下前名額被占走 → 失敗，列的狀態沒變，失敗原因在可見的訊息區。
    const button = page.locator(`#session-row-${rows[0].id}`).getByRole("button", { name: "取消請假" });
    await expect(button).toBeVisible();
    expect((await createEnrollmentForUser(other.id, term.sessions[0].id, { notes: null })).ok).toBe(true);
    await button.click();
    await expect(page).toHaveURL(/focus=action-feedback/);
    await expect(page.locator("#action-feedback")).toContainText("這一堂名額已被報滿，請聯絡老師。");
    await expect(page.locator("#action-feedback")).toBeInViewport();
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: rows[0].id } })).status).toBe("cancelled");
  });

  test("withdrawing the term from the card: lists what will be cancelled, then returns to the same page with a message", async ({ context, page }, testInfo) => {
    const { member, joined, rows } = await seedJoined("withdraw", testInfo);
    await prisma.enrollment.update({ where: { id: rows[0].id }, data: { status: "cancelled", cancelledBy: "member" } });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/member/enrollments");
    await page.getByText("退出整期…").click();
    await expect(page.getByText("會取消之後的 2 堂：")).toBeVisible();
    await page.getByLabel("我確認要退出這一期。").check();
    await page.getByRole("button", { name: "確認退出整期" }).click();

    await expect(page.getByText("已退出整期，取消了之後的 2 堂。")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/member/enrollments");
    expect(new URL(page.url()).searchParams.get("focus")).toBeNull();
    await expect(page.locator(`#term-${joined.seriesEnrollmentId}`)).toHaveCount(0);
    expect((await prisma.seriesEnrollment.findUniqueOrThrow({ where: { id: joined.seriesEnrollmentId } })).status).toBe("withdrawn");
  });

  test("an ended term: the card is gone and the cancelled rows are listed below", async ({ context, page }, testInfo) => {
    const { member, joined, rows } = await seedJoined("ended", testInfo);
    await prisma.enrollment.update({ where: { id: rows[0].id }, data: { status: "cancelled", cancelledBy: "member" } });
    await prisma.seriesEnrollment.update({ where: { id: joined.seriesEnrollmentId }, data: { status: "withdrawn" } });
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/member/enrollments");
    await expect(page.locator(`#term-${joined.seriesEnrollmentId}`)).toHaveCount(0);
    await expect(page.locator(`#enrollment-${rows[0].id}`)).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});
