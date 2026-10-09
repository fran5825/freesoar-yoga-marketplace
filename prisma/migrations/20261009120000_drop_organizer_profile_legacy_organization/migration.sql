-- organizer-usability-redesign 票 15b：移除 OrganizerProfile.organizationId（legacy pointer）。
-- 15a 之後所有讀取與授權都看 Organization.ownerOrganizerProfileId；這個欄位只剩建立團主時的雙寫，已一併移除。
-- Recovery 採 R1：套用前以 prisma/recovery/organizer-15b/snapshot-organizer-pointer.mjs 保存每筆 (id, organizationId)，
-- 需要時重新加回 nullable 欄位與原 FK（ON DELETE SET NULL／ON UPDATE CASCADE）並逐筆寫回。
-- Organization、owner 與 DemandRequest／ClassSession／OrganizerClassProposal 對團體的 FK 都不動。

BEGIN;

-- 擋住檢查到刪除之間的寫入；DROP COLUMN 本來也需要同等級的鎖。
LOCK TABLE "OrganizerProfile" IN ACCESS EXCLUSIVE MODE;

-- 只記錄筆數（不含個資），供套用紀錄對照；R1 已保存原值，這裡不阻擋。
DO $$
DECLARE
  with_pointer integer;
  pointer_not_owned integer;
BEGIN
  SELECT count(*) INTO with_pointer FROM "OrganizerProfile" WHERE "organizationId" IS NOT NULL;
  SELECT count(*) INTO pointer_not_owned
  FROM "OrganizerProfile" p
  JOIN "Organization" o ON o."id" = p."organizationId"
  WHERE o."ownerOrganizerProfileId" IS DISTINCT FROM p."id";
  RAISE NOTICE '15b: profiles with pointer=%, pointer to organization not owned by that profile=%', with_pointer, pointer_not_owned;
END $$;

ALTER TABLE "OrganizerProfile" DROP CONSTRAINT "OrganizerProfile_organizationId_fkey";
ALTER TABLE "OrganizerProfile" DROP COLUMN "organizationId";

COMMIT;
