-- CreateEnum
CREATE TYPE "FormaPagoProveedor" AS ENUM ('CONTADO', 'CREDITO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoPagoProveedor" AS ENUM ('PAGADA', 'PENDIENTE', 'CREDITO');

-- AlterTable
ALTER TABLE "BatteryLot" ADD COLUMN     "purchaseReceiptId" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "precioUnitarioPagado" DECIMAL(10,2),
ADD COLUMN     "purchaseReceiptId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "folioFacturaProveedor" TEXT,
    "facturaUrl" TEXT,
    "formaPagoProveedor" "FormaPagoProveedor" NOT NULL,
    "estadoPago" "EstadoPagoProveedor" NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "totalPagado" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseReceipt_branchId_estadoPago_idx" ON "PurchaseReceipt"("branchId", "estadoPago");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_fechaVencimiento_idx" ON "PurchaseReceipt"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_branchId_proveedor_folioFacturaProveedor_key" ON "PurchaseReceipt"("branchId", "proveedor", "folioFacturaProveedor");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

