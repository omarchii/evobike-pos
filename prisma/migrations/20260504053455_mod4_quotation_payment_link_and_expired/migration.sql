-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN     "quotationId" TEXT;

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiringAlertSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CashTransaction_quotationId_idx" ON "CashTransaction"("quotationId");

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
