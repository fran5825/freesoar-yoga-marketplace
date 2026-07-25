-- CreateEnum
CREATE TYPE "DemandResponseStatus" AS ENUM ('submitted', 'shortlisted', 'selected', 'declined', 'withdrawn', 'expired');

-- CreateTable
CREATE TABLE "DemandResponse" (
    "id" TEXT NOT NULL,
    "demandRequestId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "proposedTimeSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposedPrice" TEXT,
    "status" "DemandResponseStatus" NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandResponse_demandRequestId_idx" ON "DemandResponse"("demandRequestId");

-- CreateIndex
CREATE INDEX "DemandResponse_teacherProfileId_idx" ON "DemandResponse"("teacherProfileId");

-- CreateIndex
CREATE INDEX "DemandResponse_status_idx" ON "DemandResponse"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DemandResponse_demandRequestId_teacherProfileId_key" ON "DemandResponse"("demandRequestId", "teacherProfileId");

-- AddForeignKey
ALTER TABLE "DemandResponse" ADD CONSTRAINT "DemandResponse_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandResponse" ADD CONSTRAINT "DemandResponse_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
