// teacher-showcase-photos 票 05（spec 6.2、6.3、7.1）：把「資料庫裡的照片關聯」轉成畫面可用的網址。
//
// 規則：
// - 只有 status = active 的照片會顯示；管理員下架的照片（removed_by_admin）一律當作沒有；
// - 儲存服務沒設定時（照片功能關閉）一律回傳 null，頁面照常顯示（只是沒有照片）；
// - 課程的有效封面：屬於系列的場次用系列的封面，其餘用場次自己的封面；
// - 公開頁、列表與單堂頁都只拿到「網址字串」，不會拿到 storageKey 以外的照片內部資訊。

import { getPhotoStorage } from "@/lib/storage/photo-storage";

export type PhotoRef = { storageKey: string; status: "active" | "removed_by_admin" } | null | undefined;

// Prisma select 片段：{ coverPhoto: photoRefSelect }。
export const photoRefSelect = { select: { storageKey: true, status: true } } as const;

export function activePhotoUrl(photo: PhotoRef): string | null {
  if (!photo || photo.status !== "active") {
    return null;
  }

  const storage = getPhotoStorage();

  return storage.ok ? storage.storage.publicUrl(photo.storageKey) : null;
}

export type CoverSource = {
  coverPhoto?: PhotoRef;
  recurringClassSeries?: { coverPhoto?: PhotoRef } | null;
};

// 屬於系列的場次用系列封面；單堂課用自己的封面。
export function effectiveCoverUrl(source: CoverSource): string | null {
  return activePhotoUrl(source.recurringClassSeries ? source.recurringClassSeries.coverPhoto : source.coverPhoto);
}

export type TeacherAvatarSource = { avatarPhoto?: PhotoRef } | null | undefined;

export function teacherAvatarUrl(teacher: TeacherAvatarSource): string | null {
  return activePhotoUrl(teacher?.avatarPhoto);
}
