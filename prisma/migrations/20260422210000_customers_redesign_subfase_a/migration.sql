-- Customers redesign (Paso 2, módulo 5) — Sub-fase A
-- Ref: docs/customers-redesign/BRIEF.md §3
--
-- Todos los cambios son aditivos salvo DROP INDEX "Customer_phone_key"
-- (phone deja de ser UNIQUE — dedup pasa a flujo de merge manual).
-- Antes de dropear la unicidad normalizamos los valores existentes para
-- que la búsqueda por teléfono no dependa del formato heredado
-- ("+52 (55) 1234-5678", "55-1234-5678", etc.).
--
-- RFC pasa a ser UNIQUE. Normalizamos (TRIM + UPPER) y convertimos
-- strings vacíos a NULL antes de crear el índice único para que no
-- genere colisiones artificiales.
--
-- CashTransaction.customerId se backfillea desde Sale cuando exista el
-- vínculo; las recargas/gastos standalone se quedan NULL (brief §3.3).

-- === Backfill 1: normalizar Customer.phone ===
-- strip no-dígitos y recorta a los últimos 10 (quita lada país 52/+52).
UPDATE "Customer"
SET "phone" = RIGHT(REGEXP_REPLACE("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND LENGTH(REGEXP_REPLACE("phone", '\D', '', 'g')) >= 10;

-- Si tras normalizar quedó vacío o <10 dígitos, preservamos el valor
-- previo en phonePrevious (aún no existe la columna; se hace después).
-- Paso intermedio: dejar como NULL los que no califican. Los SELLERs
-- podrán capturar el correcto desde el form de edición.
UPDATE "Customer"
SET "phone" = NULL
WHERE "phone" IS NOT NULL
  AND LENGTH(REGEXP_REPLACE("phone", '\D', '', 'g')) < 10;

-- === Backfill 2: normalizar Customer.rfc ===
UPDATE "Customer"
SET "rfc" = NULL
WHERE "rfc" IS NOT NULL AND TRIM("rfc") = '';

UPDATE "Customer"
SET "rfc" = UPPER(TRIM("rfc"))
WHERE "rfc" IS NOT NULL;

-- === CreateEnum ===
CREATE TYPE "CustomerDeleteReason" AS ENUM ('DUPLICATE', 'REQUEST', 'ERROR');

-- === CreateEnum ===
CREATE TYPE "CustomerNoteKind" AS ENUM ('NOTE', 'PHONE_CALL', 'WHATSAPP_SENT', 'EMAIL_SENT');

-- === DropIndex (phone deja de ser UNIQUE) ===
DROP INDEX "Customer_phone_key";

-- === AlterTable: CashTransaction ===
ALTER TABLE "CashTransaction" ADD COLUMN "customerId" TEXT;

-- === AlterTable: Customer ===
ALTER TABLE "Customer" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "communicationConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedReason" "CustomerDeleteReason",
ADD COLUMN     "isBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "phonePrevious" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- === AlterTable: CustomerBike ===
ALTER TABLE "CustomerBike" ADD COLUMN "odometerKm" INTEGER;

-- === CreateTable: CustomerNote ===
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "CustomerNoteKind" NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- === CreateTable: CustomerEditLog ===
CREATE TABLE "CustomerEditLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerBikeId" TEXT,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEditLog_pkey" PRIMARY KEY ("id")
);

-- === CreateIndex ===
CREATE INDEX "CustomerNote_customerId_createdAt_idx" ON "CustomerNote"("customerId", "createdAt" DESC);
CREATE INDEX "CustomerEditLog_customerId_createdAt_idx" ON "CustomerEditLog"("customerId", "createdAt" DESC);
CREATE INDEX "CustomerEditLog_customerBikeId_field_idx" ON "CustomerEditLog"("customerBikeId", "field");
CREATE INDEX "CashTransaction_customerId_idx" ON "CashTransaction"("customerId");
CREATE UNIQUE INDEX "Customer_rfc_key" ON "Customer"("rfc");
CREATE INDEX "Customer_mergedIntoId_idx" ON "Customer"("mergedIntoId");
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- === AddForeignKey ===
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerEditLog" ADD CONSTRAINT "CustomerEditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerEditLog" ADD CONSTRAINT "CustomerEditLog_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerEditLog" ADD CONSTRAINT "CustomerEditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === Backfill 3: CashTransaction.customerId desde Sale ===
UPDATE "CashTransaction" ct
SET "customerId" = s."customerId"
FROM "Sale" s
WHERE ct."saleId" = s."id"
  AND s."customerId" IS NOT NULL
  AND ct."customerId" IS NULL;
