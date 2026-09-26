-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "serviceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RecurringClassSeries" ADD COLUMN     "serviceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 課程風格改多選（expand 階段）：把既有的單一 serviceType 複製進 serviceTypes。
-- 舊的 serviceType 欄位保留，之後仍寫入「第一個選項」當作主要課程風格（公開篩選與舊資料相容用）。
UPDATE "ClassSession"
SET "serviceTypes" = ARRAY["serviceType"]
WHERE "serviceType" IS NOT NULL;

UPDATE "RecurringClassSeries"
SET "serviceTypes" = ARRAY["serviceType"]
WHERE "serviceType" IS NOT NULL;
