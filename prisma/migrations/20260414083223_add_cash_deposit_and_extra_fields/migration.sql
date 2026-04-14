-- Migración aditiva sobre CashTransaction:
--   1. Convierte la columna `type` de TEXT a enum `CashTransactionType` (casting in-place, sin pérdida de datos).
--   2. Añade columnas opcionales `beneficiary`, `notes`, `depositCategory`.
--   3. Extiende `CashExpenseCategory` con PAGO_PROVEEDOR y LIMPIEZA.
--
-- Validación previa al CAST (correr manualmente antes de aplicar en ambientes con datos reales):
--   SELECT DISTINCT "type" FROM "CashTransaction";
-- Debe retornar solo: PAYMENT_IN, REFUND_OUT, EXPENSE_OUT, WITHDRAWAL. Cualquier otro valor
-- aborta el cast y obliga a sanear los datos antes de reintentar.

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('PAYMENT_IN', 'REFUND_OUT', 'EXPENSE_OUT', 'WITHDRAWAL', 'CASH_DEPOSIT');

-- CreateEnum
CREATE TYPE "CashDepositCategory" AS ENUM ('DOTACION_INICIAL', 'CAMBIO', 'OTROS');

-- AlterEnum: dos ADD VALUE sobre CashExpenseCategory.
-- Postgres 12+ acepta ambos ADD VALUE en la misma transacción porque los nuevos valores
-- no se usan (solo se añaden) dentro de la migración. Si aplicas sobre Postgres <12 y
-- revienta, parte esta migración en dos archivos — uno por ADD VALUE.
ALTER TYPE "CashExpenseCategory" ADD VALUE 'PAGO_PROVEEDOR';
ALTER TYPE "CashExpenseCategory" ADD VALUE 'LIMPIEZA';

-- AlterTable: columnas nuevas (opcionales, retrocompatibles).
ALTER TABLE "CashTransaction"
  ADD COLUMN "beneficiary"     TEXT,
  ADD COLUMN "notes"           TEXT,
  ADD COLUMN "depositCategory" "CashDepositCategory";

-- AlterTable: conversión de `type` TEXT → CashTransactionType usando cast implícito.
-- Requiere que TODOS los valores existentes coincidan con un label del enum (validado arriba).
ALTER TABLE "CashTransaction"
  ALTER COLUMN "type" TYPE "CashTransactionType"
  USING "type"::text::"CashTransactionType";
