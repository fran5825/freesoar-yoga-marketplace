-- wrong-route-fixes 票 01：通知 target 白名單新增 5 個值，讓多重身分帳號的通知直達自己那個身分的頁面。
-- 只新增 enum 值，不改既有資料（舊通知 targetType 仍為 NULL，照舊依身分推導）。Rollback：PostgreSQL 不支援直接移除 enum 值；保留不用不影響既有功能。

-- AlterEnum
ALTER TYPE "NotificationTargetType" ADD VALUE 'member_class_session';
ALTER TYPE "NotificationTargetType" ADD VALUE 'organizer_demand_request';
ALTER TYPE "NotificationTargetType" ADD VALUE 'teacher_demand_request';
ALTER TYPE "NotificationTargetType" ADD VALUE 'admin_demand_request';
ALTER TYPE "NotificationTargetType" ADD VALUE 'admin_teacher_application';
