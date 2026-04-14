-- CreateEnum
CREATE TYPE "CashExpenseCategory" AS ENUM ('MENSAJERIA', 'PAPELERIA', 'CONSUMO', 'MANTENIMIENTO', 'AJUSTE_CAJA', 'OTRO');

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN     "collectedAt" TIMESTAMP(3),
ADD COLUMN     "expenseCategory" "CashExpenseCategory";

-- Backfill: registros históricos ya COLLECTED usan createdAt como collectedAt.
UPDATE "CashTransaction"
SET "collectedAt" = "createdAt"
WHERE "collectionStatus" = 'COLLECTED' AND "collectedAt" IS NULL;
