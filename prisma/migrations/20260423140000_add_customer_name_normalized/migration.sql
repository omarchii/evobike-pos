-- Añade Customer.nameNormalized (minúsculas + sin acentos) para búsqueda
-- tolerante. Backfill usando unaccent() que ya está disponible como extensión
-- (ver 20260418015524_enable_unaccent_extension).

ALTER TABLE "Customer" ADD COLUMN "nameNormalized" TEXT NOT NULL DEFAULT '';

UPDATE "Customer"
SET "nameNormalized" = LOWER(unaccent("name"));

CREATE INDEX "Customer_nameNormalized_idx" ON "Customer"("nameNormalized");
