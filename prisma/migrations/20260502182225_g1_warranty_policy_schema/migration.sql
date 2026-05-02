-- CreateEnum
CREATE TYPE "WarrantyPolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'VOID');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "curp" TEXT,
ADD COLUMN     "ineCapturedAt" TIMESTAMP(3),
ADD COLUMN     "ineScanUrl" TEXT;

-- AlterTable
ALTER TABLE "Modelo" ADD COLUMN     "warrantyDays" INTEGER;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "ineCustomerSnapshotJson" JSONB,
ADD COLUMN     "partReceivedAt" TIMESTAMP(3),
ADD COLUMN     "partRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WarrantyPolicy" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "customerBikeId" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "modeloCategoria" "ModeloCategoria" NOT NULL,
    "warrantyDaysSnapshot" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "status" "WarrantyPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "docPrintedAt" TIMESTAMP(3),
    "lastPrintedAt" TIMESTAMP(3),
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "docUrl" TEXT,
    "docSha256" TEXT,
    "pdfEngineVersion" VARCHAR(64),
    "alertSentAt120" TIMESTAMP(3),
    "alertSentAt173" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarrantyPolicy_status_expiresAt_idx" ON "WarrantyPolicy"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WarrantyPolicy_status_alertSentAt120_idx" ON "WarrantyPolicy"("status", "alertSentAt120");

-- CreateIndex
CREATE INDEX "WarrantyPolicy_status_alertSentAt173_idx" ON "WarrantyPolicy"("status", "alertSentAt173");

-- CHECK: warrantyDays solo permitido en Modelos con requiere_vin = true
ALTER TABLE "Modelo" ADD CONSTRAINT "chk_warranty_requires_vin"
  CHECK ("warrantyDays" IS NULL OR "requiere_vin" = true);

-- AddForeignKey
ALTER TABLE "WarrantyPolicy" ADD CONSTRAINT "WarrantyPolicy_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyPolicy" ADD CONSTRAINT "WarrantyPolicy_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyPolicy" ADD CONSTRAINT "WarrantyPolicy_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyPolicy" ADD CONSTRAINT "WarrantyPolicy_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
