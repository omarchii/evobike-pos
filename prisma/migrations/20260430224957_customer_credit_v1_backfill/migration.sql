-- Pack D.1 Migration 2 — backfill Customer.balance > 0 → CustomerCredit MIGRACION_INICIAL
--
-- Decisiones aplicadas:
--   · G6 sanity verificado pre-backfill: COUNT(*) WHERE balance < 0 = 0.
--   · expiresAt = NOW() + 365 days. CLIENT-PENDING-G2 — cliente confirma post-merge si esta política está OK
--     o decide otro plazo (opciones (a) 365d / (b) 30-60d / (c) 0d / (d) caso por caso).
--     Si cliente decide (b/c/d), ejecutar UPDATE post-merge antes de exponer banner POS (D.4).
--   · NOT EXISTS hace la migration re-ejecutable sin duplicar (G8/Decisión 14).

INSERT INTO "CustomerCredit" (id, "customerId", monto, balance, "origenTipo", "createdAt", "expiresAt")
SELECT
  gen_random_uuid(),
  c.id,
  c.balance,
  c.balance,
  'MIGRACION_INICIAL',
  NOW(),
  NOW() + INTERVAL '365 days'
FROM "Customer" c
WHERE c.balance > 0
  AND NOT EXISTS (
    SELECT 1 FROM "CustomerCredit" cc
    WHERE cc."customerId" = c.id
      AND cc."origenTipo" = 'MIGRACION_INICIAL'
  );
