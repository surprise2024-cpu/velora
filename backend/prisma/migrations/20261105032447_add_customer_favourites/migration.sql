-- CreateTable
CREATE TABLE "Favourite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favourite_branchId_idx" ON "Favourite"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Favourite_userId_branchId_key" ON "Favourite"("userId", "branchId");

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
