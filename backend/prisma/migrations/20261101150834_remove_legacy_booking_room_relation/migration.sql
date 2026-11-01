/*
  Warnings:

  - You are about to drop the column `roomId` on the `Booking` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_roomId_fkey";

-- DropIndex
DROP INDEX "Booking_roomId_checkIn_checkOut_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "roomId";
