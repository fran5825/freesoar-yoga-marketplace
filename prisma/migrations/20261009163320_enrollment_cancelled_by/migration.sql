-- CreateEnum
CREATE TYPE "EnrollmentCancelledBy" AS ENUM ('member', 'teacher', 'admin', 'system');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "cancelledBy" "EnrollmentCancelledBy";

-- enrollment-re-enrollment 票 01（ADR 0006）：取消者只在已取消的報名上有值；離開 cancelled 時應用層一併清為 NULL。
-- 舊的已取消紀錄維持 NULL（原因未記錄），不補值。
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_cancelled_by_check"
CHECK ("cancelledBy" IS NULL OR "status" = 'cancelled');
