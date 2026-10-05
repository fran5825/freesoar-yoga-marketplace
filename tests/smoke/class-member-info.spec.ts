import { expect, test, type Page } from "@playwright/test";

import {
  MEMBER_INFO_MAX_LENGTH,
  validateClassSessionCreate,
} from "../../src/domain/class-session/validation";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateString, futureDateTime } from "./_helpers/future-dates";
import { pickServiceType } from "./_helpers/class-form";
import { selectFormTime } from "./_helpers/time-select";

// member-flow-redesign 票 03：單堂課的「適合對象」「準備事項」——老師建立與單堂改課時選填，
// 學員與訪客在課程詳情看到；沒填顯示「尚未提供」；系列（建立與兩種改法）這次不顯示（票 04）。
const testEmailDomain = "class-member-info-smoke.local";
const createdEmails: string[] = [];
const DAY = 86_400_000;

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

async function seedClass(
  teacherProfileId: string,
  data: Partial<{
    title: string;
    suitableFor: string | null;
    preparationNotes: string | null;
    recurringClassSeriesId: string | null;
    origin: "teacher_initiated" | "organizer_direct";
    organizerProfileId: string;
    organizationId: string;
    isPublic: boolean;
  }> = {},
) {
  const start = new Date(Date.now() + 15 * DAY);
  start.setUTCHours(11, 0, 0, 0);
  return prisma.classSession.create({
    data: {
      origin: data.origin ?? "teacher_initiated",
      organizerProfileId: data.organizerProfileId ?? null,
      organizationId: data.organizationId ?? null,
      teacherProfileId,
      recurringClassSeriesId: data.recurringClassSeriesId ?? null,
      title: data.title ?? "原本的課名",
      description: "原本的說明",
      suitableFor: data.suitableFor ?? null,
      preparationNotes: data.preparationNotes ?? null,
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: start,
      endAt: new Date(start.getTime() + 3_600_000),
      location: "台北市測試教室",
      capacity: 10,
      isPublic: data.isPublic ?? true,
      status: "open_for_enrollment",
    },
  });
}

async function fillSingleClass(page: Page, title: string) {
  await page.locator("#title").fill(title);
  await pickServiceType(page, "放鬆紓壓");
  await page.getByText("哈達瑜伽", { exact: true }).click();
  await page.locator("#single-date").fill(futureDateString(30));
  await selectFormTime(page, "single-", "start", "10:00");
  await selectFormTime(page, "single-", "end", "11:00");
  await page.locator("#location").fill("台北市測試教室");
  await page.locator("#capacity").fill("10");
}

async function openMemberInfo(page: Page) {
  const summary = page.getByText("適合對象與準備事項（選填）", { exact: true });
  if (!(await page.locator("#suitableFor").isVisible())) {
    await summary.click();
  }
}

// 讓瀏覽器不先截斷，測到 server 端的 500 字驗證。
async function removeMaxLength(page: Page, selector: string) {
  await page.locator(selector).evaluate((element: HTMLTextAreaElement) => element.removeAttribute("maxlength"));
}

test.describe("member info validation (direct, no UI)", () => {
  test("blank becomes null, text is trimmed, 500 passes and 501 is rejected", () => {
    const base = {
      title: "課",
      serviceType: "放鬆紓壓",
      startAt: futureDateTime(20, "10:00"),
      endAt: futureDateTime(20, "11:00"),
      location: "台北",
      capacity: 10,
    };
    const blank = validateClassSessionCreate({ ...base, suitableFor: "   ", preparationNotes: "" });
    expect(blank.valid && blank.normalized.suitableFor).toBeNull();
    expect(blank.valid && blank.normalized.preparationNotes).toBeNull();

    const trimmed = validateClassSessionCreate({ ...base, suitableFor: "  初學者  ", preparationNotes: "a".repeat(MEMBER_INFO_MAX_LENGTH) });
    expect(trimmed.valid && trimmed.normalized.suitableFor).toBe("初學者");
    expect(trimmed.valid).toBe(true);

    // 表單送出的換行是 \r\n；統一成 \n 後，剛好 500 字（含換行）仍然通過。
    const withNewlines = "a".repeat(249) + "\r\n" + "b".repeat(250);
    const crlf = validateClassSessionCreate({ ...base, suitableFor: withNewlines });
    expect(crlf.valid).toBe(true);
    expect(crlf.valid && crlf.normalized.suitableFor).toBe("a".repeat(249) + "\n" + "b".repeat(250));

    const tooLong = validateClassSessionCreate({ ...base, suitableFor: "a".repeat(501), preparationNotes: "b".repeat(501) });
    expect(tooLong.valid).toBe(false);
    expect(!tooLong.valid && tooLong.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["suitable_for_too_long", "preparation_notes_too_long"]),
    );
  });
});

test.describe("single class member info", () => {
  test("a teacher fills both on a single class; teacher detail, visitors and members see them after the description", async ({ browser, context, page }, testInfo) => {
    const id = runId(testInfo, "create");
    const teacher = await seedTeacher(id);
    const title = `適合對象課 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await fillSingleClass(page, title);
    await openMemberInfo(page);
    await page.locator("#suitableFor").fill("第一次接觸瑜伽也可以參加。\n有腰傷請先告知老師。");
    await page.locator("#preparationNotes").fill("請自備瑜伽墊與水壺。");
    await expect(page.getByRole("region", { name: "建立前核對" })).toContainText("已填寫");
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[^/?]+\?result=success/, { timeout: 15_000 });

    const created = await prisma.classSession.findFirstOrThrow({ where: { title } });
    expect(created.suitableFor).toBe("第一次接觸瑜伽也可以參加。\n有腰傷請先告知老師。");
    expect(created.preparationNotes).toBe("請自備瑜伽墊與水壺。");
    await expect(page.getByText("請自備瑜伽墊與水壺。")).toBeVisible();

    // 讓學員看得到：開放報名並公開。
    await prisma.classSession.update({ where: { id: created.id }, data: { status: "open_for_enrollment", isPublic: true } });

    const visitor = await browser.newPage();
    await visitor.goto(`/classes/${created.id}`);
    const description = visitor.getByRole("region", { name: "課程說明" });
    const suitable = visitor.getByRole("region", { name: "適合對象" });
    const preparation = visitor.getByRole("region", { name: "準備事項" });
    await expect(suitable).toContainText("有腰傷請先告知老師。");
    await expect(preparation).toContainText("請自備瑜伽墊與水壺。");
    expect((await description.boundingBox())!.y).toBeLessThan((await suitable.boundingBox())!.y);
    expect((await suitable.boundingBox())!.y).toBeLessThan((await preparation.boundingBox())!.y);
    await visitor.close();

    const member = await seedMember(id);
    await context.clearCookies();
    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/${created.id}`);
    await expect(page.getByRole("region", { name: "適合對象" })).toContainText("第一次接觸瑜伽也可以參加。");
    await expect(page.getByRole("region", { name: "準備事項" })).toContainText("請自備瑜伽墊與水壺。");
  });

  test("classes without the info (old teacher class, organizer class) show 尚未提供", async ({ page }, testInfo) => {
    const id = runId(testInfo, "empty");
    const teacher = await seedTeacher(id);
    const oldClass = await seedClass(teacher.teacherProfileId);
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const organizer = await createOrganizerProfileWithOrganization({ email: organizerEmail, displayName: "團主", organizationName: `團體 ${id}` });
    const organizerClass = await seedClass(teacher.teacherProfileId, {
      origin: "organizer_direct",
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
    });

    for (const classSession of [oldClass, organizerClass]) {
      await page.goto(`/classes/${classSession.id}`);
      await expect(page.getByRole("region", { name: "適合對象" })).toContainText("尚未提供");
      await expect(page.getByRole("region", { name: "準備事項" })).toContainText("尚未提供");
    }
  });

  test("clearing the only filled field keeps the section open so the teacher can keep typing", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "clear");
    const teacher = await seedTeacher(id);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await openMemberInfo(page);
    await page.locator("#suitableFor").fill("先寫一段");
    await page.locator("#suitableFor").fill("");
    await expect(page.locator("#suitableFor")).toBeVisible();
    await page.locator("#suitableFor").fill("重新寫的內容");
    await expect(page.locator("#suitableFor")).toHaveValue("重新寫的內容");
  });

  test("over 500 characters is rejected by the server, keeps the other inputs and creates nothing", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "too-long");
    const teacher = await seedTeacher(id);
    const title = `太長的課 ${id}`;

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await fillSingleClass(page, title);
    await openMemberInfo(page);
    await removeMaxLength(page, "#suitableFor");
    await page.locator("#suitableFor").fill("a".repeat(501));
    await page.getByRole("button", { name: "建立課程" }).click();

    await expect(page.locator("#suitableFor-error")).toContainText("適合對象不可超過 500 個字。");
    await expect(page).toHaveURL(/\/teacher\/classes\/new$/);
    await expect(page.locator("#title")).toHaveValue(title);
    expect(await prisma.classSession.count({ where: { title } })).toBe(0);
  });

  test("single-class edit prefills, keeps untouched values, can change and clear, and does not notify", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "edit");
    const teacher = await seedTeacher(id);
    const classSession = await seedClass(teacher.teacherProfileId, { suitableFor: "原本的適合對象", preparationNotes: "原本的準備事項" });
    const member = await seedMember(id);
    await prisma.enrollment.create({ data: { classSessionId: classSession.id, userId: member.userId, status: "confirmed", consentedAt: new Date() } });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${classSession.id}`);
    await expect(page.getByText("原本的適合對象")).toBeVisible();

    // 只改標題：兩段原值保留。
    await page.goto(`/teacher/classes/${classSession.id}/edit`);
    await expect(page.locator("#suitableFor")).toHaveValue("原本的適合對象");
    await expect(page.locator("#preparationNotes")).toHaveValue("原本的準備事項");
    await page.locator("#title").fill("新的課名");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSession.id}\\?`));
    let saved = await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } });
    expect(saved.title).toBe("新的課名");
    expect(saved.suitableFor).toBe("原本的適合對象");
    expect(saved.preparationNotes).toBe("原本的準備事項");

    // 修改一段、清空一段。
    await page.goto(`/teacher/classes/${classSession.id}/edit`);
    await page.locator("#suitableFor").fill("");
    await page.locator("#preparationNotes").fill("新的準備事項");
    await expect(page.getByRole("region", { name: "儲存前核對" })).toContainText("適合對象、準備事項");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSession.id}\\?`));
    saved = await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } });
    expect(saved.suitableFor).toBeNull();
    expect(saved.preparationNotes).toBe("新的準備事項");

    // 學員端讀回新內容：清空的顯示「尚未提供」。
    await page.goto(`/classes/${classSession.id}`);
    await expect(page.getByRole("region", { name: "適合對象" })).toContainText("尚未提供");
    await expect(page.getByRole("region", { name: "準備事項" })).toContainText("新的準備事項");

    // 超過 500 字：server 擋下，不寫入。
    await page.goto(`/teacher/classes/${classSession.id}/edit`);
    await removeMaxLength(page, "#preparationNotes");
    await page.locator("#preparationNotes").fill("b".repeat(501));
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page.locator("#preparationNotes-error")).toContainText("準備事項不可超過 500 個字。");
    saved = await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } });
    expect(saved.preparationNotes).toBe("新的準備事項");

    expect(await prisma.notification.count({ where: { userId: member.userId } })).toBe(0);
  });

  test("series: creating a series and editing an occurrence (either scope) never shows the fields; 只改這一場 keeps existing values", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "series");
    const teacher = await seedTeacher(id);
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: `系列 ${id}`,
        serviceType: "放鬆紓壓",
        serviceTypes: ["放鬆紓壓"],
        yogaStyles: ["哈達瑜伽"],
        dayOfWeek: 2,
        startTime: "19:00",
        endTime: "20:00",
        location: "台北市測試教室",
        capacity: 10,
      },
    });
    const occurrence = await seedClass(teacher.teacherProfileId, {
      recurringClassSeriesId: series.id,
      suitableFor: "系列既有的適合對象",
      preparationNotes: "系列既有的準備事項",
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await expect(page.locator("#suitableFor")).toHaveCount(1);
    for (const modeLabel of ["每週固定", "指定日期"]) {
      await page.getByRole("button", { name: modeLabel, exact: true }).click();
      await expect(page.locator("#suitableFor")).toHaveCount(0);
      await expect(page.locator("#preparationNotes")).toHaveCount(0);
    }

    await page.goto(`/teacher/classes/${occurrence.id}/edit`);
    await expect(page.locator("#edit-scope-single")).toBeChecked();
    await expect(page.locator("#suitableFor")).toHaveCount(0);
    await page.locator("#edit-scope-following").check();
    await expect(page.locator("#suitableFor")).toHaveCount(0);
    await page.locator("#edit-scope-single").check();
    await page.locator("#title").fill("只改這一場的新課名");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${occurrence.id}\\?`));
    const saved = await prisma.classSession.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(saved.title).toBe("只改這一場的新課名");
    expect(saved.suitableFor).toBe("系列既有的適合對象");
    expect(saved.preparationNotes).toBe("系列既有的準備事項");
  });

  test("long text wraps without horizontal scroll on a 375px screen", async ({ page }, testInfo) => {
    const id = runId(testInfo, "rwd");
    const teacher = await seedTeacher(id);
    const longWord = "適合對象很長很長".repeat(60);
    const classSession = await seedClass(teacher.teacherProfileId, { suitableFor: longWord.slice(0, 500), preparationNotes: "準備".repeat(250) });

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`/classes/${classSession.id}`);
    await expect(page.getByRole("region", { name: "適合對象" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("member-info-375.png"), fullPage: true });
  });
});
