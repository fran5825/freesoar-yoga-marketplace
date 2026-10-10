// teacher-showcase-photos 票 02（ADR 0007）：老師照片的 auth 外層。
// 這裡只判斷「你是誰、能不能動這張照片」，檢查與寫入在 __internal__/photo-core.ts。

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage/photo-storage";

import {
  clearAvatarCore,
  deleteTeacherPhotoCore,
  movePhotoCore,
  setAvatarCore,
  TEACHER_PHOTO_MAX_COUNT,
  uploadTeacherPhotoCore,
  type UploadPhotoErrorCode,
} from "./__internal__/photo-core";
import { processPhotoMessages } from "./process-image";

export { TEACHER_PHOTO_MAX_COUNT };

export type PhotoServiceErrorCode =
  | UploadPhotoErrorCode
  | "authentication_required"
  | "teacher_profile_required"
  | "storage_not_configured"
  | "photo_not_found"
  | "delete_failed"
  | "action_failed";

export type PhotoServiceResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: PhotoServiceErrorCode; message: string };

const messages: Record<PhotoServiceErrorCode, string> = {
  ...processPhotoMessages,
  authentication_required: "請先登入。",
  teacher_profile_required: "找不到你的老師資料。",
  teacher_not_approved: "通過老師審核後，才能上傳照片。",
  photo_limit_reached: `最多可以放 ${TEACHER_PHOTO_MAX_COUNT} 張照片，請先刪除一張再上傳。`,
  storage_not_configured: "照片功能尚未開通，請稍後再試。",
  storage_failed: "照片暫時無法儲存，請稍後再試。",
  upload_failed: "照片暫時無法上傳，請稍後再試。",
  photo_not_found: "找不到這張照片，或你沒有權限操作。",
  delete_failed: "照片暫時無法刪除，請稍後再試。",
  action_failed: "暫時無法完成這個操作，請稍後再試。",
};

function fail(code: PhotoServiceErrorCode): { ok: false; code: PhotoServiceErrorCode; message: string } {
  return { ok: false, code, message: messages[code] };
}

async function resolveOwnTeacherProfileId(): Promise<
  { ok: true; teacherProfileId: string } | { ok: false; code: PhotoServiceErrorCode; message: string }
> {
  try {
    const user = await requireUser();
    const profile = await prisma.teacherProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

    return profile ? { ok: true, teacherProfileId: profile.id } : fail("teacher_profile_required");
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return fail("authentication_required");
    }

    throw error;
  }
}

// 老師上傳一張照片（審核通過的老師，自己最多 5 張有效照片）。
export async function uploadOwnTeacherPhoto(
  file: Blob,
): Promise<PhotoServiceResult<{ photoId: string }>> {
  const teacher = await resolveOwnTeacherProfileId();

  if (!teacher.ok) {
    return teacher;
  }

  const storage = getPhotoStorage();

  if (!storage.ok) {
    return fail("storage_not_configured");
  }

  const result = await uploadTeacherPhotoCore(teacher.teacherProfileId, Buffer.from(await file.arrayBuffer()), storage.storage);

  return result.ok ? { ok: true, photoId: result.photoId } : fail(result.code);
}

export async function deleteOwnTeacherPhoto(photoId: string): Promise<PhotoServiceResult> {
  const teacher = await resolveOwnTeacherProfileId();

  if (!teacher.ok) {
    return teacher;
  }

  const storage = getPhotoStorage();

  if (!storage.ok) {
    return fail("storage_not_configured");
  }

  const result = await deleteTeacherPhotoCore(teacher.teacherProfileId, photoId, storage.storage);

  return result.ok ? { ok: true } : fail(result.code);
}

export type OwnPhotoView = { id: string; url: string; width: number; height: number; sortOrder: number; isAvatar: boolean };

// 老師自己的有效照片（依排序）。儲存服務沒設定時 url 無法產生，回傳空清單並標示 storageConfigured = false。
export async function listOwnTeacherPhotos(): Promise<{ storageConfigured: boolean; photos: OwnPhotoView[] }> {
  const teacher = await resolveOwnTeacherProfileId();
  const storage = getPhotoStorage();

  if (!teacher.ok || !storage.ok) {
    return { storageConfigured: storage.ok, photos: [] };
  }

  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacher.teacherProfileId },
    select: { avatarPhotoId: true },
  });
  const rows = await prisma.teacherPhoto.findMany({
    where: { teacherProfileId: teacher.teacherProfileId, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, storageKey: true, width: true, height: true, sortOrder: true },
  });

  return {
    storageConfigured: true,
    photos: rows.map((row) => ({
      id: row.id,
      url: storage.storage.publicUrl(row.storageKey),
      width: row.width,
      height: row.height,
      sortOrder: row.sortOrder,
      isAvatar: row.id === profile?.avatarPhotoId,
    })),
  };
}

// 給各頁面把 storageKey 轉成可顯示的網址；儲存服務沒設定時回傳 null（頁面照常顯示，只是沒有照片）。
export function photoUrlForKey(storageKey: string): string | null {
  const storage = getPhotoStorage();

  return storage.ok ? storage.storage.publicUrl(storageKey) : null;
}

export async function setOwnAvatar(photoId: string): Promise<PhotoServiceResult> {
  const teacher = await resolveOwnTeacherProfileId();

  if (!teacher.ok) {
    return teacher;
  }

  const result = await setAvatarCore(teacher.teacherProfileId, photoId);

  return result.ok ? { ok: true } : fail(result.code);
}

export async function clearOwnAvatar(): Promise<PhotoServiceResult> {
  const teacher = await resolveOwnTeacherProfileId();

  if (!teacher.ok) {
    return teacher;
  }

  const result = await clearAvatarCore(teacher.teacherProfileId);

  return result.ok ? { ok: true } : fail(result.code);
}

export async function moveOwnPhoto(photoId: string, direction: "up" | "down"): Promise<PhotoServiceResult> {
  const teacher = await resolveOwnTeacherProfileId();

  if (!teacher.ok) {
    return teacher;
  }

  const result = await movePhotoCore(teacher.teacherProfileId, photoId, direction);

  return result.ok ? { ok: true } : fail(result.code);
}
