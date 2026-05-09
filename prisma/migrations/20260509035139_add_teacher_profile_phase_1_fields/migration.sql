-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "priceRange" TEXT,
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "teachingFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "teachingStyle" TEXT,
ALTER COLUMN "displayName" DROP NOT NULL;
