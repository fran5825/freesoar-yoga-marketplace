-- member-flow-redesign 票 03：課程的「適合對象」與「準備事項」，老師選填（應用層限制各 500 字）。
-- 只新增兩個 nullable 欄位；舊課與團主課維持 NULL，不回填。
ALTER TABLE "ClassSession" ADD COLUMN "suitableFor" TEXT;
ALTER TABLE "ClassSession" ADD COLUMN "preparationNotes" TEXT;
