-- organizer-usability-redesign 票 12：通知直達單筆與防重複。只新增可空欄位，既有通知不回填、不修改。
CREATE TYPE "NotificationTargetType" AS ENUM ('organizer_class_proposal', 'teacher_class_proposal', 'organizer_class_session', 'teacher_class_session');

ALTER TABLE "Notification" ADD COLUMN "targetType" "NotificationTargetType",
ADD COLUMN "targetId" TEXT,
ADD COLUMN "eventKey" TEXT;

-- PostgreSQL 的 unique index 允許多筆 NULL，舊通知不會衝突。
CREATE UNIQUE INDEX "Notification_eventKey_key" ON "Notification"("eventKey");
