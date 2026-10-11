-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "recurringClassSeriesId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_recurringClassSeriesId_idx" ON "Notification"("recurringClassSeriesId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recurringClassSeriesId_fkey" FOREIGN KEY ("recurringClassSeriesId") REFERENCES "RecurringClassSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
