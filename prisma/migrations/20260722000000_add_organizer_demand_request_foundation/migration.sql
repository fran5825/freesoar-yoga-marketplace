-- CreateEnum
CREATE TYPE "DemandRequestStatus" AS ENUM ('draft', 'submitted', 'under_review', 'published', 'teacher_responded', 'matched', 'converted_to_class', 'completed', 'cancelled', 'expired', 'rejected');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- CreateTable
CREATE TABLE "DemandRequest" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "serviceType" TEXT,
    "description" TEXT,
    "targetLevel" TEXT,
    "expectedParticipants" INTEGER,
    "preferredAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTimeSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredStartDate" TIMESTAMP(3),
    "classLengthMinutes" INTEGER,
    "frequency" TEXT,
    "budgetRange" TEXT,
    "status" "DemandRequestStatus" NOT NULL DEFAULT 'draft',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandRequest_status_idx" ON "DemandRequest"("status");

-- CreateIndex
CREATE INDEX "DemandRequest_organizerProfileId_idx" ON "DemandRequest"("organizerProfileId");

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
