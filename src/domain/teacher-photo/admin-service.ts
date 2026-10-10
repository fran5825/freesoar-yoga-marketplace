// teacher-showcase-photos 票 07（spec S5）：管理員下架老師照片的 auth 外層。
// 檢查與寫入在 __internal__/admin-remove-core.ts；這裡負責「確認是管理員」、發通知給老師與提供管理員的讀取。

import { notifyUsers } from "@/domain/notification/create";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage/photo-storage";

import {
  PHOTO_REMOVAL_REASON_MAX,
  PHOTO_REMOVAL_REASON_MIN,
  removeTeacherPhotoForAdminCore,
} from "./__internal__/admin-remove-core";
import { activePhotoUrl } from "./display";

export type AdminRemovePhotoResult =
  | { ok: true }
  | { ok: false; code: "admin_permission_required" | "reason_invalid" | "photo_not_found" | "photo_not_active" | "remove_failed"; message: string };

const messages = {
  admin_permission_required: "需要管理員權限才能下架照片。",
  reason_invalid: `請填寫下架原因（${PHOTO_REMOVAL_REASON_MIN}–${PHOTO_REMOVAL_REASON_MAX} 字），老師會在通知裡看到。`,
  photo_not_found: "找不到這張照片。",
  photo_not_active: "這張照片已經不是有效狀態（可能剛被下架），請重新整理確認。",
  remove_failed: "暫時無法下架這張照片，請稍後再試。",
} as const;

export async function removeTeacherPhotoForAdmin(photoId: string, reason: string | null | undefined): Promise<AdminRemovePhotoResult> {
  let adminUserId: string;

  try {
    adminUserId = (await requireAdmin()).id;
  } catch (error) {
    if (error instanceof Error && (error.message === "Authentication required" || error.message === "Admin access required")) {
      return { ok: false, code: "admin_permission_required", message: messages.admin_permission_required };
    }

    throw error;
  }

  const storage = getPhotoStorage();
  const result = await removeTeacherPhotoForAdminCore(photoId, adminUserId, reason, storage.ok ? storage.storage : null);

  if (!result.ok) {
    return { ok: false, code: result.code, message: messages[result.code] };
  }

  // 通知在下架成功之後才發；失敗只記錄，不撤銷已完成的下架。只發站內通知（email 政策為空）。
  try {
    await notifyUsers("teacher_photo_removed", [{ userId: result.teacherUserId, role: "self" }], { reason: result.reason });
  } catch (error) {
    console.error("[notification] teacher_photo_removed trigger failed", error);
  }

  return { ok: true };
}

export type AdminTeacherPhoto = {
  id: string;
  status: "active" | "removed_by_admin";
  url: string | null;
  width: number;
  height: number;
  removedReason: string | null;
  removedAt: Date | null;
  isAvatar: boolean;
};

// 管理員看某位老師的全部照片（有效的與已下架的）。已下架的不給網址（檔案也已刪除）。
export async function listTeacherPhotosForAdmin(teacherProfileId: string): Promise<AdminTeacherPhoto[]> {
  await requireAdmin();

  const [photos, profile] = await Promise.all([
    prisma.teacherPhoto.findMany({
      where: { teacherProfileId },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, status: true, storageKey: true, width: true, height: true, removedReason: true, removedAt: true },
    }),
    prisma.teacherProfile.findUnique({ where: { id: teacherProfileId }, select: { avatarPhotoId: true } }),
  ]);

  return photos.map((photo) => ({
    id: photo.id,
    status: photo.status,
    url: activePhotoUrl({ storageKey: photo.storageKey, status: photo.status }),
    width: photo.width,
    height: photo.height,
    removedReason: photo.removedReason,
    removedAt: photo.removedAt,
    isAvatar: photo.id === profile?.avatarPhotoId,
  }));
}
