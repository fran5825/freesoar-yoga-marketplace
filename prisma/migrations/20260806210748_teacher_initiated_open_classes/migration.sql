-- CreateEnum
CREATE TYPE "ClassSessionOrigin" AS ENUM ('organizer_matched', 'teacher_initiated');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'enrollment_pending_review';

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "origin" "ClassSessionOrigin" NOT NULL DEFAULT 'organizer_matched',
ADD COLUMN     "recurringClassSeriesId" TEXT,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "demandRequestId" DROP NOT NULL,
ALTER COLUMN "organizerProfileId" DROP NOT NULL,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RecurringClassSeries" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" TEXT,
    "dayOfWeek" INTEGER,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringClassSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringClassSeries_teacherProfileId_idx" ON "RecurringClassSeries"("teacherProfileId");

-- CreateIndex
CREATE INDEX "ClassSession_recurringClassSeriesId_idx" ON "ClassSession"("recurringClassSeriesId");

-- CreateIndex
CREATE INDEX "ClassSession_origin_idx" ON "ClassSession"("origin");

-- AddForeignKey
ALTER TABLE "RecurringClassSeries" ADD CONSTRAINT "RecurringClassSeries_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_recurringClassSeriesId_fkey" FOREIGN KEY ("recurringClassSeriesId") REFERENCES "RecurringClassSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
