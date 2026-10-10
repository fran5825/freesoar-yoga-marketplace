// __internal__：不是通用 API。給 teacher-photo/admin-service.ts（auth 外層）與 Playwright 測試直接呼叫，
// 不做身分判斷，呼叫端必須已確認是管理員。刻意不 import 任何登入相關模組。
//
// teacher-showcase-photos 票 07（spec S5）：管理員下架照片。
// - 下架立即生效：照片狀態改成 removed_by_admin（保留紀錄與原因，不刪資料列），所有頁面一律不再顯示；
// - 引用這張照片的老師頭像與課程、系列封面在同一個交易裡回到空（畫面顯示品牌色塊）；
// - 原因必填（5–500 字），會顯示在通知裡給老師看；
// - 下架的照片不算在老師的 5 張上限裡，老師可以重新上傳合適的照片；
// - 檔案在交易成功之後才從儲存服務刪除（失敗只記錄，照片已經從所有頁面消失）。

import { prisma } from "@/lib/prisma";
import type { PhotoStorage } from "@/lib/storage/photo-storage";

export const PHOTO_REMOVAL_REASON_MIN = 5;
export const PHOTO_REMOVAL_REASON_MAX = 500;

export type RemovePhotoResult =
  | { ok: true; teacherUserId: string; teacherProfileId: string; reason: string }
  | { ok: false; code: "reason_invalid" | "photo_not_found" | "photo_not_active" | "remove_failed" };

export async function removeTeacherPhotoForAdminCore(
  photoId: string,
  adminUserId: string,
  reasonInput: string | null | undefined,
  storage: PhotoStorage | null,
): Promise<RemovePhotoResult> {
  const reason = (reasonInput ?? "").replace(/\r\n?/g, "\n").trim();

  if (reason.length < PHOTO_REMOVAL_REASON_MIN || reason.length > PHOTO_REMOVAL_REASON_MAX) {
    return { ok: false, code: "reason_invalid" };
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const photo = await tx.teacherPhoto.findUnique({
        where: { id: photoId },
        select: { id: true, status: true, storageKey: true, teacherProfileId: true, teacherProfile: { select: { userId: true } } },
      });

      if (!photo) {
        return { kind: "not_found" as const };
      }

      // 帶舊狀態條件的更新：兩位管理員同時下架同一張照片，只有一個成功。
      const updated = await tx.teacherPhoto.updateMany({
        where: { id: photoId, status: "active" },
        data: { status: "removed_by_admin", removedReason: reason, removedAt: new Date(), removedByUserId: adminUserId },
      });

      if (updated.count !== 1) {
        return { kind: "not_active" as const };
      }

      await tx.teacherProfile.updateMany({ where: { avatarPhotoId: photoId }, data: { avatarPhotoId: null } });
      await tx.classSession.updateMany({ where: { coverPhotoId: photoId }, data: { coverPhotoId: null } });
      await tx.recurringClassSeries.updateMany({ where: { coverPhotoId: photoId }, data: { coverPhotoId: null } });

      return { kind: "removed" as const, photo };
    });

    if (outcome.kind === "not_found") {
      return { ok: false, code: "photo_not_found" };
    }

    if (outcome.kind === "not_active") {
      return { ok: false, code: "photo_not_active" };
    }

    if (storage) {
      try {
        await storage.delete(outcome.photo.storageKey);
      } catch (error) {
        console.error("[teacher-photo] storage delete after admin removal failed (file may be orphaned)", error);
      }
    }

    return {
      ok: true,
      teacherUserId: outcome.photo.teacherProfile.userId,
      teacherProfileId: outcome.photo.teacherProfileId,
      reason,
    };
  } catch (error) {
    console.error("[teacher-photo] admin removal failed", error);

    return { ok: false, code: "remove_failed" };
  }
}
