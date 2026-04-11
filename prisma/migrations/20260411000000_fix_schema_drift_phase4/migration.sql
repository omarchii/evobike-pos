-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('DIRECT', 'LAYAWAY', 'BACKORDER', 'SERVICE');

-- CreateEnum
CREATE TYPE "VoltageChangeReason" AS ENUM ('PRE_SALE', 'POST_SALE');

-- AlterTable
ALTER TABLE "AssemblyOrder" ADD COLUMN     "voltageChangeLogId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "serviceOrderId" TEXT,
ADD COLUMN     "warrantyDocReady" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "prepaid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "inventoryMovementId" TEXT;

-- AlterTable
ALTER TABLE "VoltageChangeLog" ADD COLUMN     "saleId" TEXT,
ADD COLUMN     "serviceOrderId" TEXT,
DROP COLUMN "reason",
ADD COLUMN     "reason" "VoltageChangeReason" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyOrder_voltageChangeLogId_key" ON "AssemblyOrder"("voltageChangeLogId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_serviceOrderId_key" ON "Sale"("serviceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderItem_inventoryMovementId_key" ON "ServiceOrderItem"("inventoryMovementId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
