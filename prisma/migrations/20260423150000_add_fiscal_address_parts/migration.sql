-- Añade los 7 campos desglosados para dirección fiscal (equivalentes a los
-- de envío). direccionFiscal se conserva como legacy para no perder datos.

ALTER TABLE "Customer"
  ADD COLUMN "fiscalStreet" TEXT,
  ADD COLUMN "fiscalExtNum" TEXT,
  ADD COLUMN "fiscalIntNum" TEXT,
  ADD COLUMN "fiscalColonia" TEXT,
  ADD COLUMN "fiscalCity" TEXT,
  ADD COLUMN "fiscalState" TEXT,
  ADD COLUMN "fiscalZip" TEXT;
