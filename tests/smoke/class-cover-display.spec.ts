import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { setCoverCore } from "../../src/domain/teacher-photo/__internal__/cover-core";
import { setAvatarCore, uploadTeacherPhotoCore } from "../../src/domain/teacher-photo/__internal__/photo-core";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createLocalStorage } from "../../src/lib/storage/photo-storage";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { E2E_LOCAL_STORAGE_DIR } from "./_helpers/storage";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-showcase-photos 票 05（spec 第 5 節、7.1）：封面與老師頭像在列表卡片與各課程頁一致顯示；
// 沒有封面顯示品牌色塊、卡片高度一致；被下架的照片一律不顯示；不增加資訊行、手機寬度不爆版。
const fixtures = createTermFixtures("class-cover-display-smoke.local");
const { runId, seedTeacher, seedMember, seedContinuous, seedTerm } = fixtures;
const storage = createLocalStorage(E2E_LOCAL_STORAGE_DIR);

test.setTimeout(120_000);
const slow = { timeout: 30_000 };

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const jpeg = (color: string) => sharp({ create: { width: 900, height: 600, channels: 3, background: color } }).jpeg().toBuffer();
const MEDIA = /\/media\/photos\/[0-9a-f-]{36}\.webp/;

async function seedShowcase(label: string, testInfo: Parameters<typeof runId>[0]) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { displayName: `Amy ${id}` } });
  const upload = async (color: string) => {
    const result = await uploadTeacherPhotoCore(teacher.teacherProfileId, await jpeg(color), storage);
    if (!result.ok) throw new Error("fixture");
    return result;
  };
  const avatar = await upload("#a55");
  const coverPhoto = await upload("#5a5");
  await setAvatarCore(teacher.teacherProfileId, avatar.photoId);
  const location = `封面顯示教室${id}`;
  const start = (days: number) => new Date(Date.now() + days * 86_400_000);
  const base = { origin: "teacher_initiated" as const, teacherProfileId: teacher.teacherProfileId, serviceType: "放鬆紓壓", serviceTypes: ["放鬆紓壓"], yogaStyles: ["哈達瑜伽"], location, capacity: 5, status: "open_for_enrollment" as const, isPublic: true };
  const withCover = await prisma.classSession.create({ data: { ...base, title: `有封面單堂 ${id}`, startAt: start(10), endAt: new Date(start(10).getTime() + 3_600_000) } });
  const noCover = await prisma.classSession.create({ data: { ...base, title: `無封面單堂 ${id}`, startAt: start(11), endAt: new Date(start(11).getTime() + 3_600_000) } });
  await setCoverCore(teacher.teacherProfileId, { kind: "session", id: withCover.id }, coverPhoto.photoId);
  const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `有封面系列 ${id}`, location, dayOfWeek: 2 });
  await setCoverCore(teacher.teacherProfileId, { kind: "series", id: series.id }, coverPhoto.photoId);
  const term = await seedTerm(teacher.teacherProfileId, { count: 3, isPublic: true, title: `有封面期班 ${id}` });
  await prisma.classSession.updateMany({ where: { recurringClassSeriesId: term.series.id }, data: { location } });
  await setCoverCore(teacher.teacherProfileId, { kind: "series", id: term.series.id }, coverPhoto.photoId);

  return { id, teacher, avatar, coverPhoto, location, withCover, noCover, series, seriesSessions: sessions, term };
}

const card = (page: Page, title: string) => page.getByRole("link", { name: new RegExp(title) });

test.describe("cover and avatar on the class list", () => {
  test("every card kind shows its cover and the teacher avatar; a class without a cover gets a brand block of the same size", async ({ page }, testInfo) => {
    const data = await seedShowcase("list", testInfo);
    await page.goto(`/classes?location=${encodeURIComponent(data.location)}&includeFull=1`);

    const withCover = card(page, `有封面單堂 ${data.id}`);
    const noCover = card(page, `無封面單堂 ${data.id}`);
    const seriesCard = card(page, `有封面系列 ${data.id}`);
    const termCard = card(page, `有封面期班 ${data.id}`);
    for (const target of [withCover, noCover, seriesCard, termCard]) await expect(target).toHaveCount(1, slow);

    // 有封面：封面圖＋老師頭像；來源與系列標籤放在圖上
    for (const target of [withCover, seriesCard, termCard]) {
      const images = target.locator("img");
      await expect(images).toHaveCount(2);
      await expect(images.first()).toHaveAttribute("src", MEDIA);
      await expect.poll(() => images.first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(images.nth(1)).toHaveAttribute("src", MEDIA);
    }
    // 沒有封面：沒有封面圖，只有頭像；色塊上顯示瑜伽類型，不寫「尚未提供」
    await expect(noCover.locator("img")).toHaveCount(1);
    await expect(noCover.getByTestId("card-cover")).toContainText("哈達瑜伽");
    await expect(noCover).not.toContainText("尚未提供");

    // 封面區大小一致（有封面與沒封面的卡片高度不會因此不同）
    const heights = await Promise.all([withCover, noCover].map(async (target) => (await target.getByTestId("card-cover").boundingBox())!.height));
    expect(Math.abs(heights[0] - heights[1])).toBeLessThan(1);
    // 不增加資訊行：瑜伽類型不再單獨成行，老師那一行只剩名字
    for (const target of [withCover, noCover, seriesCard, termCard]) {
      await expect(target).not.toContainText("瑜伽類型：");
      await expect(target).toContainText(`Amy ${data.id}`);
    }
    await expect(withCover).toContainText("剩 5 個名額");
    await expect(seriesCard).toContainText("持續開課");
    await expect(termCard).toContainText("期班・共 3 堂・剩 3 堂");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("a photo removed by an admin is never shown: cover falls back to the block, avatar disappears", async ({ page }, testInfo) => {
    const data = await seedShowcase("removed", testInfo);
    await prisma.teacherPhoto.updateMany({ where: { id: { in: [data.coverPhoto.photoId, data.avatar.photoId] } }, data: { status: "removed_by_admin", removedAt: new Date() } });

    await page.goto(`/classes?location=${encodeURIComponent(data.location)}&includeFull=1`);
    const withCover = card(page, `有封面單堂 ${data.id}`);
    await expect(withCover).toHaveCount(1, slow);
    await expect(withCover.locator("img")).toHaveCount(0);
    await expect(withCover.getByTestId("card-cover")).toContainText("哈達瑜伽");
    await page.goto(`/classes/${data.withCover.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(slow);
    expect(await page.locator("img").count()).toBe(0);
  });
});

test.describe("cover and avatar on the class pages", () => {
  test("single, series-session, series and term pages show the effective cover on top; visitors and members see the same", async ({ page, context }, testInfo) => {
    const data = await seedShowcase("pages", testInfo);
    const coverImage = page.locator("main img").first();

    // 單堂（自己的封面）
    await page.goto(`/classes/${data.withCover.id}`);
    await expect(coverImage).toHaveAttribute("src", MEDIA, slow);
    await expect(page.getByRole("region", { name: "課程重點" }).locator("img")).toHaveCount(1);
    // 沒封面的單堂：頁面頂端沒有封面圖（有填才顯示），老師頭像仍在摘要裡
    await page.goto(`/classes/${data.noCover.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(slow);
    await expect(page.locator("main img")).toHaveCount(1);
    // 系列場次用系列的封面
    await page.goto(`/classes/${data.seriesSessions[0].id}`);
    await expect(coverImage).toHaveAttribute("src", MEDIA, slow);
    expect(await page.locator("main img").count()).toBe(2);
    // 系列頁、期班頁
    await page.goto(`/classes/series/${data.series.id}`);
    await expect(page.locator("main img").first()).toHaveAttribute("src", MEDIA, slow);
    await page.goto(`/classes/terms/${data.term.series.id}`);
    await expect(page.locator("main img").first()).toHaveAttribute("src", MEDIA, slow);

    // 已登入學員（另一套讀取）看到同樣的封面與頭像
    const member = await seedMember(data.id, "member");
    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/${data.withCover.id}`);
    await expect(coverImage).toHaveAttribute("src", MEDIA, slow);
    await expect(page.getByRole("region", { name: "課程重點" }).locator("img")).toHaveCount(1);
    await page.goto(`/classes/${data.seriesSessions[0].id}`);
    await expect(coverImage).toHaveAttribute("src", MEDIA, slow);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("the teacher's own class page shows the current cover, or says there is none", async ({ page, context }, testInfo) => {
    const data = await seedShowcase("teacher-page", testInfo);
    await addAuthSessionCookie(context, data.teacher.sessionToken);

    await page.goto(`/teacher/classes/${data.withCover.id}`);
    await expect(page.getByRole("img", { name: "目前的課程封面" })).toHaveAttribute("src", MEDIA, slow);
    await page.goto(`/teacher/classes/${data.noCover.id}`);
    await expect(page.getByText("還沒設定封面，學員會看到品牌色塊。")).toBeVisible(slow);
    await page.goto(`/teacher/classes/${data.seriesSessions[0].id}`);
    await expect(page.getByRole("img", { name: "目前的課程封面" })).toHaveAttribute("src", MEDIA, slow);
  });

  test("classes enrolled by a member keep working with covers (enrollment is unaffected)", async ({}, testInfo) => {
    const data = await seedShowcase("enroll", testInfo);
    const member = await seedMember(data.id, "enrollee");

    expect((await createEnrollmentForUser(member.id, data.withCover.id, { notes: null })).ok).toBe(true);
  });
});
