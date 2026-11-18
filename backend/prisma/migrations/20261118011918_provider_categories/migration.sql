-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('APPROVED', 'PENDING');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "proposedById" TEXT,
ADD COLUMN     "status" "CategoryStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "Category_status_idx" ON "Category"("status");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
