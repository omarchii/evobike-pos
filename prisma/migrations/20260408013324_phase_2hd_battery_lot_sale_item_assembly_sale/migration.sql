-- AlterTable
ALTER TABLE "AssemblyOrder" ADD COLUMN     "saleId" TEXT;

-- AlterTable
ALTER TABLE "BatteryLot" ADD COLUMN     "saleItemId" TEXT;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOrder" ADD CONSTRAINT "AssemblyOrder_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
