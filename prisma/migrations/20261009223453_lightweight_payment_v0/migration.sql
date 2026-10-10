-- lightweight-payment-v0（付款計畫第 0 節修訂）：全部是新增欄位與新資料表，沒有刪除或改寫既有資料。
-- Rollback：DROP TABLE "EnrollmentPaymentEvent"，並刪除下列新增的欄位與三個 enum；既有報名不受影響（paymentStatus 預設 unpaid）。

-- CreateEnum
CREATE TYPE "EnrollmentPaymentStatus" AS ENUM ('unpaid', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentActorRole" AS ENUM ('teacher', 'admin');

-- CreateEnum
CREATE TYPE "EnrollmentPaymentEventType" AS ENUM ('marked_paid', 'marked_refunded', 'reset_on_re_enrollment');

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "priceNote" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "contactInfoSnapshot" TEXT,
ADD COLUMN     "paymentAccountInfoSnapshot" TEXT,
ADD COLUMN     "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentConfirmedByRole" "PaymentActorRole",
ADD COLUMN     "paymentConfirmedByUserId" TEXT,
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentRefundReason" TEXT,
ADD COLUMN     "paymentRefundedAt" TIMESTAMP(3),
ADD COLUMN     "paymentRefundedByRole" "PaymentActorRole",
ADD COLUMN     "paymentRefundedByUserId" TEXT,
ADD COLUMN     "paymentRulesSnapshot" TEXT,
ADD COLUMN     "paymentStatus" "EnrollmentPaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "priceNoteSnapshot" TEXT,
ADD COLUMN     "transferNote" TEXT;

-- AlterTable
ALTER TABLE "RecurringClassSeries" ADD COLUMN     "priceNote" TEXT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "contactInfo" TEXT,
ADD COLUMN     "paymentAccountInfo" TEXT,
ADD COLUMN     "paymentRulesText" TEXT;

-- CreateTable
CREATE TABLE "EnrollmentPaymentEvent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "EnrollmentPaymentEventType" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "PaymentActorRole",
    "note" TEXT,
    "previousRound" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentPaymentEvent_enrollmentId_createdAt_idx" ON "EnrollmentPaymentEvent"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Enrollment_paymentStatus_idx" ON "Enrollment"("paymentStatus");

-- AddForeignKey
ALTER TABLE "EnrollmentPaymentEvent" ADD CONSTRAINT "EnrollmentPaymentEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
