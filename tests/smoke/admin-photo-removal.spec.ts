import { stat } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { EMAIL_POLICY } from "../../src/domain/notification/email-policy";
import { setCoverCore } from "../../src/domain/teacher-photo/__internal__/cover-core";
import { removeTeacherPhotoForAdminCore } from "../../src/domain/teacher-photo/__internal__/admin-remove-core";
import { setAvatarCore, uploadTeacherPhotoCore } from "../../src/domain/teacher-photo/__internal__/photo-core";
import { createLocalStorage } from "../../src/lib/storage/photo-storage";
import { waitForHydrated } from "./_helpers/hydration";
import { addAuthSessionCookie, cleanupOrganizerDemandFixtures, createUserSession, prisma } from "./_helpers/organizer-demand-fixtures";
import { E2E_LOCAL_STORAGE_DIR } from "./_helpers/storage";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-showcase-photos 票 07（spec S5）：管理員下架照片——立即從所有頁面消失、頭像與封面一併拿掉、
// 原因必填並以站內通知告訴老師（不寄 email）、下架的不算在 5 張上限裡。
const fixtures = createTermFixtures("admin-photo-removal-smoke.local");
const { runId, seedTeacher, seedContinuous } = fixtures;
const storage = createLocalStorage(E2E_LOCAL_STORAGE_DIR);
const adminEmails: string[] = [];

test.setTimeout(120_000);
const slow = { timeout: 30_000 };

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(adminEmails);
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const jpeg = (color: string) => sharp({ create: { width: 800, height: 500, channels: 3, background: color } }).jpeg().toBuffer();
const fileOf = (key: string) => path.join(E2E_LOCAL_STORAGE_DIR, key);

async function seedTeacherWithPhotos(label: string, testInfo: Parameters<typeof runId>[0], count = 2) {
  const teacher = await seedTeacher(runId(testInfo, label));
  const photos: { photoId: string; storageKey: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const uploaded = await uploadTeacherPhotoCore(teacher.teacherProfileId, await jpeg(["#c44", "#4c4", "#44c"][index % 3]), storage);
    if (!uploaded.ok) throw new Error("fixture");
    photos.push({ photoId: uploaded.photoId, storageKey: uploaded.storageKey });
  }

  return { teacher, photos };
}

test.describe("removal rules (domain)", () => {
  test("the reason is required (5–500 characters); a valid removal marks the record, removes the file, and frees the slot", async ({}, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("rules", testInfo, 5);
    const target = photos[0];

    for (const bad of [null, undefined, "", "   ", "太短", "字".repeat(501)]) {
      expect(await removeTeacherPhotoForAdminCore(target.photoId, "admin-1", bad, storage)).toEqual({ ok: false, code: "reason_invalid" });
    }
    expect((await prisma.teacherPhoto.findUniqueOrThrow({ where: { id: target.photoId } })).status).toBe("active");
    expect(await removeTeacherPhotoForAdminCore("nope", "admin-1", "照片不適當", storage)).toEqual({ ok: false, code: "photo_not_found" });

    const removed = await removeTeacherPhotoForAdminCore(target.photoId, "admin-1", "  照片中有其他人的臉  ", storage);
    expect(removed).toMatchObject({ ok: true, teacherProfileId: teacher.teacherProfileId, teacherUserId: teacher.userId, reason: "照片中有其他人的臉" });
    expect(await prisma.teacherPhoto.findUniqueOrThrow({ where: { id: target.photoId } })).toMatchObject({
      status: "removed_by_admin",
      removedReason: "照片中有其他人的臉",
      removedByUserId: "admin-1",
    });
    await expect(stat(fileOf(target.storageKey))).rejects.toThrow();
    await expect(stat(fileOf(photos[1].storageKey))).resolves.toBeTruthy();

    // 已下架不能再下架；下架的不算在 5 張上限裡，老師可以再上傳一張
    expect(await removeTeacherPhotoForAdminCore(target.photoId, "admin-2", "再下架一次看看", storage)).toEqual({ ok: false, code: "photo_not_active" });
    expect((await uploadTeacherPhotoCore(teacher.teacherProfileId, await jpeg("#ccc"), storage)).ok).toBe(true);
  });

  test("the avatar and every cover that used the photo are cleared in the same step, and the classes stay", async ({}, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("covers", testInfo, 2);
    const session = await prisma.classSession.create({
      data: {
        origin: "teacher_initiated", teacherProfileId: teacher.teacherProfileId, title: `封面單堂 ${runId(testInfo, "x")}`, serviceType: "放鬆紓壓", serviceTypes: ["放鬆紓壓"],
        startAt: new Date(Date.now() + 9 * 86_400_000), endAt: new Date(Date.now() + 9 * 86_400_000 + 3_600_000), location: "教室", capacity: 5, status: "open_for_enrollment", isPublic: true,
      },
    });
    const { series } = await seedContinuous(teacher.teacherProfileId, { count: 2 });
    await setAvatarCore(teacher.teacherProfileId, photos[0].photoId);
    await setCoverCore(teacher.teacherProfileId, { kind: "session", id: session.id }, photos[0].photoId);
    await setCoverCore(teacher.teacherProfileId, { kind: "series", id: series.id }, photos[0].photoId);

    expect(await removeTeacherPhotoForAdminCore(photos[0].photoId, "admin-1", "不適當的內容", storage)).toMatchObject({ ok: true });

    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId } })).avatarPhotoId).toBeNull();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: session.id } })).coverPhotoId).toBeNull();
    expect((await prisma.recurringClassSeries.findUniqueOrThrow({ where: { id: series.id } })).coverPhotoId).toBeNull();
    expect(await prisma.classSession.count({ where: { id: session.id } })).toBe(1);
  });

  test("two admins removing the same photo at once: exactly one wins", async ({}, testInfo) => {
    const { photos } = await seedTeacherWithPhotos("race", testInfo, 1);
    const results = await Promise.all([
      removeTeacherPhotoForAdminCore(photos[0].photoId, "admin-1", "第一位管理員的原因", storage),
      removeTeacherPhotoForAdminCore(photos[0].photoId, "admin-2", "第二位管理員的原因", storage),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: "photo_not_active" }]);
  });

  test("the notification is in-app only: the email policy for this type is empty", () => {
    expect(EMAIL_POLICY.teacher_photo_removed).toEqual([]);
  });
});

test.describe("admin page", () => {
  async function seedAdmin(testInfo: Parameters<typeof runId>[0], label: string) {
    const email = `admin-${runId(testInfo, label)}@admin-photo-removal-smoke.local`;
    adminEmails.push(email);

    return createUserSession({ email, isAdmin: true });
  }

  test("the admin removes a photo with a reason; it disappears everywhere and the teacher is notified in-app", async ({ page, context, browser }, testInfo) => {
    const { teacher, photos } = await seedTeacherWithPhotos("ui", testInfo, 2);
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { isPublicPageEnabled: true } });
    await setAvatarCore(teacher.teacherProfileId, photos[0].photoId);
    const admin = await seedAdmin(testInfo, "ui");
    await addAuthSessionCookie(context, admin.sessionToken);

    // 下架前：公開老師頁看得到頭像與兩張照片
    const visitor = await browser.newPage();
    await visitor.goto(`${testInfo.project.use.baseURL}/teachers/${teacher.teacherProfileId}`);
    await expect(visitor.getByRole("img", { name: /的頭像/ })).toHaveCount(1, slow);
    await expect(visitor.getByRole("img", { name: /的照片/ })).toHaveCount(2);

    await page.goto(`/admin/teachers/${teacher.teacherProfileId}`);
    await expect(page.getByRole("heading", { name: "老師的照片（2）" })).toBeVisible(slow);
    const firstReason = page.getByLabel("下架原因（必填，老師會看到）").first();
    await waitForHydrated(firstReason);
    await firstReason.fill("照片中有其他學員的臉，無法確認對方同意。");
    await page.getByRole("button", { name: "下架這張照片" }).first().click();
    await page.getByRole("button", { name: "確認下架這張照片" }).click();

    await expect(page.getByText("已下架這張照片，老師會收到通知。")).toBeVisible(slow);
    await expect(page.getByRole("heading", { name: "老師的照片（1）" })).toBeVisible();
    await expect(page.getByText("下架原因：照片中有其他學員的臉，無法確認對方同意。")).toBeVisible();

    // 資料與公開頁：頭像一併拿掉、被下架的那張消失
    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId } })).avatarPhotoId).toBeNull();
    await visitor.reload();
    await expect(visitor.getByRole("img", { name: /的頭像/ })).toHaveCount(0);
    await expect(visitor.getByRole("img", { name: /的照片/ })).toHaveCount(1);
    await visitor.close();

    // 老師收到站內通知（沒有 email），通知連到照片頁；照片頁只剩一張
    const notice = await prisma.notification.findFirstOrThrow({ where: { userId: teacher.userId, type: "teacher_photo_removed" } });
    expect(notice.body).toContain("照片中有其他學員的臉，無法確認對方同意。");
    const teacherContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/teacher/notifications");
    await expect(teacherPage.getByText("有一張照片已被下架")).toBeVisible(slow);
    await expect(teacherPage.getByRole("link", { name: "前往我的照片" })).toHaveAttribute("href", "/teacher/profile/photos");
    await teacherPage.goto("/teacher/profile/photos");
    await expect(teacherPage.getByRole("heading", { name: "上傳照片（1 / 5）" })).toBeVisible(slow);
    await teacherContext.close();
  });

  test("a teacher (not an admin) cannot open the admin teacher page", async ({ page, context }, testInfo) => {
    const { teacher } = await seedTeacherWithPhotos("not-admin", testInfo, 1);
    await addAuthSessionCookie(context, teacher.sessionToken);

    expect((await page.goto(`/admin/teachers/${teacher.teacherProfileId}`))?.status()).toBe(404);
  });
});
