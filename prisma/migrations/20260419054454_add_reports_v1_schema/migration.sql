-- CreateEnum
CREATE TYPE "ThresholdComparator" AS ENUM ('LT', 'LTE', 'GT', 'GTE', 'EQ');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinnedReports" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "uiPreferences" JSONB;

-- CreateTable
CREATE TABLE "AlertThreshold" (
    "id" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "thresholdValue" DECIMAL(10,2) NOT NULL,
    "comparator" "ThresholdComparator" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertThreshold_branchId_idx" ON "AlertThreshold"("branchId");

-- CreateIndex
CREATE INDEX "AlertThreshold_metricKey_idx" ON "AlertThreshold"("metricKey");

-- CreateIndex
CREATE UNIQUE INDEX "AlertThreshold_metricKey_branchId_key" ON "AlertThreshold"("metricKey", "branchId");

-- AddForeignKey
ALTER TABLE "AlertThreshold" ADD CONSTRAINT "AlertThreshold_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
