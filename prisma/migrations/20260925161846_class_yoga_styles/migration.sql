-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "yogaStyles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RecurringClassSeries" ADD COLUMN     "yogaStyles" TEXT[] DEFAULT ARRAY[]::TEXT[];
