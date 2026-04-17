-- CreateEnum
CREATE TYPE "ChargeModel" AS ENUM ('FIXED', 'HOURLY');

-- CreateEnum
CREATE TYPE "ServiceOrderType" AS ENUM ('PAID', 'WARRANTY', 'COURTESY', 'POLICY_MAINTENANCE');

-- CreateEnum
CREATE TYPE "ServiceOrderSubStatus" AS ENUM ('WAITING_PARTS', 'WAITING_APPROVAL', 'PAUSED');

-- CreateEnum
CREATE TYPE "ServiceOrderApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceOrderApprovalChannel" AS ENUM ('WHATSAPP_PUBLIC', 'PHONE_CALL', 'IN_PERSON', 'OTHER');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "whatsappTemplateTaller" TEXT;

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN     "chargeModel" "ChargeModel" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "estimatedMinutes" INTEGER;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "assignedTechId" TEXT,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "publicTokenEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qaNotes" TEXT,
ADD COLUMN     "qaPassedAt" TIMESTAMP(3),
ADD COLUMN     "qaPassedByUserId" TEXT,
ADD COLUMN     "servicedByUserId" TEXT,
ADD COLUMN     "subStatus" "ServiceOrderSubStatus",
ADD COLUMN     "type" "ServiceOrderType" NOT NULL DEFAULT 'PAID';

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isExtra" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "laborMinutes" INTEGER;

-- CreateTable
CREATE TABLE "ServiceOrderApproval" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "totalEstimado" DECIMAL(10,2) NOT NULL,
    "status" "ServiceOrderApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "ServiceOrderApprovalChannel",
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedNote" TEXT,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "ServiceOrderApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceOrderApproval_serviceOrderId_status_idx" ON "ServiceOrderApproval"("serviceOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_publicToken_key" ON "ServiceOrder"("publicToken");

-- CreateIndex
CREATE INDEX "ServiceOrder_branchId_status_idx" ON "ServiceOrder"("branchId", "status");

-- CreateIndex
CREATE INDEX "ServiceOrder_assignedTechId_idx" ON "ServiceOrder"("assignedTechId");

-- CreateIndex
CREATE INDEX "ServiceOrder_servicedByUserId_idx" ON "ServiceOrder"("servicedByUserId");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_subStatus_idx" ON "ServiceOrder"("status", "subStatus");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedTechId_fkey" FOREIGN KEY ("assignedTechId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_servicedByUserId_fkey" FOREIGN KEY ("servicedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_qaPassedByUserId_fkey" FOREIGN KEY ("qaPassedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApproval" ADD CONSTRAINT "ServiceOrderApproval_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApproval" ADD CONSTRAINT "ServiceOrderApproval_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
