-- organizer-usability-redesign 票 09（spec 13.6）：三種課程來源的關聯不變量由資料庫保證。
-- organizer_matched：必有 demand、organizer、organization
-- teacher_initiated：三者皆無
-- organizer_direct：沒有 demand，必有 organizer、organization（對應的 converted 合作邀請由 service 與測試保證）
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_origin_invariants_check" CHECK (
  ("origin" = 'organizer_matched'
    AND "demandRequestId" IS NOT NULL AND "organizerProfileId" IS NOT NULL AND "organizationId" IS NOT NULL)
  OR ("origin" = 'teacher_initiated'
    AND "demandRequestId" IS NULL AND "organizerProfileId" IS NULL AND "organizationId" IS NULL)
  OR ("origin" = 'organizer_direct'
    AND "demandRequestId" IS NULL AND "organizerProfileId" IS NOT NULL AND "organizationId" IS NOT NULL)
);
