import { expect, test, type Locator, type Page } from "@playwright/test";

import { buildPaymentInfoReminder } from "../../src/domain/teacher-profile/payment-reminder";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { futureDateString } from "./_helpers/future-dates";
import { pickServiceType } from "./_helpers/class-form";
import { selectFormTime } from "./_helpers/time-select";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-first-run 票 03：開放報名前的收款資訊提醒。帳號與規則分開判斷、提醒出現在按下之前、不擋開放。
const fixtures = createTermFixtures("teacher-payment-reminder-smoke.local");
const { runId, seedTeacher, seedTerm, seedContinuous } = fixtures;

test.setTimeout(120_000);

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const SNAPSHOT_NOTE = "學員報名時會看到你當下填的收款資訊，之後補填不會更新給已報名的人。";

function reminder(page: Page) {
  return page.getByRole("note", { name: "收款資訊提醒" });
}

// 提醒要在按鈕「之前」（文件順序在前），老師按下之前就讀得到。
async function expectBefore(first: Locator, second: Locator) {
  const firstHandle = await first.elementHandle();
  const secondHandle = await second.elementHandle();
  expect(
    await firstHandle!.evaluate(
      (node, other) => Boolean(node.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      secondHandle,
    ),
  ).toBe(true);
}

async function setPaymentInfo(teacherProfileId: string, data: { paymentAccountInfo: string | null; paymentRulesText: string | null }) {
  await prisma.teacherProfile.update({ where: { id: teacherProfileId }, data });
}

async function seedDraftClass(teacherProfileId: string, title: string) {
  const start = new Date(Date.now() + 12 * 86_400_000);

  return prisma.classSession.create({
    data: {
      origin: "teacher_initiated", teacherProfileId, title, serviceType: "放鬆紓壓", serviceTypes: ["放鬆紓壓"], yogaStyles: ["哈達瑜伽"],
      startAt: start, endAt: new Date(start.getTime() + 3_600_000), location: "新竹教室", capacity: 8, status: "draft", isPublic: true,
    },
  });
}

test.describe("which items are missing (pure)", () => {
  test("account and rules are checked separately; blank text counts as missing", () => {
    expect(buildPaymentInfoReminder({ paymentAccountInfo: "台灣銀行 123", paymentRulesText: "課前三天可退費" })).toBeNull();
    expect(buildPaymentInfoReminder({ paymentAccountInfo: null, paymentRulesText: "課前三天可退費" })?.missingItems).toEqual([
      "還沒填收款帳號",
    ]);
    expect(buildPaymentInfoReminder({ paymentAccountInfo: "台灣銀行 123", paymentRulesText: "  " })?.missingItems).toEqual([
      "還沒填繳費與取消規則",
    ]);
    expect(buildPaymentInfoReminder({ paymentAccountInfo: " ", paymentRulesText: null })?.missingItems).toEqual([
      "還沒填收款帳號",
      "還沒填繳費與取消規則",
    ]);
  });
});

test.describe("single class", () => {
  test("the class page warns before 'open for enrollment', links to the payment tab, and still lets the teacher open", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "single-page");
    const teacher = await seedTeacher(id);
    await setPaymentInfo(teacher.teacherProfileId, { paymentAccountInfo: null, paymentRulesText: "課前三天可退費" });
    const draft = await seedDraftClass(teacher.teacherProfileId, `提醒單堂 ${id}`);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${draft.id}`);

    await expect(reminder(page)).toContainText("還沒填收款帳號");
    await expect(reminder(page)).not.toContainText("還沒填繳費與取消規則");
    await expect(reminder(page)).toContainText(SNAPSHOT_NOTE);
    await expect(reminder(page).getByRole("link", { name: /到「收款與聯絡」填寫/ })).toHaveAttribute("href", "/teacher/profile/payment");
    await expectBefore(reminder(page), page.getByRole("button", { name: "開放報名", exact: true }));

    // 不擋操作：不填也能開放。
    await page.getByRole("button", { name: "開放報名", exact: true }).click();
    await expect(page.getByText("已開放報名。")).toBeVisible();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("open_for_enrollment");
    await expect(reminder(page)).toHaveCount(0);
  });

  test("a teacher who filled both sees no reminder", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "single-filled");
    const teacher = await seedTeacher(id);
    await setPaymentInfo(teacher.teacherProfileId, { paymentAccountInfo: "台灣銀行 123", paymentRulesText: "課前三天可退費" });
    const draft = await seedDraftClass(teacher.teacherProfileId, `已填收款 ${id}`);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${draft.id}`);
    await expect(page.getByRole("button", { name: "開放報名", exact: true })).toBeVisible();
    await expect(reminder(page)).toHaveCount(0);
  });

  test("the create form shows the reminder before 'create' only while 'open right away' is chosen", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "single-create");
    const teacher = await seedTeacher(id);
    await setPaymentInfo(teacher.teacherProfileId, { paymentAccountInfo: null, paymentRulesText: null });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await expect(reminder(page)).toContainText("還沒填收款帳號、還沒填繳費與取消規則");

    await page.locator("#single-openForEnrollment-no").check();
    await expect(reminder(page)).toHaveCount(0);
    await page.locator("#single-openForEnrollment-yes").check();
    await expect(reminder(page)).toBeVisible();

    // 不擋建立：照樣建立並開放。
    const title = `建立時提醒 ${id}`;
    await page.locator("#title").fill(title);
    await pickServiceType(page, "放鬆紓壓");
    await page.getByText("哈達瑜伽", { exact: true }).click();
    await page.locator("#single-date").fill(futureDateString(33));
    await selectFormTime(page, "single-", "start", "08:00");
    await selectFormTime(page, "single-", "end", "09:00");
    await page.locator("#location").fill("新竹提醒教室");
    await page.locator("#capacity").fill("6");
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page.getByText("已開放報名。", { exact: true })).toBeVisible();
    expect((await prisma.classSession.findFirstOrThrow({ where: { title } })).status).toBe("open_for_enrollment");
  });
});

test.describe("series", () => {
  test("the series create form shows the reminder only when 'open all after creating' is chosen", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "series-create");
    const teacher = await seedTeacher(id);
    await setPaymentInfo(teacher.teacherProfileId, { paymentAccountInfo: null, paymentRulesText: "課前三天可退費" });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");
    await page.getByRole("button", { name: "每週固定" }).click();
    await expect(reminder(page)).toHaveCount(0);
    await page.locator("#weekly-openForEnrollment-yes").check();
    await expect(reminder(page)).toContainText("還沒填收款帳號");
  });

  test("the series page warns once in 'open all' (which also covers each draft's quick open), in 'generate more' when opening, and before a make-up class that opens right away", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "series-page");
    const teacher = await seedTeacher(id);
    await setPaymentInfo(teacher.teacherProfileId, { paymentAccountInfo: null, paymentRulesText: null });
    const drafts = await seedTerm(teacher.teacherProfileId, { open: false, title: `草稿期班 ${id}` });
    const openTerm = await seedTerm(teacher.teacherProfileId, { open: true, title: `已開放期班 ${id}` });
    const continuous = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `持續開課 ${id}`, dayOfWeek: 5 });

    await addAuthSessionCookie(context, teacher.sessionToken);

    // 全部開放與單場快速開放：提醒在「還有幾場草稿」區塊，位置在場次清單之前。
    await page.goto(`/teacher/classes/series/${drafts.series.id}`);
    const openAll = page.getByRole("region", { name: /場草稿沒開放報名/ });
    await expect(openAll.getByRole("note", { name: "收款資訊提醒" })).toContainText("還沒填收款帳號");
    // wrong-route-fixes 票 04：場次清單上方不再重複提醒，整頁只有「還有幾場草稿」區塊這一塊，
    // 而且在單場快速「開放報名」按鈕之前。
    const occurrences = page.getByRole("region", { name: /已生成場次/ });
    await expect(occurrences.getByRole("note", { name: "收款資訊提醒" })).toHaveCount(0);
    await expect(reminder(page)).toHaveCount(1);
    await expectBefore(openAll.getByRole("note", { name: "收款資訊提醒" }), page.getByRole("button", { name: /^開放 .* 這一場的報名$/ }).first());
    // 草稿期班的補課不會直接開放，補課區不提醒。
    await expect(page.getByRole("region", { name: "追加補課日期" }).getByRole("note")).toHaveCount(0);
    // 不擋操作：單場快速開放照樣成功。
    await page.getByRole("button", { name: /^開放 .* 這一場的報名$/ }).first().click();
    await expect(page.getByText("已開放報名。")).toBeVisible();

    // 期班已全部開放：追加補課會直接開放，所以補課區提醒。
    await page.goto(`/teacher/classes/series/${openTerm.series.id}`);
    // 已全部開放、沒有草稿：場次清單上方不提醒。
    await expect(page.getByRole("region", { name: /已生成場次/ }).getByRole("note")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "追加補課日期" }).getByRole("note", { name: "收款資訊提醒" })).toBeVisible();

    // 生成更多：勾了「建立後全部開放報名」才提醒。
    await page.goto(`/teacher/classes/series/${continuous.series.id}`);
    const generateMore = page.locator("#generate-more");
    await expect(generateMore.getByRole("note")).toHaveCount(0);
    await generateMore.getByLabel("建立後全部開放報名").check();
    await expect(generateMore.getByRole("note", { name: "收款資訊提醒" })).toContainText("還沒填繳費與取消規則");
    await expectBefore(generateMore.getByRole("note", { name: "收款資訊提醒" }), generateMore.getByRole("button", { name: "生成" }));
  });
});
