-- teacher-showcase-photos 票 07：新增通知類型 teacher_photo_removed（管理員下架老師照片時通知老師，只發站內通知）。
-- 只新增一個 enum 值，不改既有資料。Rollback：PostgreSQL 不支援直接移除 enum 值；保留該值不影響任何既有功能。

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'teacher_photo_removed';
