-- teacher-showcase-photos 票 06（spec S6）：老師公開頁開關，預設關閉；新增一個有預設值的欄位，不改既有資料。
-- Rollback：ALTER TABLE "TeacherProfile" DROP COLUMN "isPublicPageEnabled";（老師頁就全部回到未公開。）

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "isPublicPageEnabled" BOOLEAN NOT NULL DEFAULT false;
