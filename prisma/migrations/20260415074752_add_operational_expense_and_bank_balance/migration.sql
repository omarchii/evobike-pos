-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENTA', 'SERVICIOS', 'NOMINA', 'PUBLICIDAD', 'TRANSPORTE', 'MANTENIMIENTO_INMUEBLE', 'IMPUESTOS', 'COMISIONES_BANCARIAS', 'OTRO');

-- CreateTable
CREATE TABLE "OperationalExpense" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "categoria" "ExpenseCategory" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodoPago" "PaymentMethod" NOT NULL,
    "comprobanteUrl" TEXT,
    "registradoPor" TEXT NOT NULL,
    "isAnulado" BOOLEAN NOT NULL DEFAULT false,
    "anuladoPor" TEXT,
    "anuladoAt" TIMESTAMP(3),
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "notas" TEXT,
    "registradoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalExpense_branchId_fecha_idx" ON "OperationalExpense"("branchId", "fecha");

-- CreateIndex
CREATE INDEX "OperationalExpense_branchId_categoria_idx" ON "OperationalExpense"("branchId", "categoria");

-- CreateIndex
CREATE INDEX "OperationalExpense_isAnulado_idx" ON "OperationalExpense"("isAnulado");

-- CreateIndex
CREATE INDEX "BankBalanceSnapshot_createdAt_idx" ON "BankBalanceSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "OperationalExpense" ADD CONSTRAINT "OperationalExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalExpense" ADD CONSTRAINT "OperationalExpense_registradoPor_fkey" FOREIGN KEY ("registradoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalExpense" ADD CONSTRAINT "OperationalExpense_anuladoPor_fkey" FOREIGN KEY ("anuladoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceSnapshot" ADD CONSTRAINT "BankBalanceSnapshot_registradoPor_fkey" FOREIGN KEY ("registradoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
