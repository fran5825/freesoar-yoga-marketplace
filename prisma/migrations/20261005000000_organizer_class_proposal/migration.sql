-- organizer-usability-redesign 票 05：合作邀請（spec 13.2）。純新增一個 enum 與一張表，不改既有資料。
-- CreateEnum
CREATE TYPE "OrganizerClassProposalStatus" AS ENUM ('draft', 'pending_confirmation', 'confirmed', 'declined', 'withdrawn', 'converted');

-- CreateTable
CREATE TABLE "OrganizerClassProposal" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherProfileId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "serviceType" TEXT,
    "serviceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yogaStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "capacity" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrganizerClassProposalStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "transitionSeq" INTEGER NOT NULL DEFAULT 0,
    "declineReason" TEXT,
    "withdrawReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedVersion" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "classSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerClassProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerClassProposal_classSessionId_key" ON "OrganizerClassProposal"("classSessionId");

-- CreateIndex
CREATE INDEX "OrganizerClassProposal_organizerProfileId_idx" ON "OrganizerClassProposal"("organizerProfileId");

-- CreateIndex
CREATE INDEX "OrganizerClassProposal_teacherProfileId_status_idx" ON "OrganizerClassProposal"("teacherProfileId", "status");

-- CreateIndex
CREATE INDEX "OrganizerClassProposal_status_idx" ON "OrganizerClassProposal"("status");

-- AddForeignKey
ALTER TABLE "OrganizerClassProposal" ADD CONSTRAINT "OrganizerClassProposal_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerClassProposal" ADD CONSTRAINT "OrganizerClassProposal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerClassProposal" ADD CONSTRAINT "OrganizerClassProposal_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerClassProposal" ADD CONSTRAINT "OrganizerClassProposal_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerClassProposal" ADD CONSTRAINT "OrganizerClassProposal_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

