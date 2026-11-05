/*
  Warnings:

  - A unique constraint covering the columns `[guestAccessTokenHash]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guestAccessTokenHash" VARCHAR(64),
ADD COLUMN     "guestEmail" VARCHAR(254),
ADD COLUMN     "guestName" VARCHAR(120),
ADD COLUMN     "guestPhone" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_guestAccessTokenHash_key" ON "Booking"("guestAccessTokenHash");
