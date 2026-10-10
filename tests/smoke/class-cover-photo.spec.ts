import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { deleteTeacherPhotoCore, uploadTeacherPhotoCore } from "../../src/domain/teacher-photo/__internal__/photo-core";
import { countPhotoCoverUsageCore, setCoverCore } from "../../src/domain/teacher-photo/__internal__/cover-core";
import { createLocalStorage } from "../../src/lib/storage/photo-storage";
import { pickServiceType } from "./_helpers/class-form";
import { futureDateString } from "./_helpers/future-dates";
import { waitForHydrated } from "./_helpers/hydration";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { E2E_LOCAL_STORAGE_DIR } from "./_helpers/storage";
import { createTermFixtures } from "./_helpers/term-fixtures";
import { selectFormTime } from "./_helpers/time-select";

// teacher-showcase-photos 票 04：課程封面。單堂用自己的封面；系列場次一律用系列的封面（資料庫也保證）。
const fixtures = createTermFixtures("class-cover-photo-smoke.local");
const { runId, seedTeacher, seedContinuous } = fixtures;
const storage = createLocalStorage(E2E_LOCAL_STORAGE_DIR);

test.setTimeout(120_000);
const slow = { timeout: 30_000 };

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const jpeg = (color: string) => sharp({ create: { width: 800, height: 500, channels: 3, background: color } }).jpeg().toBuffer();

async function seedTeacherWithPhotos(label: string, testInfo: Parameters<typeof runId>[0], count = 2) {
  const teacher = await seedTeacher(runId(testInfo, label));
  const photos: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const uploaded = await uploadTeacherPhotoCore(teacher.teacherProfileId, await jpeg(["#c44", "#4c4", "#44c"][index % 3]), storage);
    if (!uploaded.ok) throw new Error("fixture");
    photos.push(uploaded.photoId);
  }

  return { teacher, photos };
}

async function seedSingleClass(teacherProfileId: string, title: string) {
  const start = new Date(Date.now() + 20 * 86_400_000);

  return prisma.classSession.create({
    data: {
      origin: "teacher_initiated",
      teacherProfileId,
      title,
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: start,
      endAt: new Date(start.getTime() + 3_600_000),
      location: "教室",
      capacity: 5,
      status: "open_for_enrollment",
    },
  });
}

const coverOf = async (classSessionId: string) => (await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId } })).coverPhotoId;

test.describe("cover rules (domain)", () => {
  test("a single class takes its own cover; only the teacher's own active photos qualify; clearing works", async ({}, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("single", testInfo);
    const stranger = await seedTeacherWithPhotos("single-stranger", testInfo, 1);
    const session = await seedSingleClass(teacher.teacherProfileId, `封面單堂 ${runId(testInfo, "x")}`);
    const target = { kind: "session" as const, id: session.id };

    expect(await setCoverCore(teacher.teacherProfileId, target, photos[0])).toEqual({ ok: true });
    expect(await coverOf(session.id)).toBe(photos[0]);
    expect(await setCoverCore(teacher.teacherProfileId, target, photos[1])).toEqual({ ok: true });
    expect(await coverOf(session.id)).toBe(photos[1]);

    expect(await setCoverCore(teacher.teacherProfileId, target, stranger.photos[0])).toEqual({ ok: false, code: "cover_photo_invalid" });
    expect(await setCoverCore(teacher.teacherProfileId, target, "no-such-photo")).toEqual({ ok: false, code: "cover_photo_invalid" });
    expect(await coverOf(session.id)).toBe(photos[1]);
    await prisma.teacherPhoto.update({ where: { id: photos[0] }, data: { status: "removed_by_admin", removedAt: new Date() } });
    expect(await setCoverCore(teacher.teacherProfileId, target, photos[0])).toEqual({ ok: false, code: "cover_photo_invalid" });

    // 別人的課、不存在的課
    expect(await setCoverCore(stranger.teacher.teacherProfileId, target, stranger.photos[0])).toEqual({ ok: false, code: "target_not_found" });
    expect(await setCoverCore(teacher.teacherProfileId, { kind: "session", id: "nope" }, photos[1])).toEqual({ ok: false, code: "target_not_found" });
    expect(await coverOf(session.id)).toBe(photos[1]);

    expect(await setCoverCore(teacher.teacherProfileId, target, null)).toEqual({ ok: true });
    expect(await coverOf(session.id)).toBeNull();
  });

  test("a series cover is shared: setting it through any session of the series sets the series, and sessions never keep their own", async ({}, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("series", testInfo);
    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 3 });

    expect(await setCoverCore(teacher.teacherProfileId, { kind: "series", id: series.id }, photos[0])).toEqual({ ok: true });
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).coverPhotoId).toBe(photos[0]);

    // 對系列的某一場設定：實際上是設定整個系列
    expect(await setCoverCore(teacher.teacherProfileId, { kind: "session", id: sessions[1].id }, photos[1])).toEqual({ ok: true });
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).coverPhotoId).toBe(photos[1]);
    for (const session of sessions) {
      expect(await coverOf(session.id)).toBeNull();
    }

    // 資料庫最後一道保證：直接寫入系列場次自己的封面會被擋下
    await expect(prisma.classSession.update({ where: { id: sessions[0].id }, data: { coverPhotoId: photos[0] } })).rejects.toThrow();
    expect(await coverOf(sessions[0].id)).toBeNull();
  });

  test("deleting or removing a photo clears every cover that used it, and the classes stay", async ({}, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("delete", testInfo);
    const single = await seedSingleClass(teacher.teacherProfileId, `刪圖單堂 ${runId(testInfo, "x")}`);
    const { series } = await seedContinuous(teacher.teacherProfileId, { count: 2 });
    await setCoverCore(teacher.teacherProfileId, { kind: "session", id: single.id }, photos[0]);
    await setCoverCore(teacher.teacherProfileId, { kind: "series", id: series.id }, photos[0]);

    expect((await countPhotoCoverUsageCore(teacher.teacherProfileId)).get(photos[0])).toEqual({ sessions: 1, series: 1 });
    expect((await countPhotoCoverUsageCore(teacher.teacherProfileId)).get(photos[1])).toBeUndefined();

    expect(await deleteTeacherPhotoCore(teacher.teacherProfileId, photos[0], storage)).toEqual({ ok: true });
    expect(await coverOf(single.id)).toBeNull();
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).coverPhotoId).toBeNull();
    expect(await prisma.classSession.count({ where: { id: single.id } })).toBe(1);
    expect(await prisma.recurringClassSeries.count({ where: { id: series.id } })).toBe(1);
  });
});

// 同一位老師連建多堂課時，每堂用不同的日期，避免被時段衝突檢查擋下。
async function fillSingleClass(page: Page, title: string, dayOffset = 30) {
  await page.locator("#title").fill(title);
  await pickServiceType(page, "放鬆紓壓");
  await page.getByText("哈達瑜伽", { exact: true }).click();
  await page.locator("#single-date").fill(futureDateString(dayOffset));
  await selectFormTime(page, "single-", "start", "10:00");
  await selectFormTime(page, "single-", "end", "11:00");
  await page.locator("#location").fill("台北市測試教室");
  await page.locator("#capacity").fill("10");
}

test.describe("create and edit forms", () => {
  test("creating a single class with a chosen photo sets the cover; with no choice it stays empty", async ({ page, context }, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("form-create", testInfo);
    await addAuthSessionCookie(context, teacher.sessionToken);
    const id = runId(testInfo, "form-create-title");

    await page.goto("/teacher/classes/new");
    await expect(page.getByText("課程封面（選填）")).toBeVisible(slow);
    await waitForHydrated(page.locator("#title"));
    await fillSingleClass(page, `有封面 ${id}`);
    await page.getByRole("img", { name: "第 2 張照片" }).first().click();
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[^/?]+\?result=success/, { timeout: 30_000 });
    expect(await coverOf((await prisma.classSession.findFirstOrThrow({ where: { title: `有封面 ${id}` } })).id)).toBe(photos[1]);

    await page.goto("/teacher/classes/new");
    await waitForHydrated(page.locator("#title"));
    await fillSingleClass(page, `沒封面 ${id}`, 31);
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[^/?]+\?result=success/, { timeout: 30_000 });
    expect(await coverOf((await prisma.classSession.findFirstOrThrow({ where: { title: `沒封面 ${id}` } })).id)).toBeNull();
  });

  test("uploading a new photo as the cover adds it to the photo library and sets the cover; a bad file still creates the class with a clear warning", async ({ page, context }, testInfo) => {
    const { teacher } = await seedTeacherWithPhotos("form-upload", testInfo, 1);
    await addAuthSessionCookie(context, teacher.sessionToken);
    const id = runId(testInfo, "form-upload-title");

    await page.goto("/teacher/classes/new");
    await waitForHydrated(page.locator("#title"));
    await fillSingleClass(page, `上傳封面 ${id}`);
    await page.locator("#single-coverUpload").setInputFiles({ name: "new.jpg", mimeType: "image/jpeg", buffer: await jpeg("#a5a") });
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[^/?]+\?result=success/, { timeout: 30_000 });
    const created = await prisma.classSession.findFirstOrThrow({ where: { title: `上傳封面 ${id}` } });
    expect(created.coverPhotoId).not.toBeNull();
    expect(await prisma.teacherPhoto.count({ where: { teacherProfileId: teacher.teacherProfileId, status: "active" } })).toBe(2);

    await page.goto("/teacher/classes/new");
    await waitForHydrated(page.locator("#title"));
    await fillSingleClass(page, `壞檔案 ${id}`, 31);
    await page.locator("#single-coverUpload").setInputFiles({ name: "bad.jpg", mimeType: "image/jpeg", buffer: Buffer.from("這不是照片") });
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[^/?]+\?result=success/, { timeout: 30_000 });
    await expect(page.getByText(/封面照片沒有上傳成功/)).toBeVisible(slow);
    const failed = await prisma.classSession.findFirstOrThrow({ where: { title: `壞檔案 ${id}` } });
    expect(failed.coverPhotoId).toBeNull();
  });

  test("with the photo library full, uploading from the form is not offered", async ({ page, context }, testInfo) => {
    const { teacher } = await seedTeacherWithPhotos("form-full", testInfo, 5);
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/classes/new");
    await expect(page.getByText("照片已經放滿 5 張", { exact: false }).first()).toBeVisible(slow);
    await expect(page.locator("#single-coverUpload")).toHaveCount(0);
  });

  test("editing keeps the cover by default, can change it, and can remove it; a series session edits the whole series' cover", async ({ page, context }, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("form-edit", testInfo);
    const single = await seedSingleClass(teacher.teacherProfileId, `改封面 ${runId(testInfo, "e")}`);
    await setCoverCore(teacher.teacherProfileId, { kind: "session", id: single.id }, photos[0]);
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto(`/teacher/classes/${single.id}/edit`);
    await waitForHydrated(page.locator("#title"));
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(/result=success/, { timeout: 30_000 });
    expect(await coverOf(single.id)).toBe(photos[0]);

    await page.goto(`/teacher/classes/${single.id}/edit`);
    await waitForHydrated(page.locator("#title"));
    await page.getByRole("img", { name: "第 2 張照片" }).first().click();
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(/result=success/, { timeout: 30_000 });
    expect(await coverOf(single.id)).toBe(photos[1]);

    await page.goto(`/teacher/classes/${single.id}/edit`);
    await waitForHydrated(page.locator("#title"));
    await page.getByText("不放封面", { exact: true }).first().click();
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(/result=success/, { timeout: 30_000 });
    expect(await coverOf(single.id)).toBeNull();

    const { series, sessions } = await seedContinuous(teacher.teacherProfileId, { count: 2, title: `系列封面 ${runId(testInfo, "s")}` });
    await prisma.classSession.updateMany({ where: { recurringClassSeriesId: series.id }, data: { isPublic: true } });
    await page.goto(`/teacher/classes/${sessions[0].id}/edit`);
    await waitForHydrated(page.locator("#title"));
    await expect(page.getByText("這堂課屬於系列，封面是整個系列共用的。")).toBeVisible(slow);
    await page.getByRole("img", { name: "第 1 張照片" }).first().click();
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page).toHaveURL(/result=success/, { timeout: 30_000 });
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).coverPhotoId).toBe(photos[0]);
    expect(await coverOf(sessions[0].id)).toBeNull();
  });

  test("the delete dialog on the photos page says how many classes use the photo as a cover", async ({ page, context }, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("form-usage", testInfo);
    const single = await seedSingleClass(teacher.teacherProfileId, `用量 ${runId(testInfo, "u")}`);
    const { series } = await seedContinuous(teacher.teacherProfileId, { count: 2 });
    await setCoverCore(teacher.teacherProfileId, { kind: "session", id: single.id }, photos[0]);
    await setCoverCore(teacher.teacherProfileId, { kind: "series", id: series.id }, photos[0]);
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/profile/photos");
    const open = page.getByRole("button", { name: "刪除第 1 張照片" });
    await waitForHydrated(open);
    await open.click();
    await expect(page.getByText("這張照片目前是1 堂單堂課與 1 個系列的封面", { exact: false })).toBeVisible(slow);
  });
});
