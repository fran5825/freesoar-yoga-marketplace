import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { deleteTeacherPhotoCore, TEACHER_PHOTO_MAX_COUNT, uploadTeacherPhotoCore } from "../../src/domain/teacher-photo/__internal__/photo-core";
import { PHOTO_MAX_BYTES, PHOTO_MAX_EDGE, processPhotoUpload } from "../../src/domain/teacher-photo/process-image";
import { createLocalStorage, createR2Storage, getPhotoStorage, isValidPhotoKey } from "../../src/lib/storage/photo-storage";
import { prisma } from "./_helpers/organizer-demand-fixtures";
import { E2E_LOCAL_STORAGE_DIR } from "./_helpers/storage";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-showcase-photos 票 02：照片檢查與縮圖、儲存層、上傳與刪除核心。
const fixtures = createTermFixtures("teacher-photo-foundation-smoke.local");
const { runId, seedTeacher } = fixtures;
const directories: string[] = [];

test.afterAll(async () => {
  await fixtures.cleanup();
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
  await prisma.$disconnect();
});

async function localStorageDir() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "photo-storage-"));
  directories.push(directory);

  return directory;
}

const solid = (width: number, height: number, format: "jpeg" | "png" | "webp" = "jpeg") =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 90 } } })
    .toFormat(format)
    .toBuffer();

test.describe("process photo upload", () => {
  test("accepts JPG, PNG and WebP, shrinks the long edge to 1600 px, never enlarges, and outputs WebP", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const big = await processPhotoUpload(await solid(3200, 2000, format));
      expect(big).toMatchObject({ ok: true, contentType: "image/webp", width: PHOTO_MAX_EDGE, height: 1000 });
      expect((await sharp((big as { body: Buffer }).body).metadata()).format).toBe("webp");
    }

    const small = await processPhotoUpload(await solid(400, 300));
    expect(small).toMatchObject({ ok: true, width: 400, height: 300 });
  });

  test("rejects other formats by what the bytes really are, not by name: GIF, SVG, text and truncated files", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).gif().toBuffer();
    expect(await processPhotoUpload(gif)).toEqual({ ok: false, code: "unsupported_format" });
    expect(await processPhotoUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))).toMatchObject({ ok: false });
    expect(await processPhotoUpload(Buffer.from("這不是照片"))).toEqual({ ok: false, code: "unreadable" });
    expect(await processPhotoUpload(Buffer.alloc(0))).toEqual({ ok: false, code: "unreadable" });
    const jpeg = await solid(300, 300);
    expect(await processPhotoUpload(jpeg.subarray(0, 40))).toEqual({ ok: false, code: "unreadable" });
  });

  test("rejects files over 5 MB and images with an absurd pixel count", async () => {
    expect(await processPhotoUpload(Buffer.alloc(PHOTO_MAX_BYTES + 1))).toEqual({ ok: false, code: "too_large" });
    // 檔案很小、解開來超過像素上限（8000×8000 純色 PNG 壓縮後很小）
    const huge = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(huge.length).toBeLessThan(PHOTO_MAX_BYTES);
    expect(await processPhotoUpload(huge)).toEqual({ ok: false, code: "too_many_pixels" });
  });

  test("camera metadata (GPS, device) is stripped and rotation is applied", async () => {
    const withExif = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#456" } })
      .withExif({ IFD0: { Make: "SecretCameraMaker" }, IFD3: { GPSLatitudeRef: "N" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeTruthy();

    const result = await processPhotoUpload(withExif);
    expect(result.ok).toBe(true);
    const output = (result as { body: Buffer }).body;
    expect((await sharp(output).metadata()).exif).toBeUndefined();
    expect(output.includes(Buffer.from("SecretCameraMaker"))).toBe(false);

    // 相機方向 6＝需要順時針轉 90 度：寬 200 高 100 的原圖，輸出應該變成寬 100 高 200
    const rotated = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#456" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect(await processPhotoUpload(rotated)).toMatchObject({ ok: true, width: 100, height: 200 });
  });
});

test.describe("photo storage", () => {
  test("nothing configured (the default) means the feature is off, never a silent write to the host disk", () => {
    expect(getPhotoStorage({})).toEqual({ ok: false, reason: "not_configured" });
    expect(getPhotoStorage({ STORAGE_DRIVER: "r2" })).toEqual({ ok: false, reason: "not_configured" });
    expect(getPhotoStorage({ STORAGE_DRIVER: "r2", R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })).toEqual({ ok: false, reason: "not_configured" });
    expect(getPhotoStorage({ STORAGE_DRIVER: "s3" })).toEqual({ ok: false, reason: "not_configured" });
    expect(getPhotoStorage({ STORAGE_DRIVER: "local" })).toMatchObject({ ok: true, driver: "local" });
    expect(
      getPhotoStorage({ STORAGE_DRIVER: "r2", R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d", R2_PUBLIC_BASE_URL: "https://img.example.com/" }),
    ).toMatchObject({ ok: true, driver: "r2" });
  });

  test("only application-generated keys are accepted (no path traversal)", () => {
    expect(isValidPhotoKey("photos/123e4567-e89b-42d3-a456-426614174000.webp")).toBe(true);
    for (const bad of ["../etc/passwd", "photos/../x.webp", "photos/abc.webp", "/photos/123e4567-e89b-42d3-a456-426614174000.webp", "photos/123e4567-e89b-42d3-a456-426614174000.png", "teachers/amy.webp"]) {
      expect(isValidPhotoKey(bad)).toBe(false);
    }
  });

  test("the local driver writes, serves the URL, deletes, and ignores a missing file", async () => {
    const directory = await localStorageDir();
    const storage = createLocalStorage(directory);
    const key = "photos/123e4567-e89b-42d3-a456-426614174000.webp";

    await storage.put(key, Buffer.from("data"), "image/webp");
    expect((await readFile(path.join(directory, key))).toString()).toBe("data");
    expect(storage.publicUrl(key)).toBe(`/media/${key}`);
    await storage.delete(key);
    await expect(stat(path.join(directory, key))).rejects.toThrow();
    await storage.delete(key);
    await expect(storage.put("../escape.webp", Buffer.from("x"), "image/webp")).rejects.toThrow("Invalid photo storage key");
  });

  test("the R2 driver sends the right commands and builds public URLs without a trailing slash", async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = [];
    const storage = createR2Storage(
      { accountId: "acct", accessKeyId: "k", secretAccessKey: "s", bucket: "teacher-photos", publicBaseUrl: "https://img.example.com/" },
      { send: async (command) => { sent.push({ name: (command as { constructor: { name: string } }).constructor.name, input: (command as { input: Record<string, unknown> }).input }); return {}; } },
    );
    const key = "photos/123e4567-e89b-42d3-a456-426614174000.webp";

    await storage.put(key, Buffer.from("x"), "image/webp");
    await storage.delete(key);

    expect(sent[0]).toMatchObject({ name: "PutObjectCommand", input: { Bucket: "teacher-photos", Key: key, ContentType: "image/webp" } });
    expect(String(sent[0].input.CacheControl)).toContain("immutable");
    expect(sent[1]).toMatchObject({ name: "DeleteObjectCommand", input: { Bucket: "teacher-photos", Key: key } });
    expect(storage.publicUrl(key)).toBe(`https://img.example.com/${key}`);
    expect(() => storage.publicUrl("../x")).toThrow("Invalid photo storage key");
  });
});

test.describe("upload and delete core", () => {
  test("an approved teacher uploads: random key, processed size, sort order grows, the file exists", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "upload"));
    const directory = await localStorageDir();
    const storage = createLocalStorage(directory);

    const first = await uploadTeacherPhotoCore(teacher.teacherProfileId, await solid(2400, 1200), storage);
    const second = await uploadTeacherPhotoCore(teacher.teacherProfileId, await solid(800, 800, "png"), storage);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(isValidPhotoKey(first.storageKey)).toBe(true);
    expect(first.storageKey).not.toContain(teacher.teacherProfileId);
    expect(first.storageKey).not.toBe(second.storageKey);
    expect(await prisma.teacherPhoto.findUniqueOrThrow({ where: { id: first.photoId } })).toMatchObject({ width: 1600, height: 800, sortOrder: 0, status: "active", storageKey: first.storageKey });
    expect((await prisma.teacherPhoto.findUniqueOrThrow({ where: { id: second.photoId } })).sortOrder).toBe(1);
    expect((await stat(path.join(directory, first.storageKey))).size).toBeGreaterThan(0);
  });

  test("not approved teachers cannot upload, and a rejected upload leaves no file behind", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "not-approved"));
    await prisma.teacherProfile.update({ where: { id: teacher.teacherProfileId }, data: { status: "suspended" } });
    const directory = await localStorageDir();

    expect(await uploadTeacherPhotoCore(teacher.teacherProfileId, await solid(300, 300), createLocalStorage(directory))).toEqual({ ok: false, code: "teacher_not_approved" });
    expect(await prisma.teacherPhoto.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(0);
    await expect(readFile(path.join(directory, "photos"))).rejects.toBeTruthy();
  });

  test("at most 5 active photos, even when 8 uploads arrive at the same moment; extra files are removed from storage", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "limit"));
    const directory = await localStorageDir();
    const storage = createLocalStorage(directory);
    const image = await solid(500, 500);

    const results = await Promise.all(Array.from({ length: 8 }, () => uploadTeacherPhotoCore(teacher.teacherProfileId, image, storage)));

    expect(results.filter((result) => result.ok)).toHaveLength(TEACHER_PHOTO_MAX_COUNT);
    expect(results.filter((result) => !result.ok)).toEqual(Array.from({ length: 3 }, () => ({ ok: false, code: "photo_limit_reached" })));
    const rows = await prisma.teacherPhoto.findMany({ where: { teacherProfileId: teacher.teacherProfileId } });
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.sortOrder)).size).toBe(5);
    // 倉庫裡只剩下有紀錄的 5 個檔案
    const { readdir } = await import("node:fs/promises");
    expect((await readdir(path.join(directory, "photos"))).sort()).toEqual(rows.map((row) => row.storageKey.replace("photos/", "")).sort());
  });

  test("removed photos do not count toward the limit; a storage failure stores nothing", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "removed"));
    const storage = createLocalStorage(await localStorageDir());
    const image = await solid(300, 300);
    const uploaded = [];
    for (let index = 0; index < 5; index += 1) uploaded.push(await uploadTeacherPhotoCore(teacher.teacherProfileId, image, storage));
    expect(await uploadTeacherPhotoCore(teacher.teacherProfileId, image, storage)).toEqual({ ok: false, code: "photo_limit_reached" });

    const first = uploaded[0];
    if (!first.ok) throw new Error("fixture");
    await prisma.teacherPhoto.update({ where: { id: first.photoId }, data: { status: "removed_by_admin", removedAt: new Date() } });
    expect((await uploadTeacherPhotoCore(teacher.teacherProfileId, image, storage)).ok).toBe(true);

    const failing = { ...storage, put: async () => { throw new Error("boom"); } };
    const before = await prisma.teacherPhoto.count({ where: { teacherProfileId: teacher.teacherProfileId } });
    expect(await uploadTeacherPhotoCore(teacher.teacherProfileId, image, failing)).toEqual({ ok: false, code: "storage_failed" });
    expect(await prisma.teacherPhoto.count({ where: { teacherProfileId: teacher.teacherProfileId } })).toBe(before);
  });

  test("delete removes the record and the file, only for the owner; a failing file delete does not bring the photo back", async ({}, testInfo) => {
    const id = runId(testInfo, "delete");
    const teacher = await seedTeacher(id);
    const other = await seedTeacher(`${id}-other`);
    const directory = await localStorageDir();
    const storage = createLocalStorage(directory);
    const uploaded = await uploadTeacherPhotoCore(teacher.teacherProfileId, await solid(300, 300), storage);
    if (!uploaded.ok) throw new Error("fixture");

    expect(await deleteTeacherPhotoCore(other.teacherProfileId, uploaded.photoId, storage)).toEqual({ ok: false, code: "photo_not_found" });
    expect(await prisma.teacherPhoto.count({ where: { id: uploaded.photoId } })).toBe(1);

    expect(await deleteTeacherPhotoCore(teacher.teacherProfileId, uploaded.photoId, storage)).toEqual({ ok: true });
    expect(await prisma.teacherPhoto.count({ where: { id: uploaded.photoId } })).toBe(0);
    await expect(stat(path.join(directory, uploaded.storageKey))).rejects.toThrow();
    expect(await deleteTeacherPhotoCore(teacher.teacherProfileId, uploaded.photoId, storage)).toEqual({ ok: false, code: "photo_not_found" });

    const second = await uploadTeacherPhotoCore(teacher.teacherProfileId, await solid(300, 300), storage);
    if (!second.ok) throw new Error("fixture");
    const brokenDelete = { ...storage, delete: async () => { throw new Error("storage down"); } };
    expect(await deleteTeacherPhotoCore(teacher.teacherProfileId, second.photoId, brokenDelete)).toEqual({ ok: true });
    expect(await prisma.teacherPhoto.count({ where: { id: second.photoId } })).toBe(0);
  });

  test("deleting the teacher profile removes the photo records (cascade)", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "cascade"));
    const storage = createLocalStorage(await localStorageDir());
    const uploaded = await uploadTeacherPhotoCore(teacher.teacherProfileId, await solid(300, 300), storage);
    if (!uploaded.ok) throw new Error("fixture");

    await prisma.user.delete({ where: { id: teacher.userId } });
    expect(await prisma.teacherPhoto.count({ where: { id: uploaded.photoId } })).toBe(0);
  });
});

test.describe("/media route (local driver, dev and test only)", () => {
  test("serves a stored photo with long-lived caching; any other path or an unknown key is 404", async ({ request }) => {
    const storage = createLocalStorage(E2E_LOCAL_STORAGE_DIR);
    const key = "photos/123e4567-e89b-42d3-a456-426614174099.webp";
    const body = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#123" } }).webp().toBuffer();
    await storage.put(key, body, "image/webp");

    try {
      const ok = await request.get(`/media/${key}`);
      expect(ok.status()).toBe(200);
      expect(ok.headers()["content-type"]).toBe("image/webp");
      expect(ok.headers()["cache-control"]).toContain("immutable");
      expect((await ok.body()).length).toBe(body.length);

      expect((await request.get("/media/photos/123e4567-e89b-42d3-a456-426614174098.webp")).status()).toBe(404);
      expect((await request.get("/media/photos/..%2F..%2Fpackage.json")).status()).toBe(404);
      expect((await request.get("/media/package.json")).status()).toBe(404);
      expect((await request.get("/media/photos/not-a-uuid.webp")).status()).toBe(404);
    } finally {
      await storage.delete(key);
    }
  });
});
