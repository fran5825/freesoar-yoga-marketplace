import { expect, test } from "@playwright/test";

import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures, noNotify } from "./_helpers/term-fixtures";

// teacher-class-scheduling 票 14：期班報名流程簡化（2026-10-09 產品主人 Q1–Q14）。
const fixtures = createTermFixtures("term-enroll-simplify-smoke.local");
const { runId, seedTeacher, seedMember, seedTerm } = fixtures;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

test.describe("term page (Q3–Q12)", () => {
  test("我要報名 opens the form inside the info card; notes stay folded; the result shows in the same card; empty info cards are hidden", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "term-page");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { count: 3, title: `一步報名 ${id}` });

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/terms/${series.id}`);
    const card = page.getByRole("region", { name: "課程資訊與報名" });
    await expect(card).toContainText("期間");
    await expect(card).toContainText("上課時間");
    await expect(card.getByLabel(/我了解此課程非醫療行為/)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "課程說明" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "適合對象" })).toHaveCount(0);

    await card.getByRole("button", { name: "我要報名" }).click();
    await expect(card.getByLabel("備註（選填）")).toHaveCount(0);
    await card.getByRole("button", { name: "加備註" }).click();
    await card.getByLabel("備註（選填）").fill("想先試試");
    await card.getByLabel(/我了解此課程非醫療行為/).check();
    await card.getByRole("button", { name: "確認報名整期（3 堂）" }).click();

    await expect(page.getByRole("region", { name: "課程資訊與報名" })).toContainText("整期報名成功，共 3 堂。");
    await expect(page.getByRole("region", { name: "課程資訊與報名" })).toContainText("你已報名整期");
    expect(await prisma.seriesEnrollment.findFirstOrThrow({ where: { userId: member.id } })).toMatchObject({ notes: "想先試試" });
  });

  test("enroll=1 opens the form directly; a term that cannot be enrolled shows the reason without the button", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "term-open-blocked");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const open = await seedTerm(teacher.teacherProfileId, { title: `直接展開 ${id}` });
    const draft = await seedTerm(teacher.teacherProfileId, { open: false, title: `還有草稿 ${id}` });
    await prisma.classSession.update({ where: { id: draft.sessions[0].id }, data: { status: "open_for_enrollment" } });

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/terms/${open.series.id}?enroll=1`);
    await expect(page.getByLabel(/我了解此課程非醫療行為/)).toBeVisible();

    await page.goto(`/classes/terms/${draft.series.id}`);
    await expect(page.getByText(/還有 2 堂尚未開放報名，全部開放後才能報整期/)).toBeVisible();
    await expect(page.getByRole("button", { name: "我要報名" })).toHaveCount(0);
  });
});

test.describe("single class page of a term (Q1, Q2, Q7, Q9)", () => {
  test("term_and_single: 我要報名 defaults to the whole term; another member can choose only this class", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "choice");
    const teacher = await seedTeacher(id);
    const a = await seedMember(id, "a");
    const b = await seedMember(id, "b");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3, title: `二選一 ${id}` });

    const contextA = await browser.newContext();
    await addAuthSessionCookie(contextA, a.sessionToken);
    const pageA = await contextA.newPage();
    await pageA.goto(`/classes/${sessions[1].id}`);
    await expect(pageA.getByRole("region", { name: "課程重點" })).toContainText("期間");
    await expect(pageA.getByRole("region", { name: "課程重點" })).toContainText(/（週[一二三四五六日]）\d{2}:\d{2}–\d{2}:\d{2}/);
    await pageA.getByRole("button", { name: "我要報名" }).click();
    await expect(pageA.getByRole("radio", { name: /報名整期（3 堂）/ })).toBeChecked();
    await pageA.getByLabel(/我了解此課程非醫療行為/).check();
    await pageA.getByRole("button", { name: "確認報名" }).click();
    await expect(pageA.getByText("整期報名成功，共 3 堂。")).toBeVisible();
    expect(await prisma.seriesEnrollment.count({ where: { userId: a.id, recurringClassSeriesId: series.id } })).toBe(1);
    await contextA.close();

    const contextB = await browser.newContext();
    await addAuthSessionCookie(contextB, b.sessionToken);
    const pageB = await contextB.newPage();
    await pageB.goto(`/classes/${sessions[1].id}`);
    await pageB.getByRole("button", { name: "我要報名" }).click();
    await pageB.getByRole("radio", { name: /只報這一堂/ }).check();
    await pageB.getByLabel(/我了解此課程非醫療行為/).check();
    await pageB.getByRole("button", { name: "確認報名" }).click();
    await expect(pageB.getByText("報名成功。")).toBeVisible();
    expect(await prisma.seriesEnrollment.count({ where: { userId: b.id } })).toBe(0);
    expect(await prisma.enrollment.count({ where: { userId: b.id, classSessionId: sessions[1].id, status: "confirmed" } })).toBe(1);
    await contextB.close();
  });

  test("term_only: a member already enrolled stays on the class page to take leave; the teacher sees only the term link", async ({ browser }, testInfo) => {
    const id = runId(testInfo, "term-only");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { mode: "term_only", count: 3, title: `只收整期 ${id}` });
    expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);

    const memberContext = await browser.newContext();
    await addAuthSessionCookie(memberContext, member.sessionToken);
    const memberPage = await memberContext.newPage();
    await memberPage.goto(`/classes/${sessions[1].id}`);
    await expect(memberPage).toHaveURL(new RegExp(`/classes/${sessions[1].id}$`));
    await expect(memberPage.getByText("請假這一堂…")).toBeVisible();
    await memberContext.close();

    const teacherContext = await browser.newContext();
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto(`/teacher/classes/series/${series.id}`);
    await expect(teacherPage.getByRole("button", { name: "複製期班報名連結" })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /這一場的報名連結/ })).toHaveCount(0);
    await teacherContext.close();
  });
});
