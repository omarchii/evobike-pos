-- Pack E.7 — drop ServiceOrder.prepaidMethod.
--
-- Rationale: el campo era una denormalización de Sale.payments[] que
-- mentía con splits (1 método único o NULL si split). Reportes que
-- filtraban por prepaidMethod perdían órdenes split.
-- Consumers ahora derivan desde Sale.payments[] vía
-- derivePrepaidMethodFromPayments (src/lib/workshop-prepaid.ts).
--
-- Pre-prod stage (memory: project_dev_stage.md): drop directo, sin
-- staged 3-PR cycle. Backfill de prepaidAt/prepaidAmount sigue siendo
-- requerido para órdenes legacy (campos NO se dropean).

ALTER TABLE "ServiceOrder" DROP COLUMN "prepaidMethod";
