-- teacher-showcase-photos 票 03：老師頭像（指向自己的一張有效照片），新增可為空的欄位與外鍵，不改既有資料。
-- Rollback：ALTER TABLE "TeacherProfile" DROP CONSTRAINT "TeacherProfile_avatarPhotoId_fkey"; ALTER TABLE "TeacherProfile" DROP COLUMN "avatarPhotoId";

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "avatarPhotoId" TEXT;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_avatarPhotoId_fkey" FOREIGN KEY ("avatarPhotoId") REFERENCES "TeacherPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
