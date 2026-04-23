-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "terminosServicio" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "excludeFromRevenue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "SaleType" NOT NULL DEFAULT 'DIRECT';

-- Backfill Sale.type: jerarquía serviceOrderId > orderType > DIRECT.
-- Todas las filas existentes tienen type='DIRECT' por el DEFAULT del ADD COLUMN;
-- este UPDATE sobrescribe donde corresponda. Invariante documentada en schema.prisma.
UPDATE "Sale"
  SET "type" = CASE
    WHEN "serviceOrderId" IS NOT NULL THEN 'SERVICE'::"SaleType"
    WHEN "orderType" = 'LAYAWAY'       THEN 'LAYAWAY'::"SaleType"
    WHEN "orderType" = 'BACKORDER'     THEN 'BACKORDER'::"SaleType"
    ELSE 'DIRECT'::"SaleType"
  END;

-- Backfill Sale.excludeFromRevenue: solo servicios sin cobro (WARRANTY/COURTESY/POLICY_MAINTENANCE).
-- Conservador — preserva como "actividad comercial" cualquier venta con total=0 que NO sea servicio
-- (p. ej. tickets con descuento 100% legítimos). Afecta numVentas/ticketPromedio, nunca ingresoTotal.
UPDATE "Sale"
  SET "excludeFromRevenue" = true
  WHERE "total" = 0 AND "serviceOrderId" IS NOT NULL;
