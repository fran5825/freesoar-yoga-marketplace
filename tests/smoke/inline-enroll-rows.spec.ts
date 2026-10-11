import { expect, test, type Page } from "@playwright/test";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { computeEnrollRowState } from "../../src/domain/enrollment/session-enroll-rows";
import { safeTermRowReturnPath } from "../../src/lib/navigation/term-row-return-path";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// inline-member-enroll 票 06–09：系列頁、期班頁、單堂頁的場次列就地報名；單堂頁的報名在第一張卡內展開。
const fixtures = createTermFixtures("inline-enroll-rows-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm, seedContinuous } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const row = (page: Page, classSessionId: string) => page.locator(`#session-row-${classSessionId}`);

test.describe("row state rules", () => {
  const future = new Date(Date.now() + 86_400_000);
  const base = { classStatus: "open_for_enrollment", startAt: future, capacity: 5, occupiedCount: 1, teacherApproved: true, termEnrollmentMode: null, own: null } as const;

  test("no record: enroll, full, started, closed, term only, teacher unavailable", () => {
    expect(computeEnrollRowState({ ...base })).toEqual({ kind: "enroll", reEnroll: false });
    expect(computeEnrollRowState({ ...base, occupiedCount: 5 })).toEqual({ kind: "reason", reason: "full" });
    expect(computeEnrollRowState({ ...base, startAt: new Date(Date.now() - 1000) })).toEqual({ kind: "reason", reason: "started" });
    expect(computeEnrollRowState({ ...base, classStatus: "draft" })).toEqual({ kind: "reason", reason: "closed" });
    expect(computeEnrollRowState({ ...base, termEnrollmentMode: "term_only" })).toEqual({ kind: "reason", reason: "term_only" });
    expect(computeEnrollRowState({ ...base, teacherApproved: false })).toEqual({ kind: "reason", reason: "teacher_unavailable" });
  });

  test("own single enrollment: cancel before start, re-enroll only after own cancel", () => {
    const own = { cancelledBy: null, seriesEnrollmentId: null, seriesEnrollmentStatus: null } as const;
    expect(computeEnrollRowState({ ...base, own: { ...own, status: "pending" } })).toEqual({ kind: "single", status: "pending", canCancel: true });
    expect(computeEnrollRowState({ ...base, startAt: new Date(Date.now() - 1000), own: { ...own, status: "confirmed" } })).toEqual({ kind: "single", status: "confirmed", canCancel: false });
    expect(computeEnrollRowState({ ...base, own: { ...own, status: "cancelled", cancelledBy: "member" } })).toEqual({ kind: "enroll", reEnroll: true });
    expect(computeEnrollRowState({ ...base, occupiedCount: 5, own: { ...own, status: "cancelled", cancelledBy: "member" } })).toEqual({ kind: "reason", reason: "full" });
    expect(computeEnrollRowState({ ...base, own: { ...own, status: "cancelled", cancelledBy: "teacher" } })).toEqual({ kind: "reason", reason: "blocked_teacher" });
    expect(computeEnrollRowState({ ...base, own: { ...own, status: "cancelled", cancelledBy: "admin" } })).toEqual({ kind: "reason", reason: "blocked_admin" });
  });

  test("own term enrollment: never offers 取消報名, actions come from the term row control", () => {
    const own = { cancelledBy: null, seriesEnrollmentId: "s1", seriesEnrollmentStatus: "pending" } as const;
    const pending = computeEnrollRowState({ ...base, termEnrollmentMode: "term_and_single", own: { ...own, status: "pending" } });
    expect(pending).toEqual({ kind: "term", status: "pending", control: { kind: "leave" } });
    const started = computeEnrollRowState({ ...base, startAt: new Date(Date.now() - 1000), termEnrollmentMode: "term_and_single", own: { ...own, status: "confirmed", seriesEnrollmentStatus: "confirmed" } });
    expect(started).toEqual({ kind: "term", status: "confirmed", control: { kind: "none" } });
  });

  test("return paths accept the series page and keep its own query, reject outside urls", () => {
    expect(safeTermRowReturnPath("/classes/series/abc?show=16&result=x")).toEqual({ path: "/classes/series/abc", query: new URLSearchParams("show=16") });
    expect(safeTermRowReturnPath("https://evil.example/classes/series/abc").path).toBe("/member/enrollments");
    expect(safeTermRowReturnPath("//evil.example/x").path).toBe("/member/enrollments");
    expect(safeTermRowReturnPath("/teacher/classes").path).toBe("/member/enrollments");
  });
});

test("series page: enroll on a row in place, the row turns into 已報名 with 取消報名; price of that session shows before consent", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "series");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3, title: `就地報名系列 ${id}` });
  await prisma.classSession.update({ where: { id: sessions[1].id }, data: { priceNote: `這堂特別價 ${id}` } });
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/series/${series.id}`);
  const target = row(page, sessions[1].id);
  await expect(target).toContainText("剩 5 個名額");
  await target.getByRole("button", { name: "報名", exact: true }).click();
  await expect(target).toContainText(`這堂特別價 ${id}`);
  await expect(target.getByLabel("備註（選填）")).toHaveCount(0);
  await target.getByRole("button", { name: "加備註" }).click();
  await target.getByLabel("備註（選填）").fill("膝蓋舊傷");
  await target.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
  await target.getByRole("button", { name: "確認報名" }).click();

  await expect(page).toHaveURL(new RegExp(`/classes/series/${series.id}\\?.*focus=session-row-${sessions[1].id}`));
  await expect(page.locator("#action-feedback")).toContainText("報名成功。");
  await expect(row(page, sessions[1].id)).toContainText("已報名");
  const saved = await prisma.enrollment.findFirst({ where: { userId: member.id, classSessionId: sessions[1].id } });
  expect(saved?.notes).toBe("膝蓋舊傷");

  // 取消報名也在列上完成，之後列變成「重新報名」。
  await row(page, sessions[1].id).getByText("取消報名", { exact: true }).click();
  await row(page, sessions[1].id).getByLabel("我確認要取消這則報名。").check();
  await row(page, sessions[1].id).getByRole("button", { name: "確認取消" }).click();
  await expect(page.locator("#action-feedback")).toContainText("報名已取消。");
  await expect(row(page, sessions[1].id).getByRole("button", { name: "重新報名" })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test("series page: a failed enroll (became full) shows the reason above the row and collapses the form", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "full");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const other = await seedMember(id, "b");
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, capacity: 1, title: `額滿系列 ${id}` });
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/series/${series.id}`);
  const target = row(page, sessions[0].id);
  await target.getByRole("button", { name: "報名", exact: true }).click();
  await target.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
  const taken = await createEnrollmentForUser(other.id, sessions[0].id, { notes: null });
  if (!taken.ok) throw new Error("fixture");
  await target.getByRole("button", { name: "確認報名" }).click();

  await expect(row(page, sessions[0].id)).toContainText("已額滿");
  await expect(row(page, sessions[0].id).locator("p[aria-live]")).toBeVisible();
  await expect(row(page, sessions[0].id).getByRole("button", { name: "確認報名" })).toHaveCount(0);
  await expect(page.locator("#action-feedback")).toHaveCount(0);
});

test("series page: requires-approval sessions say 申請報名; a visitor gets sign-in options on the row", async ({ page }, testInfo) => {
  const id = runId(testInfo, "visitor");
  const teacher = await seedTeacher(id);
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `訪客系列 ${id}` });
  await prisma.classSession.updateMany({ where: { recurringClassSeriesId: series.id }, data: { requiresApproval: true } });

  await page.goto(`/classes/series/${series.id}`);
  const target = row(page, sessions[0].id);
  await target.getByRole("button", { name: "申請報名" }).click();
  await expect(target.getByRole("button", { name: /登入並報名/ }).first()).toBeVisible();

  // 登入回來時網址帶 open=列 ID：該列自動展開（訪客看到登入選項，不會自動報名）。
  await page.goto(`/classes/series/${series.id}?open=session-row-${sessions[1].id}&focus=session-row-${sessions[1].id}`);
  await expect(row(page, sessions[1].id).getByRole("button", { name: /登入並報名/ }).first()).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test("term page: single enroll from a row of the collapsed list, which opens itself on return; term_only rows offer no single enroll", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "term");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, mode: "term_and_single", title: `就地期班 ${id}` });
  const only = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 2, mode: "term_only", title: `只收整期 ${id}` });
  await addAuthSessionCookie(context, member.sessionToken);

  await page.goto(`/classes/terms/${term.series.id}`);
  await page.getByText(/查看每一堂/).click();
  const target = row(page, term.sessions[2].id);
  await target.getByRole("button", { name: "報名", exact: true }).click();
  await target.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
  await target.getByRole("button", { name: "確認報名" }).click();

  await expect(page.locator("#action-feedback")).toContainText("報名成功。");
  await expect(row(page, term.sessions[2].id)).toBeVisible();
  await expect(row(page, term.sessions[2].id)).toContainText("已報名");

  await page.goto(`/classes/terms/${only.series.id}`);
  await page.getByText(/查看每一堂/).click();
  await expect(row(page, only.sessions[0].id).getByRole("button", { name: "報名", exact: true })).toHaveCount(0);
});

test("class page: enroll lives in the first card; siblings enroll in place; the title shows 期班・第 N 堂／共 M 堂", async ({ context, page }, testInfo) => {
  const id = runId(testInfo, "class");
  const teacher = await seedTeacher(id);
  const member = await seedMember(id, "a");
  const term = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, mode: "term_and_single", title: `首卡期班 ${id}` });
  const { sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, isPublic: false, title: `首卡持續 ${id}` });
  await addAuthSessionCookie(context, member.sessionToken);

  // 一般持續開課的單堂：沒有獨立的報名卡，「我要報名」在第一張卡內展開。
  await page.goto(`/classes/${sessions[0].id}`);
  await expect(page.getByRole("heading", { name: "報名這堂課程" })).toHaveCount(0);
  const card = page.getByRole("region", { name: "課程重點" });
  await expect(page.getByText("持續開課・每週三")).toBeVisible();
  await card.getByRole("button", { name: "我要報名" }).click();
  await expect(card.getByLabel("備註（選填）")).toHaveCount(0);
  await card.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
  await card.getByRole("button", { name: "確認報名" }).click();
  await expect(page.getByText("報名成功。")).toBeVisible();
  await expect(card).toContainText("已報名");

  // 同系列（非公開，維持列出）的另一場直接在列上報名。
  const sibling = row(page, sessions[1].id);
  await sibling.getByRole("button", { name: "報名", exact: true }).click();
  await sibling.getByLabel("我了解此課程非醫療行為，會依自身身體狀況參與。").check();
  await sibling.getByRole("button", { name: "確認報名" }).click();
  await expect(row(page, sessions[1].id)).toContainText("已報名");
  await expect(page).toHaveURL(new RegExp(`/classes/${sessions[0].id}`));

  // 期班的單堂頁：標籤寫第幾堂；整期報名後同系列列有請假。
  await page.goto(`/classes/${term.sessions[1].id}`);
  await expect(page.getByRole("link", { name: "期班・第 2 堂／共 3 堂" })).toBeVisible();
  const joined = await createSeriesEnrollmentForUser(member.id, term.series.id, { notes: null }, undefined, noNotify);
  if (!joined.ok) throw new Error("fixture");
  await page.reload();
  const termRow = row(page, term.sessions[2].id);
  await termRow.getByText("請假", { exact: true }).click();
  await termRow.getByLabel("我確認這一堂要請假。").check();
  await termRow.getByRole("button", { name: "確認請假" }).click();
  await expect(page).toHaveURL(new RegExp(`focus=session-row-${term.sessions[2].id}`));
  await expect(row(page, term.sessions[2].id)).toContainText("請假中");
  expect(await noOverflow(page)).toBe(true);
});
