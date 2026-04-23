-- Invariante Sale.type (documentada en schema.prisma y callers).
--
-- Formalización en DB vía CHECK constraint tras confirmar en E.2 que
-- existen 6 callsites directos de sale.create en producción + 2 en seed
-- (charge, deliver-A, deliver-C, pedidos:149, pedidos:229, cotizaciones-
-- convert:250, seed-transactional:1105, seed-transactional:1360). El
-- umbral "≥2 callsites" quedó cruzado y la invariante solo vivía como
-- comment; cualquier sale.create que la violara pasaba silenciosamente
-- a DB. Este constraint la hace inviolable going-forward.
--
-- Pre-apply: COUNT(violations) = 0 (verificado 2026-04-23).
--
-- Raw SQL (no declarativo en Prisma): db pull/introspect no lo reflejan,
-- por lo que queda anotado aquí como fuente canónica. Si Prisma reporta
-- drift tras introspect, IGNORAR — el constraint es la intención.

ALTER TABLE "Sale" ADD CONSTRAINT "sale_type_invariant" CHECK (
  ("serviceOrderId" IS NOT NULL AND "type" = 'SERVICE' AND "orderType" IS NULL) OR
  ("orderType" IS NOT NULL AND "type" IN ('LAYAWAY', 'BACKORDER')) OR
  ("serviceOrderId" IS NULL AND "orderType" IS NULL AND "type" = 'DIRECT')
);
