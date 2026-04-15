-- P7-A: Rediseño QuotationStatus — mapeo de datos + recreación del enum

-- Step 1: Drop the default (it references the old enum type)
ALTER TABLE "cotizaciones" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: Create the new enum type
CREATE TYPE "QuotationStatus_new" AS ENUM ('DRAFT', 'EN_ESPERA_CLIENTE', 'EN_ESPERA_FABRICA', 'PAGADA', 'FINALIZADA', 'RECHAZADA');

-- Step 3: Convert the column to TEXT so we can UPDATE with new string values
ALTER TABLE "cotizaciones" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

-- Step 4: Map old enum values to new ones
UPDATE "cotizaciones" SET "status" = 'EN_ESPERA_CLIENTE' WHERE "status" = 'SENT';
UPDATE "cotizaciones" SET "status" = 'FINALIZADA'        WHERE "status" = 'CONVERTED';
UPDATE "cotizaciones" SET "status" = 'RECHAZADA'         WHERE "status" = 'CANCELLED';
-- DRAFT stays DRAFT; EXPIRED was never stored in DB (computed at read time), but guard anyway:
UPDATE "cotizaciones" SET "status" = 'EN_ESPERA_CLIENTE' WHERE "status" = 'EXPIRED';

-- Step 5: Cast the TEXT column to the new enum type
ALTER TABLE "cotizaciones" ALTER COLUMN "status" TYPE "QuotationStatus_new" USING "status"::"QuotationStatus_new";

-- Step 6: Restore the column default with the new enum type
ALTER TABLE "cotizaciones" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"QuotationStatus_new";

-- Step 7: Drop the old enum type (column no longer references it)
DROP TYPE "QuotationStatus";

-- Step 8: Rename the new enum to the canonical name
ALTER TYPE "QuotationStatus_new" RENAME TO "QuotationStatus";
