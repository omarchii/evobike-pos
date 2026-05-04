-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'ACEPTADA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "renewedFromId" TEXT;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
