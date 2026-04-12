-- CreateEnum
CREATE TYPE "SimpleProductCategoria" AS ENUM ('ACCESORIO', 'CARGADOR', 'REFACCION', 'BATERIA_STANDALONE');

-- DropForeignKey
ALTER TABLE "BatteryLot" DROP CONSTRAINT "BatteryLot_productId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_productId_fkey";

-- DropIndex
DROP INDEX "Stock_productId_branchId_key";

-- AlterTable
ALTER TABLE "BatteryLot" ADD COLUMN     "simpleProductId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "simpleProductId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ModeloConfiguracion" ADD COLUMN     "stockMaximo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockMinimo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "simpleProductId" TEXT;

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "simpleProductId" TEXT;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "simpleProductId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SimpleProduct" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "SimpleProductCategoria" NOT NULL,
    "modeloAplicable" TEXT,
    "precioPublico" DECIMAL(10,2) NOT NULL,
    "precioMayorista" DECIMAL(10,2) NOT NULL,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "stockMaximo" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimpleProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimpleProduct_codigo_key" ON "SimpleProduct"("codigo");

-- CreateIndex
CREATE INDEX "SimpleProduct_categoria_isActive_idx" ON "SimpleProduct"("categoria", "isActive");

-- CreateIndex
CREATE INDEX "SimpleProduct_modeloAplicable_idx" ON "SimpleProduct"("modeloAplicable");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_simpleProductId_fkey" FOREIGN KEY ("simpleProductId") REFERENCES "SimpleProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_simpleProductId_fkey" FOREIGN KEY ("simpleProductId") REFERENCES "SimpleProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_simpleProductId_fkey" FOREIGN KEY ("simpleProductId") REFERENCES "SimpleProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_simpleProductId_fkey" FOREIGN KEY ("simpleProductId") REFERENCES "SimpleProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModeloConfiguracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_simpleProductId_fkey" FOREIGN KEY ("simpleProductId") REFERENCES "SimpleProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Polimorfismo: exactamente uno de (productVariantId, simpleProductId) por fila ──
-- Prisma no genera CHECK; se añaden manualmente aquí.
-- Postgres trata NULL como distinto en UNIQUE, así los dos índices únicos coexisten sin colisión
-- (los declara Prisma via @@unique arriba; se muestran a continuación sólo como referencia).

-- CreateIndex (Stock unique por variante + por simple product)
CREATE UNIQUE INDEX "Stock_productId_branchId_key" ON "Stock"("productId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_simpleProductId_branchId_key" ON "Stock"("simpleProductId", "branchId");

-- Stock: CHECK (exactamente uno de ambos punteros).
ALTER TABLE "Stock"
  ADD CONSTRAINT "Stock_product_xor_simple_chk"
  CHECK (("productId" IS NOT NULL) <> ("simpleProductId" IS NOT NULL));

-- InventoryMovement: CHECK (libro mayor append-only, sin unicidad).
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_product_xor_simple_chk"
  CHECK (("productId" IS NOT NULL) <> ("simpleProductId" IS NOT NULL));

-- BatteryLot: CHECK (un lote pertenece a un único origen de catálogo).
ALTER TABLE "BatteryLot"
  ADD CONSTRAINT "BatteryLot_product_xor_simple_chk"
  CHECK (("productId" IS NOT NULL) <> ("simpleProductId" IS NOT NULL));
