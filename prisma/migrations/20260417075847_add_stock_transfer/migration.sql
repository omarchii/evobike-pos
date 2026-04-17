-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('SOLICITADA', 'BORRADOR', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "BatteryStatus" ADD VALUE 'IN_TRANSIT';

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'BORRADOR',
    "creadoPor" TEXT NOT NULL,
    "autorizadoPor" TEXT,
    "autorizadoAt" TIMESTAMP(3),
    "despachadoPor" TEXT,
    "despachadoAt" TIMESTAMP(3),
    "recibidoPor" TEXT,
    "recibidoAt" TIMESTAMP(3),
    "canceladoPor" TEXT,
    "canceladoAt" TIMESTAMP(3),
    "motivoCancelacion" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "simpleProductId" TEXT,
    "batteryId" TEXT,
    "customerBikeId" TEXT,
    "cantidadEnviada" INTEGER NOT NULL,
    "cantidadRecibida" INTEGER,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_folio_key" ON "StockTransfer"("folio");

-- CreateIndex
CREATE INDEX "StockTransfer_fromBranchId_status_idx" ON "StockTransfer"("fromBranchId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_toBranchId_status_idx" ON "StockTransfer"("toBranchId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferItem_batteryId_idx" ON "StockTransferItem"("batteryId");

-- CreateIndex
CREATE INDEX "StockTransferItem_customerBikeId_idx" ON "StockTransferItem"("customerBikeId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_autorizadoPor_fkey" FOREIGN KEY ("autorizadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_despachadoPor_fkey" FOREIGN KEY ("despachadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_recibidoPor_fkey" FOREIGN KEY ("recibidoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_canceladoPor_fkey" FOREIGN KEY ("canceladoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_simpleProductId_fkey" FOREIGN KEY ("simpleProductId") REFERENCES "SimpleProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "Battery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Polimorfismo: exactamente uno de los 4 FKs por fila
ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_poly_check"
  CHECK (
    (CASE WHEN "productVariantId" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "simpleProductId"  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "batteryId"        IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "customerBikeId"   IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

-- No self-transfer
ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_different_branches_check"
  CHECK ("fromBranchId" <> "toBranchId");

-- Cantidades no negativas; recibida <= enviada (cuando no-null)
ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_cantidades_check"
  CHECK (
    "cantidadEnviada" > 0 AND
    ("cantidadRecibida" IS NULL OR
     ("cantidadRecibida" >= 0 AND "cantidadRecibida" <= "cantidadEnviada"))
  );
