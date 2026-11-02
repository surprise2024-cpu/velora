-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "policies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "starRating" INTEGER;

-- AlterTable
ALTER TABLE "RoomType" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
