-- teacher-class-scheduling 票 08（ADR 0005）：整期報名紀錄與 Enrollment 的整期關聯。Additive。
-- Rollback：DROP CONSTRAINT "Enrollment_series_source_check"、DROP Enrollment 兩欄、DROP TABLE "SeriesEnrollment"、DROP 兩個 enum；逐場報名不受影響。

-- CreateEnum
CREATE TYPE "SeriesEnrollmentStatus" AS ENUM ('pending', 'confirmed', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "SeriesEnrollmentSource" AS ENUM ('term_created', 'merged_single');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "seriesEnrollmentId" TEXT,
ADD COLUMN     "seriesEnrollmentSource" "SeriesEnrollmentSource";

-- CreateTable
CREATE TABLE "SeriesEnrollment" (
    "id" TEXT NOT NULL,
    "recurringClassSeriesId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SeriesEnrollmentStatus" NOT NULL,
    "notes" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeriesEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeriesEnrollment_userId_idx" ON "SeriesEnrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesEnrollment_recurringClassSeriesId_userId_key" ON "SeriesEnrollment"("recurringClassSeriesId", "userId");

-- CreateIndex
CREATE INDEX "Enrollment_seriesEnrollmentId_idx" ON "Enrollment"("seriesEnrollmentId");

-- AddForeignKey
ALTER TABLE "SeriesEnrollment" ADD CONSTRAINT "SeriesEnrollment_recurringClassSeriesId_fkey" FOREIGN KEY ("recurringClassSeriesId") REFERENCES "RecurringClassSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesEnrollment" ADD CONSTRAINT "SeriesEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_seriesEnrollmentId_fkey" FOREIGN KEY ("seriesEnrollmentId") REFERENCES "SeriesEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- teacher-class-scheduling 票 08：掛在整期報名底下的逐場報名一定要記錄來源（推導規則 9，票 10 婉拒時依此區分）。
-- 不要求「沒有整期就不能有來源」：整期紀錄被刪除時 FK 會 SET NULL，來源留著也無害；應用層一律同時設定或清除。
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_series_source_check"
CHECK ("seriesEnrollmentId" IS NULL OR "seriesEnrollmentSource" IS NOT NULL);
