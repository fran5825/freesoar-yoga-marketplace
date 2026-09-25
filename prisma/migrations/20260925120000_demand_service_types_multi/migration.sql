-- 服務類型改多選（expand 階段）：新增 serviceTypes 陣列欄位，並把既有的單一 serviceType 複製進去。
-- 舊的 serviceType 欄位先保留，之後仍會寫入「第一個選項」當作主要類型（課程建立時預設帶入用），
-- 確認沒有其他地方依賴後，再另開 migration 移除（contract 階段）。
ALTER TABLE "DemandRequest" ADD COLUMN "serviceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "DemandRequest"
SET "serviceTypes" = ARRAY["serviceType"]
WHERE "serviceType" IS NOT NULL;
