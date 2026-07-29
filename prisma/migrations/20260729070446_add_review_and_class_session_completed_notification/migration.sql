-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'class_session_completed';
ALTER TYPE "NotificationType" ADD VALUE 'review_submitted';

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_classSessionId_idx" ON "Review"("classSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_classSessionId_reviewerUserId_key" ON "Review"("classSessionId", "reviewerUserId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
