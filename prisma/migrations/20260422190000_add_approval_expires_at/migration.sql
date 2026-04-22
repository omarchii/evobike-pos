-- P13-D.2: expiresAt en ServiceOrderApproval (48h, lazy expiry)
--
-- Diagnóstico previo (DB local 2026-04-22): 0 approvals → backfill no
-- afecta filas existentes. Reproducir antes de prod:
--   SELECT COUNT(*) FROM "ServiceOrderApproval"
--   WHERE status = 'PENDING'
--     AND "requestedAt" + INTERVAL '48 hours' < NOW();
-- Las filas que reporte ese SELECT nacerán EXPIRED (Opción A:
-- comportamiento correcto, no hubo respuesta en >48h).

-- AlterTable: agregar nullable, backfill, set NOT NULL.
ALTER TABLE "ServiceOrderApproval" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "ServiceOrderApproval"
  SET "expiresAt" = "requestedAt" + INTERVAL '48 hours'
  WHERE "expiresAt" IS NULL;

ALTER TABLE "ServiceOrderApproval" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Índice para lazy expiry (WHERE status='PENDING' AND expiresAt < now()).
CREATE INDEX "ServiceOrderApproval_status_expiresAt_idx"
  ON "ServiceOrderApproval"("status", "expiresAt");
