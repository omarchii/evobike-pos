-- DropForeignKey
ALTER TABLE "AssemblyOrder" DROP CONSTRAINT "AssemblyOrder_customerBikeId_fkey";

-- AlterTable
ALTER TABLE "AssemblyOrder" ADD COLUMN     "productVariantId" TEXT,
ADD COLUMN     "receiptReference" TEXT,
ALTER COLUMN "customerBikeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerBike" ADD COLUMN     "productVariantId" TEXT;

-- AddForeignKey
ALTER TABLE "CustomerBike" ADD CONSTRAINT "CustomerBike_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOrder" ADD CONSTRAINT "AssemblyOrder_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOrder" ADD CONSTRAINT "AssemblyOrder_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
