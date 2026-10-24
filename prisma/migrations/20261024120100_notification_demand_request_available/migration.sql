-- teacher-first-run 票 06：新增通知類型 demand_request_available（需求公開時通知所有已通過審核的老師，只發站內通知）。
-- 只新增一個 enum 值，不改既有資料。Rollback：PostgreSQL 不支援直接移除 enum 值；保留該值不影響任何既有功能。

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'demand_request_available';
