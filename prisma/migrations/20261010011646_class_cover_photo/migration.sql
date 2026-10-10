-- teacher-showcase-photos 票 04（spec M2）：課程封面。新增可為空的欄位與外鍵（照片被刪除或下架時回到空），不改既有資料。
-- 規則：系列場次一律用系列的封面，所以「有 recurringClassSeriesId 時，場次自己的 coverPhotoId 必為 NULL」，由資料庫保證。
-- Rollback：刪除下列檢查規則、外鍵與兩個欄位；課程與系列不受影響（只是沒有封面）。

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "coverPhotoId" TEXT;

-- AlterTable
ALTER TABLE "RecurringClassSeries" ADD COLUMN     "coverPhotoId" TEXT;

-- AddForeignKey
ALTER TABLE "RecurringClassSeries" ADD CONSTRAINT "RecurringClassSeries_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "TeacherPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "TeacherPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 系列場次不能自己設封面（寫入端也會拒絕，這裡是最後一道保證）。
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_cover_not_in_series_check"
CHECK ("recurringClassSeriesId" IS NULL OR "coverPhotoId" IS NULL);
