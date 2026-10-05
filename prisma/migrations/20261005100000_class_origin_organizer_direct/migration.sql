-- organizer-usability-redesign 票 09：新增課程來源「團主直接開團」。
-- PostgreSQL 不允許在新增 enum 值的同一個 transaction 內使用它，約束放在下一個 migration。
ALTER TYPE "ClassSessionOrigin" ADD VALUE 'organizer_direct';
