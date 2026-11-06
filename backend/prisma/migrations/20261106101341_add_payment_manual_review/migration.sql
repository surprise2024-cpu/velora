-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" UUID;

-- CreateIndex
CREATE INDEX "Payment_requiresReview_status_idx" ON "Payment"("requiresReview", "status");
