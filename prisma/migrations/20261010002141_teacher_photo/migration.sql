-- teacher-showcase-photos 票 02（ADR 0007）：新增老師照片資料表，沒有改動既有資料表或資料。
-- Rollback：DROP TABLE "TeacherPhoto"; DROP TYPE "TeacherPhotoStatus";（檔案本身在儲存服務，不在資料庫。）

-- CreateEnum
CREATE TYPE "TeacherPhotoStatus" AS ENUM ('active', 'removed_by_admin');

-- CreateTable
CREATE TABLE "TeacherPhoto" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "TeacherPhotoStatus" NOT NULL DEFAULT 'active',
    "removedReason" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPhoto_storageKey_key" ON "TeacherPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "TeacherPhoto_teacherProfileId_status_sortOrder_idx" ON "TeacherPhoto"("teacherProfileId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "TeacherPhoto" ADD CONSTRAINT "TeacherPhoto_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
