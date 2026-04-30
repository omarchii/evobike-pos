-- CreateEnum
CREATE TYPE "OrigenCredito" AS ENUM ('CANCELACION', 'APARTADO_CANCELADO', 'DEVOLUCION', 'AJUSTE_MANAGER', 'MIGRACION_INICIAL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'PARTIAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CollectionStatus" ADD VALUE 'REJECTED';
ALTER TYPE "CollectionStatus" ADD VALUE 'DEFAULTED';
ALTER TYPE "CollectionStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "CustomerCredit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "origenTipo" "OrigenCredito" NOT NULL,
    "origenId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "expiredAt" TIMESTAMPTZ(3),
    "alertSentAt" TIMESTAMPTZ(3),

    CONSTRAINT "CustomerCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditConsumption" (
    "id" TEXT NOT NULL,
    "customerCreditId" TEXT NOT NULL,
    "cashTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "durationMs" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerCredit_customerId_expiredAt_balance_idx" ON "CustomerCredit"("customerId", "expiredAt", "balance");

-- CreateIndex
CREATE INDEX "CreditConsumption_customerCreditId_idx" ON "CreditConsumption"("customerCreditId");

-- CreateIndex
CREATE INDEX "CreditConsumption_cashTransactionId_idx" ON "CreditConsumption"("cashTransactionId");

-- CreateIndex
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "CustomerCredit" ADD CONSTRAINT "CustomerCredit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditConsumption" ADD CONSTRAINT "CreditConsumption_customerCreditId_fkey" FOREIGN KEY ("customerCreditId") REFERENCES "CustomerCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditConsumption" ADD CONSTRAINT "CreditConsumption_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint (Pack D.1 Decisión 4 — invariante de balance no expresable en Prisma schema)
ALTER TABLE "CustomerCredit"
  ADD CONSTRAINT "CustomerCredit_balance_check"
  CHECK (balance >= 0 AND balance <= monto);
