import { expect, test } from "@playwright/test";
import sharp from "sharp";

import {
  clearAvatarCore,
  deleteTeacherPhotoCore,
  movePhotoCore,
  setAvatarCore,
  uploadTeacherPhotoCore,
} from "../../src/domain/teacher-photo/__internal__/photo-core";
import { createLocalStorage } from "../../src/lib/storage/photo-storage";
import { waitForHydrated } from "./_helpers/hydration";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { E2E_LOCAL_STORAGE_DIR } from "./_helpers/storage";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-showcase-photos 票 03：老師照片管理（頭像、排序、刪除）與舊的貼網址欄位退場。
const fixtures = createTermFixtures("teacher-photo-management-smoke.local");
const { runId, seedTeacher } = fixtures;
const storage = createLocalStorage(E2E_LOCAL_STORAGE_DIR);

// 上傳要跑縮圖，機器忙的時候超過預設的 5 秒等待；這個檔案的畫面步驟放寬到 30 秒。
test.setTimeout(120_000);
const slow = { timeout: 30_000 };

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const jpeg = (color: string, width = 600, height = 400) =>
  sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();

async function seedWithPhotos(label: string, testInfo: Parameters<typeof runId>[0], count: number) {
  const teacher = await seedTeacher(runId(testInfo, label));
  const photos: { photoId: string; storageKey: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = await uploadTeacherPhotoCore(teacher.teacherProfileId, await jpeg(["#a33", "#3a3", "#33a", "#aa3", "#3aa"][index % 5]), storage);
    if (!result.ok) throw new Error("fixture");
    photos.push({ photoId: result.photoId, storageKey: result.storageKey });
  }

  return { teacher, photos };
}

const avatarOf = async (teacherProfileId: string) =>
  (await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacherProfileId }, select: { avatarPhotoId: true } })).avatarPhotoId;
const orderOf = async (teacherProfileId: string) =>
  (await prisma.teacherPhoto.findMany({ where: { teacherProfileId, status: "active" }, orderBy: { sortOrder: "asc" }, select: { id: true } })).map((photo) => photo.id);

test.describe("avatar and ordering (domain)", () => {
  test("only an own active photo can become the avatar; clearing and deleting the avatar photo leave no avatar", async ({}, testInfo) => {
    const { teacher, photos } = await seedWithPhotos("avatar", testInfo, 2);
    const stranger = await seedWithPhotos("avatar-stranger", testInfo, 1);

    expect(await avatarOf(teacher.teacherProfileId)).toBeNull();
    expect(await setAvatarCore(teacher.teacherProfileId, stranger.photos[0].photoId)).toEqual({ ok: false, code: "photo_not_found" });
    expect(await setAvatarCore(teacher.teacherProfileId, "no-such-photo")).toEqual({ ok: false, code: "photo_not_found" });
    expect(await avatarOf(teacher.teacherProfileId)).toBeNull();

    expect(await setAvatarCore(teacher.teacherProfileId, photos[0].photoId)).toEqual({ ok: true });
    expect(await avatarOf(teacher.teacherProfileId)).toBe(photos[0].photoId);
    expect(await setAvatarCore(teacher.teacherProfileId, photos[1].photoId)).toEqual({ ok: true });
    expect(await avatarOf(teacher.teacherProfileId)).toBe(photos[1].photoId);

    expect(await clearAvatarCore(teacher.teacherProfileId)).toEqual({ ok: true });
    expect(await avatarOf(teacher.teacherProfileId)).toBeNull();

    // 頭像照片被刪掉：頭像自動回到空（外鍵），不留指向不存在照片的欄位
    expect(await setAvatarCore(teacher.teacherProfileId, photos[0].photoId)).toEqual({ ok: true });
    expect(await deleteTeacherPhotoCore(teacher.teacherProfileId, photos[0].photoId, storage)).toEqual({ ok: true });
    expect(await avatarOf(teacher.teacherProfileId)).toBeNull();

    // 管理員下架的照片不能被設成頭像
    await prisma.teacherPhoto.update({ where: { id: photos[1].photoId }, data: { status: "removed_by_admin", removedAt: new Date() } });
    expect(await setAvatarCore(teacher.teacherProfileId, photos[1].photoId)).toEqual({ ok: false, code: "photo_not_found" });
  });

  test("move up and down swap neighbours, the ends stay put, other teachers' photos are untouched, and sort orders are normalised", async ({}, testInfo) => {
    const { teacher, photos } = await seedWithPhotos("order", testInfo, 4);
    const other = await seedWithPhotos("order-other", testInfo, 2);
    const ids = photos.map((photo) => photo.photoId);
    const otherBefore = await orderOf(other.teacher.teacherProfileId);

    expect(await orderOf(teacher.teacherProfileId)).toEqual(ids);
    expect(await movePhotoCore(teacher.teacherProfileId, ids[2], "up")).toEqual({ ok: true });
    expect(await orderOf(teacher.teacherProfileId)).toEqual([ids[0], ids[2], ids[1], ids[3]]);
    expect(await movePhotoCore(teacher.teacherProfileId, ids[0], "up")).toEqual({ ok: true });
    expect(await movePhotoCore(teacher.teacherProfileId, ids[3], "down")).toEqual({ ok: true });
    expect(await orderOf(teacher.teacherProfileId)).toEqual([ids[0], ids[2], ids[1], ids[3]]);
    expect(await movePhotoCore(teacher.teacherProfileId, ids[0], "down")).toEqual({ ok: true });
    expect(await orderOf(teacher.teacherProfileId)).toEqual([ids[2], ids[0], ids[1], ids[3]]);

    expect(await movePhotoCore(teacher.teacherProfileId, other.photos[0].photoId, "down")).toEqual({ ok: false, code: "photo_not_found" });
    expect(await orderOf(other.teacher.teacherProfileId)).toEqual(otherBefore);

    // 重複與空洞的 sortOrder 會被整理成 0..n-1
    await prisma.teacherPhoto.updateMany({ where: { teacherProfileId: teacher.teacherProfileId }, data: { sortOrder: 7 } });
    expect(await movePhotoCore(teacher.teacherProfileId, ids[1], "up")).toEqual({ ok: true });
    const orders = (await prisma.teacherPhoto.findMany({ where: { teacherProfileId: teacher.teacherProfileId }, select: { sortOrder: true } })).map((photo) => photo.sortOrder).sort();
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  test("two moves at once still end with a consistent, gap-free order", async ({}, testInfo) => {
    const { teacher, photos } = await seedWithPhotos("order-race", testInfo, 4);
    await Promise.all([
      movePhotoCore(teacher.teacherProfileId, photos[3].photoId, "up"),
      movePhotoCore(teacher.teacherProfileId, photos[0].photoId, "down"),
    ]);
    const rows = await prisma.teacherPhoto.findMany({ where: { teacherProfileId: teacher.teacherProfileId }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(4);
  });
});

test.describe("photos page", () => {
  test("uploads a photo, shows it, sets it as the avatar, reorders and deletes with confirmation", async ({ page, context }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "page"));
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/profile/photos");
    await expect(page.getByRole("link", { name: "照片", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "上傳照片（0 / 5）" })).toBeVisible(slow);
    await expect(page.getByText("照片裡若有其他學員的臉，請先取得對方同意。")).toBeVisible(slow);
    await expect(page.getByRole("heading", { name: "我的照片" })).toHaveCount(0);

    for (const [index, color] of ["#c44", "#4c4"].entries()) {
      await waitForHydrated(page.locator("#photo"));
      await page.locator("#photo").setInputFiles({ name: `photo-${index}.jpg`, mimeType: "image/jpeg", buffer: await jpeg(color, 1200, 800) });
      await page.getByRole("button", { name: "上傳" }).click();
      await expect(page.getByText("照片已上傳。")).toBeVisible(slow);
      await expect(page.getByRole("heading", { name: `上傳照片（${index + 1} / 5）` })).toBeVisible(slow);
    }

    const images = page.locator("li[data-photo-id] img");
    await expect(images).toHaveCount(2);
    // 照片真的載入（經過 /media 路由）
    await expect.poll(() => images.first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await images.first().getAttribute("src")).toMatch(/^\/media\/photos\/[0-9a-f-]{36}\.webp$/);

    await page.getByRole("button", { name: "設為頭像" }).first().click();
    await expect(page.getByText("已設為頭像。")).toBeVisible(slow);
    await expect(page.getByText("頭像", { exact: true })).toHaveCount(1);
    expect(await avatarOf(teacher.teacherProfileId)).not.toBeNull();

    const firstId = await page.locator("li[data-photo-id]").first().getAttribute("data-photo-id");
    await page.getByRole("button", { name: "第 1 張照片往後移" }).click();
    await expect(page.getByText("已調整順序。")).toBeVisible(slow);
    expect(await page.locator("li[data-photo-id]").last().getAttribute("data-photo-id")).toBe(firstId);

    const deleteButton = page.getByRole("button", { name: "刪除第 1 張照片" });
    await waitForHydrated(deleteButton);
    await deleteButton.click();
    await page.getByRole("button", { name: "確定刪除" }).click();
    await expect(page.getByText("照片已刪除。")).toBeVisible(slow);
    await expect(page.locator("li[data-photo-id]")).toHaveCount(1);
  });

  test("a bad file is rejected with a plain explanation and stores nothing", async ({ page, context }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "page-bad"));
    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/profile/photos");
    await waitForHydrated(page.locator("#photo"));

    await page.locator("#photo").setInputFiles({ name: "not-a-photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("這不是照片") });
    await page.getByRole("button", { name: "上傳" }).click();
    await expect(page.getByText("這個檔案無法讀取成照片，請換一張再試。")).toBeVisible(slow);
    expect(await prisma.teacherPhoto.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(0);
  });

  test("an unapproved teacher sees an explanation; a suspended teacher can look but not change", async ({ page, context }, testInfo) => {
    const submitted = await seedTeacher(runId(testInfo, "page-submitted"));
    await prisma.teacherProfile.update({ where: { id: submitted.teacherProfileId }, data: { status: "submitted" } });
    await addAuthSessionCookie(context, submitted.sessionToken);
    await page.goto("/teacher/profile/photos");
    await expect(page.getByRole("heading", { name: "通過老師審核後就能上傳照片" })).toBeVisible(slow);
    await expect(page.locator("#photo")).toHaveCount(0);

    const { teacher } = await seedWithPhotos("page-suspended", testInfo, 1);
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    const suspendedContext = await context.browser()!.newContext({ baseURL: testInfo.project.use.baseURL });
    await addAuthSessionCookie(suspendedContext, teacher.sessionToken);
    const suspendedPage = await suspendedContext.newPage();
    await suspendedPage.goto("/teacher/profile/photos");
    await expect(suspendedPage.getByText("帳號目前暫停中，暫時無法上傳新照片，但可以查看既有照片。")).toBeVisible(slow);
    await expect(suspendedPage.locator("li[data-photo-id] img")).toHaveCount(1);
    await expect(suspendedPage.getByRole("button", { name: "設為頭像" })).toHaveCount(0);
    await expect(suspendedPage.getByRole("button", { name: /刪除第/ })).toHaveCount(0);
    await suspendedContext.close();
  });
});

test.describe("the old photo URL field is retired", () => {
  test("the application form and the info page no longer ask for a photo URL, and saving the profile keeps the legacy value", async ({ page, context }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "legacy"));
    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { profilePhotoUrl: "https://example.com/old.jpg", experienceYears: 5, teachingStyle: "穩定清楚", bio: "簡介", certifications: ["RYT200"], serviceAreas: ["台北市"] },
    });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/profile/info");
    await expect(page.getByLabel(/老師照片連結/)).toHaveCount(0);
    await expect(page.getByText("老師照片連結")).toHaveCount(0);
    await page.getByText("陰瑜伽", { exact: true }).click();
    const save = page.getByRole("button", { name: "儲存變更" });
    await waitForHydrated(save);
    await save.click();
    await expect(page.getByText("老師資料已儲存。")).toBeVisible(slow);
    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId } })).profilePhotoUrl).toBe("https://example.com/old.jpg");

    await page.goto("/teachers/join");
    await expect(page.getByText("老師照片連結")).toHaveCount(0);
  });
});
