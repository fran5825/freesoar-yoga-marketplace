-- teacher-class-scheduling 票 07：系列型態（持續開課／期班）與期班報名方式。
-- Additive：只新增 enum、欄位與檢查規則，不刪任何資料。
-- Rollback：DROP CONSTRAINT、DROP COLUMN "kind"／"termEnrollmentMode"、DROP TYPE 兩個 enum；
-- 只會失去型態與報名方式，場次與報名不受影響。

-- CreateEnum
CREATE TYPE "RecurringClassSeriesKind" AS ENUM ('continuous', 'term');

-- CreateEnum
CREATE TYPE "TermEnrollmentMode" AS ENUM ('term_only', 'term_and_single');

-- AlterTable
ALTER TABLE "RecurringClassSeries" ADD COLUMN     "kind" "RecurringClassSeriesKind" NOT NULL DEFAULT 'continuous',
ADD COLUMN     "termEnrollmentMode" "TermEnrollmentMode";

-- 舊資料回填（規格 Q21）：指定日期（dayOfWeek IS NULL）一律是期班、整期和單堂都收；
-- 每週固定維持預設的持續開課。
UPDATE "RecurringClassSeries"
SET "kind" = 'term', "termEnrollmentMode" = 'term_and_single'
WHERE "dayOfWeek" IS NULL;

-- 持續開課沒有報名方式；期班一定要有報名方式。
ALTER TABLE "RecurringClassSeries" ADD CONSTRAINT "RecurringClassSeries_term_enrollment_mode_check"
CHECK (
  ("kind" = 'continuous' AND "termEnrollmentMode" IS NULL)
  OR ("kind" = 'term' AND "termEnrollmentMode" IS NOT NULL)
);
