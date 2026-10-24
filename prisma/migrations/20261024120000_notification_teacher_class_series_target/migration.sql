-- teacher-first-run 票 05：通知 target 白名單新增 teacher_class_series（整期報名、退出整期通知老師，直達老師系列頁）。
-- 只新增一個 enum 值，不改既有資料。Rollback：PostgreSQL 不支援直接移除 enum 值；保留該值不影響任何既有功能。

-- AlterEnum
ALTER TYPE "NotificationTargetType" ADD VALUE 'teacher_class_series';
