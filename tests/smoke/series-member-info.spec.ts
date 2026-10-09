import { expect, test, type Page } from "@playwright/test";

import { editSeriesFromOccurrenceForTeacher } from "../../src/domain/class-session/__internal__/edit-series-from-occurrence-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { validateRecurringSeriesInput } from "../../src/domain/class-session/recurring-series-validation";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateString, futureWeekdayDateString } from "./_helpers/future-dates";
import { addFixedDate, pickServiceType } from "./_helpers/class-form";
import { selectFormTime } from "./_helpers/time-select";

// member-flow-redesign 票 04：系列（每週固定、指定日期）的「適合對象」「準備事項」——建立時填寫、
// 生成時複製到每一場、「生成更多」沿用、兩種改課範圍都能修改／清空、500 字限制、不通知學員。
const testEmailDomain = "series-member-info-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
  await prisma.recurringClassSeries.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function seedTeacher(id: string) {
  const email = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({ email, displayName: `Teacher ${id}`, status: "approved" });
}

async function seedMember(id: string) {
  const email = `member-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

// 每週二 19:00–20:00、4 場、已開放報名；系列上帶兩段。
async function seedSeries(teacherProfileId: string, info: { suitableFor: string | null; preparationNotes: string | null }) {
  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title: "週二晚上的課",
      description: "原本的說明",
      suitableFor: info.suitableFor,
      preparationNotes: info.preparationNotes,
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek: 2,
      startTime: "19:00",
      endTime: "20:00",
      location: "台北市原本教室",
      capacity: 10,
    },
  });
  await generateOccurrencesForSeries(teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 4), {
    openForEnrollment: true,
  });
  const sessions = await prisma.classSession.findMany({
    where: { recurringClassSeriesId: series.id },
    orderBy: { startAt: "asc" },
  });
  return { series, sessions };
}

const followingInput = {
  title: "週二晚上的課",
  description: "原本的說明",
  serviceTypes: ["放鬆紓壓"],
  yogaStyles: ["哈達瑜伽"],
  startTime: "19:00",
  endTime: "20:00",
  location: "台北市原本教室",
  capacity: 10,
};

async function openMemberInfo(page: Page, prefix: string) {
  if (!(await page.locator(`#${prefix}suitableFor`).isVisible())) {
    await page.locator(`#${prefix}suitableFor`).locator("xpath=ancestor::details[1]/summary").click();
  }
}

async function removeMaxLength(page: Page, selector: string) {
  await page.locator(selector).evaluate((element: HTMLTextAreaElement) => element.removeAttribute("maxlength"));
}

async function memberInfoOf(where: { recurringClassSeriesId: string }) {
  return prisma.classSession.findMany({
    where,
    orderBy: { startAt: "asc" },
    select: { id: true, suitableFor: true, preparationNotes: true, isPublic: true, requiresApproval: true },
  });
}

test.describe("series member info validation (direct, no UI)", () => {
  test("same rules as single classes: blank → null, CRLF normalised, 500 passes, 501 rejected", () => {
    const base = {
      title: "系列",
      serviceType: "放鬆紓壓",
      yogaStyles: ["哈達瑜伽"],
      startTime: "19:00",
      endTime: "20:00",
      location: "台北",
      capacity: 10,
      mode: "fixed_dates" as const,
      dates: [futureDateString(20)],
    };
    const blank = validateRecurringSeriesInput({ ...base, suitableFor: "  ", preparationNotes: "" });
    expect(blank.valid && blank.normalized.suitableFor).toBeNull();
    expect(blank.valid && blank.normalized.preparationNotes).toBeNull();

    const crlf = validateRecurringSeriesInput({ ...base, suitableFor: `${"a".repeat(249)}\r\n${"b".repeat(250)}` });
    expect(crlf.valid && crlf.normalized.suitableFor).toBe(`${"a".repeat(249)}\n${"b".repeat(250)}`);

    const tooLong = validateRecurringSeriesInput({ ...base, suitableFor: "a".repeat(501), preparationNotes: "b".repeat(501) });
    expect(tooLong.valid).toBe(false);
    expect(!tooLong.valid && tooLong.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["suitable_for_too_long", "preparation_notes_too_long"]),
    );
  });
});

test.describe("series member info", () => {
  test("a weekly series copies both fields to every session; members see them on a shared session", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "weekly");
    const teacher = await seedTeacher(id);
    const title = `每週系列 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定", exact: true }).click();
    await page.locator("#weekly-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    const weekday = Number(await page.locator("#weekly-dayOfWeek").inputValue());
    await page.locator("#weekly-startDate").fill(futureWeekdayDateString(14, weekday));
    await selectFormTime(page, "weekly-", "start", "18:00");
    await selectFormTime(page, "weekly-", "end", "19:00");
    await page.locator("#weekly-location").fill("台北市每週教室");
    await page.locator("#weekly-capacity").fill("6");
    await page.locator("#weekly-generateCount").fill("2");
    await openMemberInfo(page, "weekly-");
    await page.locator("#weekly-suitableFor").fill("每週都適合初學者");
    await page.locator("#weekly-preparationNotes").fill("每週請帶瑜伽墊");
    await page.getByRole("button", { name: "建立課程系列" }).click();
    await expect(page.getByText(/課程系列已建立，共生成 2 場/)).toBeVisible({ timeout: 15_000 });

    const series = await prisma.recurringClassSeries.findFirstOrThrow({ where: { title } });
    expect(series.suitableFor).toBe("每週都適合初學者");
    expect(series.preparationNotes).toBe("每週請帶瑜伽墊");
    const sessions = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      expect(session).toMatchObject({ suitableFor: "每週都適合初學者", preparationNotes: "每週請帶瑜伽墊", isPublic: false });
    }
    await expect(page.getByText("每週請帶瑜伽墊")).toBeVisible();

    // 學員從分享連結開其中一場（系列場次不公開，登入學員仍可透過連結查看）。
    await prisma.classSession.update({ where: { id: sessions[1].id }, data: { status: "open_for_enrollment" } });
    const member = await seedMember(id);
    await context.clearCookies();
    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/${sessions[1].id}`);
    await expect(page.getByRole("region", { name: "適合對象" })).toContainText("每週都適合初學者");
    await expect(page.getByRole("region", { name: "準備事項" })).toContainText("每週請帶瑜伽墊");
  });

  test("a fixed-dates series copies both fields; an empty one shows 尚未提供", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "fixed");
    const teacher = await seedTeacher(id);
    const titles = [`指定日期有填 ${id}`, `指定日期沒填 ${id}`];

    await addAuthSessionCookie(context, teacher.sessionToken);
    for (const [index, title] of titles.entries()) {
      await page.goto("/teacher/classes/new");
      await page.getByRole("button", { name: "指定日期", exact: true }).click();
      await page.locator("#fixed-title").fill(title);
      await pickServiceType(page, "放鬆紓壓");
      await page.getByText("哈達瑜伽", { exact: true }).click();
      await addFixedDate(page, futureDateString(30 + index * 7));
      await selectFormTime(page, "fixed-", "start", "10:00");
      await selectFormTime(page, "fixed-", "end", "11:00");
      await page.locator("#fixed-location").fill("台北市指定日期教室");
      await page.locator("#fixed-capacity").fill("5");
      if (index === 0) {
        await openMemberInfo(page, "fixed-");
        await page.locator("#fixed-suitableFor").fill("指定日期的適合對象");
        await page.locator("#fixed-preparationNotes").fill("指定日期的準備事項");
      }
      await page.getByRole("button", { name: "建立課程系列" }).click();
      await expect(page.getByText(/期班已建立/)).toBeVisible({ timeout: 15_000 });
    }

    const filled = await prisma.recurringClassSeries.findFirstOrThrow({ where: { title: titles[0] } });
    const empty = await prisma.recurringClassSeries.findFirstOrThrow({ where: { title: titles[1] } });
    const [filledSession] = await memberInfoOf({ recurringClassSeriesId: filled.id });
    const [emptySession] = await memberInfoOf({ recurringClassSeriesId: empty.id });
    expect(filledSession).toMatchObject({ suitableFor: "指定日期的適合對象", preparationNotes: "指定日期的準備事項" });
    expect(emptySession).toMatchObject({ suitableFor: null, preparationNotes: null });

    await prisma.classSession.updateMany({ where: { id: { in: [filledSession.id, emptySession.id] } }, data: { status: "open_for_enrollment" } });
    await page.goto(`/classes/${filledSession.id}`);
    await expect(page.getByRole("region", { name: "適合對象" })).toContainText("指定日期的適合對象");
    await expect(page.getByRole("region", { name: "準備事項" })).toContainText("指定日期的準備事項");
    await page.goto(`/classes/${emptySession.id}`);
    await expect(page.getByRole("region", { name: "適合對象" })).toContainText("尚未提供");
    await expect(page.getByRole("region", { name: "準備事項" })).toContainText("尚未提供");
  });

  test("over 500 characters on a series is rejected by the server and creates nothing", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "series-too-long");
    const teacher = await seedTeacher(id);
    const title = `太長的系列 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "指定日期", exact: true }).click();
    await page.locator("#fixed-title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await addFixedDate(page, futureDateString(40));
    await selectFormTime(page, "fixed-", "start", "10:00");
    await selectFormTime(page, "fixed-", "end", "11:00");
    await page.locator("#fixed-location").fill("台北市");
    await page.locator("#fixed-capacity").fill("5");
    await openMemberInfo(page, "fixed-");
    await removeMaxLength(page, "#fixed-preparationNotes");
    await page.locator("#fixed-preparationNotes").fill("b".repeat(501));
    await page.getByRole("button", { name: "建立課程系列" }).click();

    await expect(page.locator("#fixed-preparationNotes-error")).toContainText("準備事項不可超過 500 個字。");
    await expect(page.locator("#fixed-title")).toHaveValue(title);
    expect(await prisma.recurringClassSeries.count({ where: { title } })).toBe(0);
  });

  test("generate more copies the series' current values", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "more"));
    const { series } = await seedSeries(teacher.teacherProfileId, { suitableFor: "原本的適合對象", preparationNotes: null });
    await prisma.recurringClassSeries.update({ where: { id: series.id }, data: { suitableFor: "更新後的適合對象", preparationNotes: "新的準備事項" } });

    const dates = computeNextWeeklyOccurrenceDates(2, 6).slice(4);
    await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, dates, { openForEnrollment: true });
    const sessions = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(sessions).toHaveLength(6);
    expect(sessions.slice(0, 4).every((session) => session.suitableFor === "原本的適合對象" && session.preparationNotes === null)).toBe(true);
    expect(sessions.slice(4).every((session) => session.suitableFor === "更新後的適合對象" && session.preparationNotes === "新的準備事項")).toBe(true);
  });

  test("只改這一場 changes one session; 改這一場和之後所有場次 changes it, later sessions and the series; no notices; clearing works", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "edit");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedSeries(teacher.teacherProfileId, { suitableFor: "系列的適合對象", preparationNotes: "系列的準備事項" });
    const member = await seedMember(id);
    for (const session of sessions) {
      await prisma.enrollment.create({ data: { classSessionId: session.id, userId: member.userId, status: "confirmed", consentedAt: new Date() } });
    }

    await addAuthSessionCookie(context, teacher.sessionToken);

    // 只改第一場。
    await page.goto(`/teacher/classes/${sessions[0].id}/edit`);
    await expect(page.locator("#edit-scope-single")).toBeChecked();
    await expect(page.locator("#suitableFor")).toHaveValue("系列的適合對象");
    await page.locator("#suitableFor").fill("只有第一場的適合對象");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${sessions[0].id}\\?`));
    let after = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(after[0].suitableFor).toBe("只有第一場的適合對象");
    expect(after.slice(1).every((session) => session.suitableFor === "系列的適合對象")).toBe(true);
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).suitableFor).toBe("系列的適合對象");

    // 只改第一場時也能清空（只清這一場）。
    await page.goto(`/teacher/classes/${sessions[0].id}/edit`);
    await page.locator("#preparationNotes").fill("");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${sessions[0].id}\\?`));
    after = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(after[0].preparationNotes).toBeNull();
    expect(after.slice(1).every((session) => session.preparationNotes === "系列的準備事項")).toBe(true);

    // 從第二場起「改這一場和之後所有場次」：改準備事項、清空適合對象。
    await page.goto(`/teacher/classes/${sessions[1].id}/edit`);
    await page.locator("#edit-scope-following").check();
    await expect(page.locator("#suitableFor")).toHaveValue("系列的適合對象");
    await page.locator("#suitableFor").fill("");
    await page.locator("#preparationNotes").fill("之後各場的準備事項");
    await expect(page.getByRole("region", { name: "儲存前核對" })).toContainText("適合對象、準備事項");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/series/${series.id}`));
    after = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(after[0]).toMatchObject({ suitableFor: "只有第一場的適合對象", preparationNotes: null });
    for (const session of after.slice(1)) {
      expect(session).toMatchObject({ suitableFor: null, preparationNotes: "之後各場的準備事項" });
    }
    const updatedSeries = await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } });
    expect(updatedSeries).toMatchObject({ suitableFor: null, preparationNotes: "之後各場的準備事項" });
    await expect(page.getByText("之後各場的準備事項")).toBeVisible();

    // 之後「生成更多」沿用新的系列值。
    await generateOccurrencesForSeries(teacher.teacherProfileId, series.id, computeNextWeeklyOccurrenceDates(2, 5).slice(4), { openForEnrollment: true });
    const extra = (await memberInfoOf({ recurringClassSeriesId: series.id })).at(-1)!;
    expect(extra).toMatchObject({ suitableFor: null, preparationNotes: "之後各場的準備事項" });

    // 只改內容，不發通知；公開設定與報名方式不變。
    expect(await prisma.notification.count({ where: { userId: member.userId } })).toBe(0);
    expect(after.every((session) => session.isPublic === false && session.requiresApproval === false)).toBe(true);
  });

  test("both edit scopes keep the 500-character limit; a rejected edit changes nothing", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "edit-limit");
    const teacher = await seedTeacher(id);
    const { series, sessions } = await seedSeries(teacher.teacherProfileId, { suitableFor: "原本的適合對象", preparationNotes: "原本的準備事項" });
    const exactly500 = `${"a".repeat(249)}\n${"b".repeat(250)}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    for (const scope of ["single", "following"] as const) {
      for (const field of ["suitableFor", "preparationNotes"] as const) {
        const target = scope === "single" ? sessions[0] : sessions[2];
        const before = await memberInfoOf({ recurringClassSeriesId: series.id });
        const seriesBefore = await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } });

        await page.goto(`/teacher/classes/${target.id}/edit`);
        if (scope === "following") await page.locator("#edit-scope-following").check();
        await removeMaxLength(page, `#${field}`);
        await page.locator(`#${field}`).fill("c".repeat(501));
        await page.getByRole("button", { name: "儲存修改" }).click();
        await expect(page.locator(`#${field}-error`)).toContainText("不可超過 500 個字。");
        await expect(page.locator(`#${field}`)).toHaveValue("c".repeat(501));
        expect(await memberInfoOf({ recurringClassSeriesId: series.id })).toEqual(before);
        expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toEqual(seriesBefore);

        // 剛好 500 字（含換行）可以儲存。
        await page.locator(`#${field}`).fill(exactly500);
        await page.getByRole("button", { name: "儲存修改" }).click();
        await expect(page).not.toHaveURL(/\/edit$/);
        const saved = await prisma.classSession.findUniqueOrThrow({ where: { id: target.id } });
        expect(saved[field]).toBe(exactly500);
      }
    }
  });

  test("the following-scope core keeps fields that were not sent, even when sessions differ from the series", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "undefined"));
    const { series, sessions } = await seedSeries(teacher.teacherProfileId, { suitableFor: "系列的適合對象", preparationNotes: "系列的準備事項" });
    await prisma.classSession.update({ where: { id: sessions[2].id }, data: { suitableFor: "第三場自己的適合對象" } });

    const result = await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[1].id, {
      ...followingInput,
      preparationNotes: "只送準備事項",
    });
    expect(result.ok).toBe(true);
    const after = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(after[1]).toMatchObject({ suitableFor: "系列的適合對象", preparationNotes: "只送準備事項" });
    expect(after[2]).toMatchObject({ suitableFor: "第三場自己的適合對象", preparationNotes: "只送準備事項" });
    expect(await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).toMatchObject({
      suitableFor: "系列的適合對象",
      preparationNotes: "只送準備事項",
    });

    // 明確送空字串才會清空。
    await editSeriesFromOccurrenceForTeacher(teacher.teacherProfileId, series.id, sessions[1].id, { ...followingInput, suitableFor: "" });
    const cleared = await memberInfoOf({ recurringClassSeriesId: series.id });
    expect(cleared.slice(1).every((session) => session.suitableFor === null)).toBe(true);
    expect(cleared[0].suitableFor).toBe("系列的適合對象");
  });
});
