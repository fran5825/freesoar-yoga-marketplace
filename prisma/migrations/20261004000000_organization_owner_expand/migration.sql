-- organizer-usability-redesign 票 02：多團體 owner 的 expand + backfill（spec 13.1）。
-- 只新增欄位，不改、不刪任何既有資料；legacy OrganizerProfile.organizationId 保留到票 15。

-- 步驟 1：歧義檢查，排在任何 DDL 之前。一個團體對應到兩位以上團主時整個 migration 失敗，
-- 資料庫維持原狀；訊息只列團體 ID 與候選數，不輸出個人資料，也不挑第一人。
DO $$
DECLARE
  ambiguous_count INTEGER;
  ambiguous_detail TEXT;
BEGIN
  WITH candidates AS (
    SELECT "organizationId" AS org_id, "id" AS organizer_profile_id
      FROM "OrganizerProfile" WHERE "organizationId" IS NOT NULL
    UNION
    SELECT "organizationId", "organizerProfileId" FROM "DemandRequest"
    UNION
    SELECT "organizationId", "organizerProfileId" FROM "ClassSession"
      WHERE "organizationId" IS NOT NULL AND "organizerProfileId" IS NOT NULL
  ), per_org AS (
    SELECT org_id, COUNT(DISTINCT organizer_profile_id) AS n
      FROM candidates GROUP BY org_id HAVING COUNT(DISTINCT organizer_profile_id) > 1
  )
  SELECT COUNT(*), string_agg(org_id || ' (' || n || ')', ', ')
    INTO ambiguous_count, ambiguous_detail FROM per_org;

  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION 'organization_owner_ambiguous: % organization(s) have multiple organizer candidates: %',
      ambiguous_count, ambiguous_detail;
  END IF;
END $$;

-- 步驟 2：expand。
ALTER TABLE "Organization" ADD COLUMN "ownerOrganizerProfileId" TEXT;

CREATE INDEX "Organization_ownerOrganizerProfileId_idx" ON "Organization"("ownerOrganizerProfileId");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerOrganizerProfileId_fkey" FOREIGN KEY ("ownerOrganizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 步驟 3：backfill。上面已保證每個團體至多一位候選；沒有候選的團體保持 NULL（只有 admin 看得到）。
WITH candidates AS (
  SELECT "organizationId" AS org_id, "id" AS organizer_profile_id
    FROM "OrganizerProfile" WHERE "organizationId" IS NOT NULL
  UNION
  SELECT "organizationId", "organizerProfileId" FROM "DemandRequest"
  UNION
  SELECT "organizationId", "organizerProfileId" FROM "ClassSession"
    WHERE "organizationId" IS NOT NULL AND "organizerProfileId" IS NOT NULL
)
UPDATE "Organization" o
   SET "ownerOrganizerProfileId" = c.organizer_profile_id
  FROM candidates c
 WHERE c.org_id = o."id";
