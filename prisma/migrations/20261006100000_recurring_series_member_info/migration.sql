-- member-flow-redesign 票 04：系列的「適合對象」與「準備事項」（生成場次時複製到每一場）。
-- 只新增兩個 nullable 欄位；既有系列維持 NULL，不回填。
ALTER TABLE "RecurringClassSeries" ADD COLUMN "suitableFor" TEXT;
ALTER TABLE "RecurringClassSeries" ADD COLUMN "preparationNotes" TEXT;
