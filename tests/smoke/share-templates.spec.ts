import { expect, test } from "@playwright/test";

import { buildShareTemplates, ENROLL_URL_PLACEHOLDER, type ShareTemplateInput } from "../../src/domain/class-session/share-templates";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-showcase-photos 票 08：可複製的分享文案（不呼叫 AI，只套固定模板；沒填的欄位整行不出現）。
const fixtures = createTermFixtures("share-templates-smoke.local");
const { runId, seedTeacher } = fixtures;

test.setTimeout(120_000);
const slow = { timeout: 30_000 };

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const base: ShareTemplateInput = {
  title: "週四放鬆陰瑜伽",
  startAt: new Date("2026-11-05T11:00:00Z"), // 台北時間 11/05 19:00
  endAt: new Date("2026-11-05T12:00:00Z"),
  location: "新竹科學園區 科技生活館",
  priceNote: "單堂 600 元",
  suitableFor: "第一次接觸瑜伽也可以參加。",
  preparationNotes: "請自備瑜伽墊與水壺。",
  requiresApproval: false,
  teacherName: "林安瑜",
  isSeries: false,
};

test.describe("template content (pure)", () => {
  test("the announcement carries every filled field, the link placeholder and the teacher's name", () => {
    const { announcement } = buildShareTemplates(base);

    for (const expected of ["【週四放鬆陰瑜伽】", "時間：2026/11/05（週四）19:00–20:00", "地點：新竹科學園區 科技生活館", "費用：單堂 600 元", "適合對象：第一次接觸瑜伽也可以參加。", "準備事項：請自備瑜伽墊與水壺。", `報名連結：${ENROLL_URL_PLACEHOLDER}`, "— 林安瑜"]) {
      expect(announcement.text).toContain(expected);
    }
    expect(announcement.text).not.toContain("報名後會由老師確認");
  });

  test("empty fields leave out their whole line instead of showing a placeholder", () => {
    const sparse = buildShareTemplates({ ...base, priceNote: null, suitableFor: "   ", preparationNotes: null, teacherName: null });

    for (const template of Object.values(sparse)) {
      for (const absent of ["費用", "適合對象", "準備事項", "尚未提供", "undefined", "null", "— "]) {
        expect(template.text).not.toContain(absent);
      }
    }
    expect(sparse.announcement.text).toContain("時間：");
    expect(sparse.announcement.text).toContain("地點：");
  });

  test("approval classes say that the teacher confirms; the reminder and thanks match their purpose", () => {
    const templates = buildShareTemplates({ ...base, requiresApproval: true });

    expect(templates.announcement.text).toContain("報名後會由老師確認，確認結果會通知你。");
    expect(templates.reminder.text).toContain("明天要上課囉：週四放鬆陰瑜伽");
    expect(templates.reminder.text).toContain("請自備瑜伽墊與水壺。");
    expect(templates.reminder.text).not.toContain(ENROLL_URL_PLACEHOLDER);
    expect(templates.thanks.text).toContain("謝謝你來上「週四放鬆陰瑜伽」");
    expect(templates.thanks.text).toContain("下次還想一起練習的話");
    expect(templates.thanks.text).toContain(ENROLL_URL_PLACEHOLDER);
    expect(buildShareTemplates({ ...base, isSeries: true }).thanks.text).toContain("之後的場次可以從這裡看");
  });

  test("the tone stays gentle: none of the three texts uses pressure or discount wording", () => {
    for (const template of Object.values(buildShareTemplates({ ...base, requiresApproval: true }))) {
      for (const banned of ["最後", "搶", "限時", "立即", "趕快", "優惠", "折扣", "名額有限", "保證"]) {
        expect(template.text).not.toContain(banned);
      }
    }
  });
});

test.describe("on the teacher's class page", () => {
  async function seedOpenClass(label: string, testInfo: Parameters<typeof runId>[0], extra: Record<string, unknown> = {}) {
    const teacher = await seedTeacher(runId(testInfo, label));
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { displayName: "林安瑜" } });
    const start = new Date(Date.now() + 9 * 86_400_000);
    const classSession = await prisma.classSession.create({
      data: {
        origin: "teacher_initiated", teacherProfileId: teacher.teacherProfileId, title: `文案課 ${runId(testInfo, "t")}`, serviceType: "放鬆紓壓", serviceTypes: ["放鬆紓壓"],
        yogaStyles: ["陰瑜伽"], startAt: start, endAt: new Date(start.getTime() + 3_600_000), location: "新竹教室", capacity: 8, status: "open_for_enrollment", isPublic: true, ...extra,
      },
    });

    return { teacher, classSession };
  }

  test("an open class offers the three texts with the full enrolment link; they can be edited and copied", async ({ page, context }, testInfo) => {
    const { teacher, classSession } = await seedOpenClass("page", testInfo, { priceNote: "單堂 600 元", preparationNotes: "請自備瑜伽墊。" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto(`/teacher/classes/${classSession.id}`);
    await expect(page.getByRole("heading", { name: "分享文案（可以直接複製，也可以先改幾個字）" })).toBeVisible(slow);
    for (const label of ["招募公告（貼到 LINE 或 IG）", "課前一天提醒", "課後感謝"]) {
      await expect(page.locator("summary", { hasText: label })).toBeVisible();
    }

    await page.locator("summary", { hasText: "招募公告（貼到 LINE 或 IG）" }).click();
    const box = page.getByRole("textbox", { name: "招募公告（貼到 LINE 或 IG）" });
    await expect(box).toContainText("費用：單堂 600 元", slow);
    const origin = new URL(page.url()).origin;
    await expect(box).toHaveValue(new RegExp(`報名連結：${origin}/classes/${classSession.id}`));
    expect(await box.inputValue()).not.toContain("{{ENROLL_URL}}");

    await box.fill(`${await box.inputValue()}\n（我自己加的一句話）`);
    await page.getByRole("button", { name: "複製文字" }).first().click();
    await expect(page.getByText("已複製，可以貼到 LINE 或 IG。")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("（我自己加的一句話）");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`${origin}/classes/${classSession.id}`);
  });

  test("a class without a price shows no price line; a draft class has no share section yet", async ({ page, context }, testInfo) => {
    const noPrice = await seedOpenClass("noprice", testInfo);
    await addAuthSessionCookie(context, noPrice.teacher.sessionToken);
    await page.goto(`/teacher/classes/${noPrice.classSession.id}`);
    await page.locator("summary", { hasText: "招募公告（貼到 LINE 或 IG）" }).click(slow);
    await expect(page.getByRole("textbox", { name: "招募公告（貼到 LINE 或 IG）" })).not.toHaveValue(/費用：/);

    await prisma.classSession.update({ where: { id: noPrice.classSession.id }, data: { status: "draft" } });
    await page.goto(`/teacher/classes/${noPrice.classSession.id}`);
    await expect(page.getByRole("heading", { name: "課程內容" })).toBeVisible(slow);
    await expect(page.getByText("分享文案（可以直接複製，也可以先改幾個字）")).toHaveCount(0);
  });
});
