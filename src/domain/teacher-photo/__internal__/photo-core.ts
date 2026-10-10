// __internal__：不是通用 API。給 teacher-photo/service.ts（auth 外層）與 Playwright 測試直接呼叫，
// 不做身分判斷，呼叫端必須已確認 teacherProfileId 是目前登入的老師本人。刻意不 import 任何登入相關模組。
//
// teacher-showcase-photos 票 02（ADR 0007、spec S2、S4）：
// - 老師最多 5 張「有效」照片（status = active）；上限檢查在鎖住這位老師資料列之後做，
//   同時上傳多張不會超過上限；
// - 檔案先寫進儲存服務、再寫資料庫；資料庫寫入失敗或超過上限時，把剛寫入的檔案刪掉（補償），
//   不留下沒有紀錄的檔案；
// - key 是隨機的（photos/<uuid>.webp），不含老師姓名、id 或原始檔名。

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { PhotoStorage } from "@/lib/storage/photo-storage";

import { processPhotoUpload, type ProcessPhotoErrorCode } from "../process-image";

export const TEACHER_PHOTO_MAX_COUNT = 5;

export type UploadPhotoErrorCode =
  | ProcessPhotoErrorCode
  | "teacher_not_approved"
  | "photo_limit_reached"
  | "storage_failed"
  | "upload_failed";

export type UploadPhotoResult =
  | { ok: true; photoId: string; storageKey: string; width: number; height: number }
  | { ok: false; code: UploadPhotoErrorCode };

class LimitReached extends Error {}
class NotApproved extends Error {}

export async function uploadTeacherPhotoCore(
  teacherProfileId: string,
  input: Buffer,
  storage: PhotoStorage,
): Promise<UploadPhotoResult> {
  const processed = await processPhotoUpload(input);

  if (!processed.ok) {
    return processed;
  }

  const storageKey = `photos/${randomUUID()}.webp`;

  try {
    await storage.put(storageKey, processed.body, processed.contentType);
  } catch (error) {
    console.error("[teacher-photo] storage put failed", error);

    return { ok: false, code: "storage_failed" };
  }

  try {
    const photo = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "TeacherProfile"
        WHERE "id" = ${teacherProfileId}
        FOR UPDATE
      `;

      if (locked.length === 0 || locked[0].status !== "approved") {
        throw new NotApproved();
      }

      const active = await tx.teacherPhoto.findMany({
        where: { teacherProfileId, status: "active" },
        select: { sortOrder: true },
      });

      if (active.length >= TEACHER_PHOTO_MAX_COUNT) {
        throw new LimitReached();
      }

      return tx.teacherPhoto.create({
        data: {
          teacherProfileId,
          storageKey,
          width: processed.width,
          height: processed.height,
          sortOrder: active.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1,
        },
        select: { id: true },
      });
    });

    return { ok: true, photoId: photo.id, storageKey, width: processed.width, height: processed.height };
  } catch (error) {
    await removeStoredFile(storage, storageKey);

    if (error instanceof NotApproved) {
      return { ok: false, code: "teacher_not_approved" };
    }

    if (error instanceof LimitReached) {
      return { ok: false, code: "photo_limit_reached" };
    }

    console.error("[teacher-photo] upload failed", error);

    return { ok: false, code: "upload_failed" };
  }
}

export type DeletePhotoResult = { ok: true } | { ok: false; code: "photo_not_found" | "delete_failed" };

// 老師刪除自己的照片：先刪資料庫（被課程封面或頭像引用的欄位會回到空，由外鍵 SetNull 處理），
// 再刪檔案；檔案刪除失敗只記錄，不影響結果（照片已經從所有頁面消失）。
export async function deleteTeacherPhotoCore(
  teacherProfileId: string,
  photoId: string,
  storage: PhotoStorage,
): Promise<DeletePhotoResult> {
  try {
    const photo = await prisma.teacherPhoto.findFirst({
      where: { id: photoId, teacherProfileId },
      select: { id: true, storageKey: true },
    });

    if (!photo) {
      return { ok: false, code: "photo_not_found" };
    }

    const deleted = await prisma.teacherPhoto.deleteMany({ where: { id: photo.id, teacherProfileId } });

    if (deleted.count !== 1) {
      return { ok: false, code: "photo_not_found" };
    }

    await removeStoredFile(storage, photo.storageKey);

    return { ok: true };
  } catch (error) {
    console.error("[teacher-photo] delete failed", error);

    return { ok: false, code: "delete_failed" };
  }
}

async function removeStoredFile(storage: PhotoStorage, storageKey: string): Promise<void> {
  try {
    await storage.delete(storageKey);
  } catch (error) {
    console.error("[teacher-photo] storage delete failed (file may be orphaned)", error);
  }
}
