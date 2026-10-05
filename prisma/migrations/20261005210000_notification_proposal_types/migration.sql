-- organizer-usability-redesign 票 12（spec 13.7，產品主人 2026-10-05 確認方案 A）：合作邀請的五種站內通知。
-- PostgreSQL 不允許在新增 enum 值的同一個 transaction 使用它，所以和欄位變更分開。
ALTER TYPE "NotificationType" ADD VALUE 'class_proposal_invited';
ALTER TYPE "NotificationType" ADD VALUE 'class_proposal_confirmed';
ALTER TYPE "NotificationType" ADD VALUE 'class_proposal_declined';
ALTER TYPE "NotificationType" ADD VALUE 'class_proposal_withdrawn';
ALTER TYPE "NotificationType" ADD VALUE 'class_proposal_revised';
