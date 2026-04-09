/*
  Warnings:

  - A unique constraint covering the columns `[quotationId]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_productId_fkey";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "lastQuotationFolioNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "quotationId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isFreeForm" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "productId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "anonymousCustomerName" TEXT,
    "anonymousCustomerPhone" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "discountAuthorizedById" TEXT,
    "internalNote" TEXT,
    "publicShareToken" TEXT NOT NULL,
    "convertedToSaleId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedByUserId" TEXT,
    "convertedInBranchId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizacion_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "isFreeForm" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_publicShareToken_key" ON "cotizaciones"("publicShareToken");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_convertedToSaleId_key" ON "cotizaciones"("convertedToSaleId");

-- CreateIndex
CREATE INDEX "cotizaciones_branchId_status_idx" ON "cotizaciones"("branchId", "status");

-- CreateIndex
CREATE INDEX "cotizaciones_customerId_idx" ON "cotizaciones"("customerId");

-- CreateIndex
CREATE INDEX "cotizaciones_validUntil_idx" ON "cotizaciones"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_branchId_folio_key" ON "cotizaciones"("branchId", "folio");

-- CreateIndex
CREATE INDEX "cotizacion_items_quotationId_idx" ON "cotizacion_items"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_quotationId_key" ON "Sale"("quotationId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_discountAuthorizedById_fkey" FOREIGN KEY ("discountAuthorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_convertedToSaleId_fkey" FOREIGN KEY ("convertedToSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_convertedByUserId_fkey" FOREIGN KEY ("convertedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_convertedInBranchId_fkey" FOREIGN KEY ("convertedInBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_items" ADD CONSTRAINT "cotizacion_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_items" ADD CONSTRAINT "cotizacion_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
