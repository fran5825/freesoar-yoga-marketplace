-- teacher-class-scheduling 票 06：系列的公開設定（公開列在找課程／僅透過連結招募），生成與追加的場次沿用。
-- 只新增一個欄位；既有系列一律 false（僅透過連結招募），與原本行為相同。Rollback：DROP COLUMN "isPublic"。
-- AlterTable
ALTER TABLE "RecurringClassSeries" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;
